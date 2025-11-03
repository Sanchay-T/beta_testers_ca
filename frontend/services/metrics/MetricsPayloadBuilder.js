const { app } = require("electron");
const log = require("electron-log");
const sessionManager = require("../../SessionManager");
const licenseManager = require("../../LicenseManager");
const SystemDataProvider = require("./SystemDataProvider");
const DatabaseMetricsProvider = require("./DatabaseMetricsProvider");
const ActiveTimeTracker = require("./ActiveTimeTracker");
const {
  hashEmail,
  hashLicenseKey,
  hashDeviceId,
  sanitizeFileName,
  truncateText,
  toISO,
  roundTo,
} = require("./Hashing");

class MetricsPayloadBuilder {
  constructor({ logger = log } = {}) {
    this.logger = logger;
    this.systemProvider = new SystemDataProvider({ logger });
    this.dbProvider = new DatabaseMetricsProvider({ logger });
  }

  async buildPayload({
    userDataPath,
    trigger = "manual",
    queueDepth = 0,
    attempt = 1,
  } = {}) {
    await this.systemProvider.ensureLoaded(userDataPath);
    await this.dbProvider.ensureReady(userDataPath);

    const deviceSnapshot = this.systemProvider.getDeviceSnapshot();
    const usage = await this.dbProvider.getUsageStats();
    const activityRange = await this.dbProvider.getActivityWindow();
    const failedStatements = await this.dbProvider.getFailedStatements();
    const activeMinutes = this.getActiveMinutes(userDataPath);
    const appVersion = this.getAppVersion();

    const currentUser = sessionManager.getUser();
    const userRecord = await this.dbProvider.getUserById(
      currentUser?.userId || 0
    );
    const planValidity = this.computePlanValidity(userRecord);

    const licenseInfo =
      (typeof licenseManager.getLicenseInfo === "function"
        ? licenseManager.getLicenseInfo()
        : null) || {};

    const payload = {
      metrics_version: "v1.0",
      app_version: appVersion,
      exported_at: new Date().toISOString(),
      device: this.buildDeviceSection(deviceSnapshot),
      license: this.buildLicenseSection(licenseInfo),
      user: this.buildUserSection(userRecord || currentUser),
      usage: this.buildUsageSection({
        ...usage,
        planValidity,
        activeMinutes,
      }),
      failed_pdfs: this.buildFailedPdfsSection(failedStatements),
      activity_window: {
        first_activity: toISO(activityRange?.first),
        last_activity: toISO(activityRange?.last),
      },
      meta: {
        export_trigger: trigger,
        queue_depth: queueDepth,
        upload_attempts: attempt,
        app_version: appVersion,
      },
    };

    this.logger.info("Metrics: payload summary", {
      trigger,
      active_minutes_total: payload.usage?.active_minutes_total ?? 0,
      meta_app_version: payload.meta?.app_version,
      queue_depth: queueDepth,
    });

    return payload;
  }

  buildDeviceSection(snapshot) {
    const defaultSnapshot = snapshot || {};
    return {
      device_id_hash: hashDeviceId(defaultSnapshot.deviceId),
      hostname: defaultSnapshot.hostname || "unknown-host",
      os_platform: defaultSnapshot.osPlatform || "unknown",
      os_release: defaultSnapshot.osRelease || "",
      architecture: defaultSnapshot.architecture || "",
      total_ram_gb: roundTo(defaultSnapshot.totalRamGb || 0, 1),
      cpu_model: truncateText(
        defaultSnapshot.cpuModel || "unknown",
        120
      ),
      compatibility_mode: defaultSnapshot.compatibilityMode || "UNKNOWN",
    };
  }

  buildLicenseSection(licenseInfo) {
    if (!licenseInfo || typeof licenseInfo !== "object") {
      return {
        license_key_hash: null,
        license_key_plain: null,
        license_type: "UNKNOWN",
        license_expiry: null,
        max_users: 0,
        max_statements: 0,
      };
    }

    const rawKey =
      licenseInfo.licenseKey || licenseInfo.license_key || licenseInfo.key || null;

    return {
      license_key_hash: hashLicenseKey(rawKey),
      license_key_plain: rawKey || null,
      license_type:
        (licenseInfo.licenseType || licenseInfo.type || "UNKNOWN").toUpperCase(),
      license_expiry: toISO(licenseInfo.licenseExpiry || licenseInfo.expiry),
      max_users: Number(licenseInfo.maxUsers || licenseInfo.max_user || 0),
      max_statements: Number(
        licenseInfo.maxStatements || licenseInfo.max_statements || 0
      ),
    };
  }

