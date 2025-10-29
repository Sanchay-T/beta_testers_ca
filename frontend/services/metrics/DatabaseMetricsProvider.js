const log = require("electron-log");
const { sql, eq } = require("drizzle-orm");
const DatabaseManager = require("../../db/db");
const { users } = require("../../db/schema/User");
const { cases } = require("../../db/schema/Cases");
const { statements } = require("../../db/schema/Statement");
const { failedStatements } = require("../../db/schema/FailedStatements");
const { summary } = require("../../db/schema/Summary");
const { transactions } = require("../../db/schema/Transactions");
const { tallyVoucher } = require("../../db/schema/TallyVoucher");

class DatabaseMetricsProvider {
  constructor({ logger = log } = {}) {
    this.logger = logger;
    this.db = null;
  }

  async ensureReady(userDataPath) {
    if (this.db) {
      return;
    }
    const manager = DatabaseManager.getInstance();
    this.db = await manager.initialize(userDataPath);
    if (!this.db) {
      throw new Error("Metrics: database handle is unavailable");
    }
  }

  async getUserById(userId) {
    if (!userId) {
      return null;
    }
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        dateJoined: users.dateJoined,
        lastLogin: users.lastLogin,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0] || null;
  }

  async getUsageStats() {
    const [caseCountRow] = await this.db
      .select({ count: sql`COUNT(*)`.as("count") })
      .from(cases)
      .where(eq(cases.deleted, 0));

    const statusRows = await this.db
      .select({
        status: cases.status,
        count: sql`COUNT(*)`.as("count"),
      })
      .from(cases)
      .where(eq(cases.deleted, 0))
      .groupBy(cases.status);

    const statusCounts = statusRows.reduce((acc, row) => {
      const statusKey = (row.status || "Unknown").toLowerCase();
      acc[statusKey] = Number(row.count || 0);
      return acc;
    }, {});

    const [statementCountRow] = await this.db
      .select({ count: sql`COUNT(*)`.as("count") })
      .from(statements);

    const [failedCountRow] = await this.db
      .select({ count: sql`COUNT(*)`.as("count") })
      .from(failedStatements);

    const [summaryCountRow] = await this.db
      .select({ count: sql`COUNT(*)`.as("count") })
      .from(summary);

    const [transactionCountRow] = await this.db
      .select({ count: sql`COUNT(*)`.as("count") })
      .from(transactions);

    const [tallyCountRow] = await this.db
      .select({ count: sql`COUNT(*)`.as("count") })
      .from(tallyVoucher);

    const banks = await this.db
      .select({ bank: statements.bankName })
      .from(statements)
      .groupBy(statements.bankName);

    const caseActivity = await this.db
      .select({
        first: sql`MIN(${cases.createdAt})`.as("first"),
        last: sql`MAX(${cases.createdAt})`.as("last"),
      })
      .from(cases)
      .where(eq(cases.deleted, 0));

    const totalStatements = Number(statementCountRow?.count || 0);
    const totalFailed = Number(failedCountRow?.count || 0);
    const successful = Math.max(totalStatements - totalFailed, 0);
    const successRate =
      totalStatements > 0 ? (successful / totalStatements) * 100 : 0;

    return {
      totalCases: Number(caseCountRow?.count || 0),
      totalStatementsProcessed: totalStatements,
      totalStatementsFailed: totalFailed,
      successRatePercent: Number(successRate.toFixed(2)),
      distinctBanks: banks.filter((row) => row.bank).length,
      totalTransactions: Number(transactionCountRow?.count || 0),
      reportsGenerated: Number(summaryCountRow?.count || 0),
      tallyExports: Number(tallyCountRow?.count || 0),
      caseStatusCounts: statusCounts,
      totalCasesFailed: statusCounts.failed || 0,
      totalCasesPending: statusCounts.pending || 0,
      totalCasesSucceeded: statusCounts.success || 0,
      caseActivity: caseActivity?.[0] || { first: null, last: null },
    };
  }

  async getActivityWindow() {
    const rows = await this.db
      .select({
        first: sql`MIN(${statements.createdAt})`.as("first"),
        last: sql`MAX(${statements.createdAt})`.as("last"),
      })
      .from(statements);
    return rows[0] || { first: null, last: null };
  }

  async getFailedStatements() {
    const rows = await this.db
      .select({
        id: failedStatements.id,
        rawData: failedStatements.data,
        caseId: failedStatements.caseId,
        caseName: cases.name,
        caseCreatedAt: cases.createdAt,
      })
      .from(failedStatements)
      .leftJoin(cases, eq(failedStatements.caseId, cases.id));
    return rows;
  }
}

module.exports = DatabaseMetricsProvider;
