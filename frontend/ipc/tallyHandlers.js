const { ipcMain } = require("electron");
const log = require("electron-log");
const databaseManager = require('../db/db');
const { eq } = require("drizzle-orm");
const { statements } = require("../db/schema/Statement");
const { transactions } = require("../db/schema/Transactions");

function registerTallyIpc() {

  const db = databaseManager.getInstance().getDatabase();
  log.info("Database instance : ", db);

  ipcMain.handle("get-tally-voucher", async (event,caseId,voucherType) => {
    try {
        const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));
        if (allStatements.length === 0) {
            log.info("No statements found for case:", caseId);
            return [];
        }

        const allTransactions = await db
          .select({
            id: transactions.id,
            ...transactions
          })
          .from(transactions)
          .where(
            inArray(
              transactions.statementId,
              allStatements.map((stmt) => stmt.id.toString()), // Convert integer ID to string
              eq(transactions.voucher_type, voucherType)
            )
          );
        return allTransactions;

    } catch (error) {
      console.error("Error fetching opportunity data:", error);
      return null;
    }
  });
}

module.exports = { registerTallyIpc };