  buildUserSection(userRecord) {
    if (!userRecord) {
      return {
        email_hash: null,
        email: null,
        role: null,
        date_joined: null,
        last_login: null,
      };
    }

    return {
      email_hash: hashEmail(
        userRecord.email || userRecord.username || userRecord.name
      ),
      email: userRecord.email || null,
      name: userRecord.name || null,
      role: userRecord.role || null,
      date_joined: toISO(userRecord.dateJoined),
      last_login: toISO(userRecord.lastLogin),
    };
  }

  buildUsageSection(usage = {}) {
    const numberOrZero = (value) =>
      typeof value === "number" && !Number.isNaN(value) ? value : 0;

    return {
      total_cases: usage.totalCases || 0,
      total_statements_processed: usage.totalStatementsProcessed || 0,
      total_statements_failed: usage.totalStatementsFailed || 0,
      success_rate_percent: usage.successRatePercent || 0,
      distinct_banks: usage.distinctBanks || 0,
      total_transactions: usage.totalTransactions || 0,
      reports_generated: usage.reportsGenerated || 0,
      tally_exports: usage.tallyExports || 0,
      case_status_counts: usage.caseStatusCounts || {},
      total_cases_failed: numberOrZero(usage.totalCasesFailed),
      total_cases_pending: numberOrZero(usage.totalCasesPending),
      total_cases_succeeded: numberOrZero(usage.totalCasesSucceeded),
      case_activity: {
        first_case_created_at: toISO(usage.caseActivity?.first),
        last_case_created_at: toISO(usage.caseActivity?.last),
      },
      total_pages: numberOrZero(usage.totalPages),
      total_time_saved_minutes: numberOrZero(usage.totalTimeSaved),
      avg_time_saved_per_day_minutes: numberOrZero(usage.averageTimeSaved),
      plan_validity: this.buildPlanValiditySection(usage.planValidity),
      earning_opportunity: this.buildEarningOpportunitySection({
        totalEligibility: usage.earningTotalEligibility,
        totalCommission: usage.earningTotalCommission,
      }),
      active_minutes_total: numberOrZero(usage.activeMinutes),
    };
  }

  getActiveMinutes(userDataPath) {
    try {
      const tracker = new ActiveTimeTracker({ userDataPath });
      return tracker.getTotals().totalMinutes;
    } catch (error) {
      this.logger.warn("Metrics: failed to read active time tracker", {
        message: error.message,
      });
      return 0;
    }
  }

  getAppVersion() {
    const envVersion = (process.env.APP_VERSION || "").trim();
    if (envVersion) {
      return envVersion;
    }
    try {
      return app.getVersion();
    } catch (error) {
      this.logger.warn("Metrics: failed to read Electron app version", {
        message: error.message,
      });
      return "unknown";
    }
  }

