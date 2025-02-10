const { ipcMain } = require("electron");
const log = require("electron-log");
const databaseManager = require("../db/db");
const { statements } = require("../db/schema/Statement");
const { cases } = require("../db/schema/Cases");
const { count, sql } = require("drizzle-orm");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { transactions } = require("../db/schema/Transactions");

function registerMainDashboardIpc(tmpdir_path) {
  const db = databaseManager.getInstance().getDatabase();
  log.info("Database instance : ", db);

  ipcMain.handle("get-reports-processed", async (event) => {
    try {
      const totalCount = await db
        .select({ count: count() })
        .from(cases)
        .then((rows) => rows[0]?.count || 0);

      const caseDates = await db
        .select({ createdAt: cases.createdAt })
        .from(cases);

      const statusCounts = await db
        .select({
          status: cases.status,
          count: count(),
        })
        .from(cases)
        .groupBy(cases.status);

      // console.log("count", totalCount);
      // console.log("caseDates", caseDates);
      console.log("statusCounts", statusCounts);

      const successCount =
        statusCounts.find((row) => row.status === "Success")?.count || 0;
      const failedCount =
        statusCounts.find((row) => row.status === "Failed")?.count || 0;

      return {
        totalCount,
        caseDates: caseDates.map((row) => row.createdAt),
        statusCounts: {
          success: successCount,
          failed: failedCount,
        },
      };
    } catch (error) {
      log.error("Error fetching cases processed:", error);
      throw error;
    }
  });

  ipcMain.handle("get-statements-processed", async (event) => {
    try {
      const totalCount = await db
        .select({ count: count() })
        .from(statements)
        .then((rows) => rows[0]?.count || 0);

      const statementDates = await db
        .select({ createdAt: statements.createdAt })
        .from(statements);

      // console.log("count", totalCount);
      // console.log("statementDates", statementDates);

      return {
        totalCount,
        statementDates: statementDates.map((row) => row.createdAt),
      };
    } catch (error) {
      log.error("Error fetching statements processed:", error);
      throw error;
    }
  });

  ipcMain.handle("get-transaction-processed", async (event) => {
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      const fyStartYear = currentMonth <= 3 ? currentYear - 1 : currentYear;

      const fyStartDate = new Date(`${fyStartYear}-04-01`);
      const fyEndDate = new Date(`${fyStartYear + 1}-03-31`);

      // Convert dates to timestamps for comparison
      const startTimestamp = fyStartDate.getTime();
      const endTimestamp = fyEndDate.getTime();

      const totalCount = await db
        .select({ count: count() })
        .from(transactions)
        .where(sql`${transactions.date} >= ${startTimestamp}`)
        .where(sql`${transactions.date} <= ${endTimestamp}`)
        .then((rows) => rows[0]?.count || 0);

      const transactionDates = await db
        .select({ date: transactions.date })
        .from(transactions)
        .where(sql`${transactions.date} >= ${startTimestamp}`)
        .where(sql`${transactions.date} <= ${endTimestamp}`);

      return {
        totalCount,
        transactionDates: transactionDates.map((row) => new Date(row.date)),
      };
    } catch (error) {
      console.error("Detailed error in get-transaction-processed:", error);
      log.error("Error fetching transactions processed:", error);
      throw error;
    }
  });

  ipcMain.handle("get-total-pages", async () => {
    try {
      // Get all cases with their creation dates and pages
      const result = await db
        .select({
          pages: cases.pages,
          createdAt: cases.createdAt,
        })
        .from(cases);

      return result;
    } catch (error) {
      console.error("Error getting pages by period:", error);
      throw error;
    }
  });

  ipcMain.handle("fetch-pdf-content", async (event, path) => {
    log.info("opening file ", path);
    // This hander takes in a file path and returns the base64 encoded data of the file
    // const filePath = 'E:/Workplace/Bizpedia/ca-offline-suite/frontend/tmp/52 Kotak bank account statement - Apr 23 to Mar 24.pdf'; // The path to the PDF file
    // const filePath = path.join(tmpdir_path, "failed_pdfs", "check", fileName);
    const data = await fs.promises.readFile(path);
    return data.toString("base64"); // Convert file data to base64 string
  });
}

module.exports = { registerMainDashboardIpc };
