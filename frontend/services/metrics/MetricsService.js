const log = require("electron-log");
const MetricsPayloadBuilder = require("./MetricsPayloadBuilder");
const MetricsUploader = require("./MetricsUploader");
const MetricsQueue = require("./MetricsQueue");

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

class MetricsService {
  constructor({
    userDataPath,
    intervalMs = DEFAULT_INTERVAL_MS,
    logger = log,
  } = {}) {
    this.logger = logger;
    this.userDataPath = userDataPath;
    this.intervalMs = intervalMs;
    this.builder = new MetricsPayloadBuilder({ logger });
    this.uploader = new MetricsUploader({ logger });
    this.queue = new MetricsQueue({ logger });
    this.timer = null;
  }

  setUserDataPath(userDataPath) {
    this.userDataPath = userDataPath;
  }

  setIntervalMs(intervalMs) {
    this.intervalMs = intervalMs;
    if (this.timer) {
      this.stopSchedule();
      this.startSchedule();
    }
  }

  isUploadEnabled() {
    const flag = process.env.METRICS_UPLOAD_ENABLED;
    if (flag === "false" || flag === "0") {
      return false;
    }
    return true;
  }

  async exportAndUpload({ trigger = "manual" } = {}) {
    if (!this.isUploadEnabled()) {
      this.logger.info("Metrics: upload disabled via METRICS_UPLOAD_ENABLED");
      return { success: false, disabled: true };
    }
    if (!this.userDataPath) {
      throw new Error("Metrics: userDataPath is not configured");
    }

    await this.flushQueue();

    const queueDepth = this.queue.getPending().length;
    const payload = await this.builder.buildPayload({
      userDataPath: this.userDataPath,
      trigger,
      queueDepth,
      attempt: 1,
    });

    const result = await this.uploader.upload(payload);
    if (result.success) {
      this.logger.info("Metrics: payload uploaded immediately");
      return { success: true, uploaded: true };
    }

    this.queue.enqueue(payload);
    return { success: false, queued: true, error: result.error };
  }

  async flushQueue() {
    let processed = 0;
    while (true) {
      const entry = this.queue.peek();
      if (!entry) {
        break;
      }
      const attempts = this.queue.incrementAttempts();
      const result = await this.uploader.upload(entry.payload);
      if (result.success) {
        this.queue.shift();
        processed += 1;
        continue;
      }
      if (attempts >= 5) {
        this.logger.warn(
          "Metrics: permanently failing payload after max attempts",
          { attempts }
        );
        this.queue.shift();
        continue;
      }
      // stop processing on first failure this round
      break;
    }
    if (processed > 0) {
      this.logger.info(`Metrics: flushed ${processed} queued payload(s)`);
    }
    return processed;
  }

  startSchedule() {
    if (this.timer || !this.intervalMs) {
      return;
    }
    this.timer = setInterval(() => {
      this.exportAndUpload({ trigger: "schedule" }).catch((error) => {
        this.logger.error("Metrics: scheduled upload failed", error);
      });
    }, this.intervalMs);
    this.logger.info(
      `Metrics: scheduled uploader started (interval=${this.intervalMs}ms)`
    );
  }

  stopSchedule() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info("Metrics: scheduled uploader stopped");
    }
  }

  dispose() {
    this.stopSchedule();
  }
}

module.exports = MetricsService;