  buildFailedPdfsSection(rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }
    const items = [];
    rows.forEach((row) => {
      const parsedEntries = this.parseFailedStatement(row);
      if (Array.isArray(parsedEntries) && parsedEntries.length) {
        items.push(...parsedEntries);
      } else if (parsedEntries) {
        items.push(parsedEntries);
      }
    });
    return items;
  }

  parseFailedStatement(row) {
    if (!row) {
      return null;
    }
    let parsed = {};
    const rawData = row.rawData || row.data;
    if (rawData) {
      try {
        parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
      } catch (error) {
        this.logger.warn("Metrics: failed to parse failed_statements row", {
          id: row.id,
          error: error.message,
        });
      }
    }

    // Flatten array-based structure produced by failed_statements logger.
    const bankNames = parsed.bank_names || parsed.bankNames || [];
    const paths = parsed.paths || parsed.file_paths || parsed.files || [];
    const reasons =
      parsed.respective_reasons_for_error ||
      parsed.errorMessages ||
      parsed.errors ||
      [];
    const timestamps = parsed.timestamps || [];

    const entryCount = Math.max(
      bankNames.length,
      paths.length,
      reasons.length,
      timestamps.length,
      1
    );

    const systemContext = parsed.systemContext || parsed.system || {};
    const ramCandidate =
      systemContext.ramGb ??
      systemContext.memoryGb ??
      systemContext.memory ??
      null;
    const cpuCandidate =
      systemContext.cpuPercent ??
      systemContext.cpuUsage ??
      systemContext.cpu ??
      null;

    const results = [];
    for (let idx = 0; idx < entryCount; idx += 1) {
      const filePath =
        (Array.isArray(paths) && paths[idx]) ||
        parsed.fileName ||
        parsed.file_name ||
        parsed.file_path ||
        parsed.path ||
        "";
      const bankName =
        (Array.isArray(bankNames) && bankNames[idx]) ||
        parsed.bankType ||
        parsed.bank ||
        parsed.bank_name ||
        parsed.bankName ||
        null;
      const errorMessage =
        (Array.isArray(reasons) && reasons[idx]) ||
        parsed.errorMessage ||
        parsed.message ||
        parsed.error ||
        parsed.reason ||
        "";
      const timestamp =
        (Array.isArray(timestamps) && timestamps[idx]) ||
        parsed.timestamp ||
        parsed.failedAt ||
        parsed.createdAt ||
        null;

      results.push({
        case_id: row.caseId || null,
        case_name: row.caseName || null,
        case_created_at: toISO(row.caseCreatedAt),
        file_name: sanitizeFileName(filePath),
        bank_type: bankName,
        error_code: parsed.errorCode || parsed.code || null,
        error_message: truncateText(errorMessage),
        timestamp: toISO(timestamp),
        system_context: {
          ram_gb:
            typeof ramCandidate === "number"
              ? roundTo(ramCandidate, 1)
              : null,
          cpu_percent:
            typeof cpuCandidate === "number"
              ? roundTo(cpuCandidate, 1)
              : null,
        },
        raw_columns:
          Array.isArray(parsed.respective_list_of_columns) &&
          parsed.respective_list_of_columns[idx]
            ? parsed.respective_list_of_columns[idx]
            : null,
      });
    }

    return results;
  }

  computePlanValidity(userRecord) {
    if (!userRecord || !userRecord.dateJoined || !userRecord.expiryDate) {
      return null;
    }
    const joinedDate = new Date(userRecord.dateJoined);
    const expiryDate = new Date(userRecord.expiryDate);

    if (
      Number.isNaN(joinedDate.getTime()) ||
      Number.isNaN(expiryDate.getTime())
    ) {
      return null;
    }

    const joinedMs = joinedDate.getTime();
    const expiryMs = expiryDate.getTime();

    if (expiryMs <= joinedMs) {
      return {
        dateJoined: joinedDate,
        expiryDate,
        remainingDays: 0,
        completionPercent: 100,
      };
    }

    const nowMs = Date.now();
    const totalDurationMs = expiryMs - joinedMs;
    const elapsedMs = Math.min(
      Math.max(nowMs - joinedMs, 0),
      totalDurationMs
    );
    const remainingMs = Math.max(expiryMs - nowMs, 0);
    const remainingDays = Math.ceil(
      remainingMs / (1000 * 60 * 60 * 24)
    );
    const completionPercent = Math.min(
      100,
      Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100))
    );

    return {
      dateJoined: joinedDate,
      expiryDate,
      remainingDays,
      completionPercent,
    };
  }

  buildPlanValiditySection(planValidity) {
    if (!planValidity) {
      return {
        start_date: null,
        expiry_date: null,
        remaining_days: null,
        completion_percent: null,
      };
    }
    return {
      start_date: toISO(planValidity.dateJoined),
      expiry_date: toISO(planValidity.expiryDate),
      remaining_days: planValidity.remainingDays,
      completion_percent: planValidity.completionPercent,
    };
  }

  buildEarningOpportunitySection({
    totalEligibility,
    totalCommission,
  } = {}) {
    const safeNumber = (value) =>
      typeof value === "number" && !Number.isNaN(value) ? value : 0;
    const eligibility = roundTo(safeNumber(totalEligibility), 2);
    const commission = roundTo(safeNumber(totalCommission), 2);

    return {
      total_eligibility: eligibility,
      total_commission: commission,
    };
  }
}

module.exports = MetricsPayloadBuilder;
