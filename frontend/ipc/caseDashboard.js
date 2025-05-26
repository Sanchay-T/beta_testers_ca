const { ipcMain } = require("electron");
const log = require("electron-log");
const databaseManager = require("../db/db");
const { statements } = require("../db/schema/Statement");
const { eq, and } = require("drizzle-orm"); // Add this import
const { transactions } = require("../db/schema/Transactions");

function registerCaseDashboardIpc() {
  const db = databaseManager.getInstance().getDatabase();

  ipcMain.handle("get-statements", async (event, caseId) => {
    const result = await db
      .select()
      .from(statements)
      .where(eq(statements.caseId, caseId));

    console.log("Statements fetched successfully:", result);
    return result;
  });

  ipcMain.handle("get-single-statement", async (event, statementId) => {
    try {
      const result = await db
        .select()
        .from(statements)
        .where(eq(statements.id, statementId));

      console.log("Statement fetched successfully:", result);
      return result;
    } catch (error) {
      log.error("Error fetching statement:", error);
      throw error; // Re-throw to handle in the renderer process
    }
  });

  ipcMain.handle(
    "update-statement",
    async (event, { id, customerName, accountNumber }) => {
      try {
        // Validate inputs
        if (!id) {
          throw new Error("Statement ID is required");
        }

        // Update the statement in the database
        const result = await db
          .update(statements)
          .set({
            customerName: customerName,
            accountNumber: accountNumber,
            updatedAt: new Date(), // Optional: Add if you want to track when records are updated
          })
          .where(eq(statements.id, id))
          .returning();

        console.log("Statement updated successfully:", result);
        return result[0]; // Return the updated statement
      } catch (error) {
        log.error("Error updating statement:", error);
        throw error; // Re-throw to handle in the renderer process
      }
    }
  );

  ipcMain.handle("get-combine-statements", async (event, caseId) => {
    try {
      // Get all statements for the case
      const allStatements = await db
        .select()
        .from(statements)
        .where(eq(statements.caseId, caseId));

      // Get all transactions for these statements
      const allTransactions = await db
        .select()
        .from(transactions)
        .where(
          inArray(
            transactions.statementId,
            allStatements.map((stmt) => stmt.id)
          )
        );

      return {
        statements: allStatements,
        transactions: allTransactions,
      };
    } catch (error) {
      console.error("Error fetching combined data:", error);
      throw error;
    }
  });

  ipcMain.handle("delete-statement", async (event, statementId) => {
    try {
      if (!statementId) {
        throw new Error("Statement ID is required");
      }

      await db.transaction(async (trx) => {
        // Step 1: Delete all related transactions
        await trx
          .delete(transactions)
          .where(eq(transactions.statementId, statementId));

        // Step 2: Delete the statement itself
        await trx.delete(statements).where(eq(statements.id, statementId));
      });

      console.log(
        `Statement ${statementId} and its related transactions deleted successfully`
      );
      return { success: true, message: "Statement deleted successfully" };
    } catch (error) {
      log.error("Error deleting statement:", error);
      throw error;
    }
  });
}

module.exports = { registerCaseDashboardIpc };
