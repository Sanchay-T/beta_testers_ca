const { ipcMain } = require("electron");
const log = require("electron-log");
const databaseManager = require('../db/db');
const db = databaseManager.getDatabase();
const { cases } = require("../db/schema/Cases");
const { eq, and, inArray } = require("drizzle-orm"); // Add this import
const { statements } = require("../db/schema/Statement");

function getdata() {
  ipcMain.handle("get-Report-Name", async (event, caseId) => {
    try {
      const reportName = await db
        .select({
          name: cases.name,
        })
        .from(cases)
        .where(eq(cases.id, caseId));
      return reportName[0].name;
    } catch (error) {
      log.error("Failed to get report name:", error);
      return "";
    }
  });

  ipcMain.handle("get-Customer-Name", async (event, individualId) => {
    try {
      const result = await db
        .select({
          customerName: statements.customerName,
        })
        .from(statements)
        .where(eq(statements.id, individualId))
        .get(); // Use get() to fetch a single row instead of all matches

      return result?.customerName || null; // Return just the name or null if not found
    } catch (error) {
      log.error("Failed to get customer name:", error);
      return null;
    }
  });

  // Updated check-Report-Name-Exists handler with better error handling
  ipcMain.handle("check-Report-Name-Exists", async (event, { reportName }) => {
    try {
      if (!reportName) {
        return {
          exists: false,
          message: "Report name is required",
          error: true,
        };
      }

      const existingReport = await db
        .select({
          id: cases.id,
          name: cases.name,
        })
        .from(cases)
        .where(eq(cases.name, reportName.trim()));

      const exists = existingReport.length > 0;

      return {
        exists,
        message: exists
          ? "Report name already exists"
          : "Report name is available",
        error: false,
      };
    } catch (error) {
      log.error("Failed to check report name:", error);
      return {
        exists: false,
        message: "Failed to check report name",
        error: true,
      };
    }
  });
}
module.exports = { getdata };
