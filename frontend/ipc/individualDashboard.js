const { ipcMain } = require("electron");
const log = require("electron-log");
const db = require("../db/db");
const { statements } = require("../db/schema/Statement");
const { transactions } = require("../db/schema/Transactions");
const { eod } = require("../db/schema/Eod");
const { summary } = require("../db/schema/Summary");
const { eq, gt, and, inArray } = require("drizzle-orm"); // Add this import

function registerIndividualDashboardIpc() {
  // Handler for getting EOD balance
  ipcMain.handle("get-eod-balance", async (event, caseId) => {
    if (!caseId) {
      log.error("Invalid caseId provided:", caseId);
      throw new Error("Invalid case ID");
    }

    try {
      const result = await db.select().from(eod).where(eq(eod.caseId, caseId));

      // log.info('EOD balance fetched successfully',result);
      return result;
    } catch (error) {
      log.error("Error fetching EOD balance:", error);
      throw new Error("Failed to fetch EOD balance");
    }
  });

  // Handler for getting summary data
  ipcMain.handle("get-summary", async (event, caseId) => {
    try {
      const result = await db
        .select()
        .from(summary)
        .where(eq(summary.caseId, caseId));
      // log.info("Summary data fetched successfully:", result);
      return result;
    } catch (error) {
      log.error("Error fetching summary data:", error);
      throw error;
    }
  });

  // Handler for getting all transactions
  ipcMain.handle("get-transactions", async (event, caseId, individualId) => {
    try {
      // Get all statements for the case
      if (individualId) {
        console.log("individualId", individualId);
        const allTransactions = await db
          .select({
            id: transactions.id,
            ...transactions
          })
          .from(transactions)
          .where(and(eq(transactions.statementId, individualId.toString())));
        
        log.info({allTransactions:allTransactions.length})
        return allTransactions;
      } else {
        const allStatements = await db
          .select()
          .from(statements)
          .where(eq(statements.caseId, caseId));
        if (allStatements.length === 0) {
          log.info("No statements found for case:", caseId);
          return [];
        }
        // Log statements for debugging
        // log.info("Found statements:", allStatements);
        // Get all transactions for these statements
        const allTransactions = await db
          .select({ id: transactions.id,
            ...transactions})
          .from(transactions)
          .where(
            inArray(
              transactions.statementId,
              allStatements.map((stmt) => stmt.id.toString()) // Convert integer ID to string
            )
          );
        // log.info("Transactions fetched successfully:", allTransactions.length);
        return allTransactions;
      }
    } catch (error) {
      log.error("Error fetching transactions:", error);
      throw error;
    }
  });

  // create a ipc to get transactions count for both credits and debits transactions
  ipcMain.handle("get-transactions-count", async (event, caseId) => {
    try {
      const allStatements = await db
        .select()
        .from(statements)
        .where(eq(statements.caseId, caseId));

      const statementIds = allStatements.map((stmt) => stmt.id.toString());

      const creditTransactions = await db
        .select()

        .from(transactions)
        .where(
          and(
            inArray(transactions.statementId, statementIds), // Check if statementId is in the list
            eq(transactions.type, "credit"), // Filter by type,
            gt(transactions.amount, 0) // Filter for amount greater than 0
          )
        ); // Apply both filters

      const debitTransactions = await db
        .select()
        .from(transactions)
        .where(
          and(
            inArray(transactions.statementId, statementIds), // Check if statementId is in the list
            eq(transactions.type, "debit"), // Filter by type
            gt(transactions.amount, 0) // Filter for amount greater than 0
          )
        ); // Apply both filters

      return {
        credit: creditTransactions.length,
        debit: debitTransactions.length,
      };
    } catch (error) {
      log.error("Error fetching transactions count:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "get-transactions-by-debtor",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select({
              id: transactions.id,
              ...transactions
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "Debtor")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select({
              id: transactions.id,
              ...transactions
            })
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "Debtor")
              )
            );
          return result;
        }
      } catch (error) {
        log.error("Error fetching transactions:", error);
        throw error;
      }
    }
  );

  // Handler for getting Creditor transactions
  ipcMain.handle(
    "get-transactions-by-creditor",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select({
              id: transactions.id,
              ...transactions
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "Creditor")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select({
              id: transactions.id,
              ...transactions
            })
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "Creditor")
              )
            );
          return result;
        }
      } catch (error) {
        log.error(
          "Error fetching transactions with category 'creditor':",
          error
        );
        throw error;
      }
    }
  );

  // Handler for getting Cash Withdrawal transactions
  ipcMain.handle(
    "get-transactions-by-cashwithdrawal",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "Cash Withdrawal")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "Cash Withdrawal")
              )
            );
          return result;
        }
      } catch (error) {
        log.error(
          "Error fetching transactions with category 'Cash withdrawal':",
          error
        );
        throw error;
      }
    }
  );

  // Handler for getting Cash Deposit transactions
  ipcMain.handle(
    "get-transactions-by-cashdeposit",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "Cash Deposits")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "Cash Deposits")
              )
            );
          return result;
        }
      } catch (error) {
        log.error(
          "Error fetching transactions with category 'Cash deposits':",
          error
        );
        throw error;
      }
    }
  );

  ipcMain.handle(
    "get-transactions-by-upi-cr",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select({
              id: transactions.id,
              ...transactions
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "UPI-Cr")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select({
              id: transactions.id,
              ...transactions
            })
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "UPI-Cr")
              )
            );
          log.info("UPI-Cr transactions fetched successfully:", result);
          return result;
        }
      } catch (error) {
        log.error("Error fetching transactions with category 'UPI-Cr':", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "get-transactions-by-upi-dr",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select({
              id: transactions.id,
              ...transactions
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "UPI-Dr")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select({
              id: transactions.id,
              ...transactions
            })
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "UPI-Dr")
              )
            );
          log.info("UPI-Dr transactions fetched successfully:", result);
          return result;
        }
      } catch (error) {
        log.error("Error fetching transactions with category 'UPI-Dr':", error);
        throw error;
      }
    }
  );

  // Handler for getting Suspense Credit transactions
  ipcMain.handle(
    "get-transactions-by-suspensecredit",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "Suspense"),
                eq(transactions.type, "credit")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "Suspense"),
                eq(transactions.type, "credit")
              )
            );
          return result;
        }
      } catch (error) {
        log.error("Error fetching Suspense Credit transactions:", error);
        throw error;
      }
    }
  );

  // Handler for getting Suspense Debit transactions
  ipcMain.handle(
    "get-transactions-by-suspensedebit",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "Suspense"),
                eq(transactions.type, "debit")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "Suspense"),
                eq(transactions.type, "debit")
              )
            );
          return result;
        }
      } catch (error) {
        log.error("Error fetching Suspense Debit transactions:", error);
        throw error;
      }
    }
  );

  // Handler for getting EMI transactions
  ipcMain.handle(
    "get-transactions-by-emi",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "Probable EMI"),
                gt(transactions.amount, 0),
                eq(transactions.type, "debit")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "Probable EMI"),
                gt(transactions.amount, 0),
                eq(transactions.type, "debit")
              )
            );
          return result;
        }
      } catch (error) {
        log.error("Error fetching 'Probable EMI' transactions:", error);
        throw error;
      }
    }
  );

  // Handler for getting Investment transactions
  ipcMain.handle(
    "get-transactions-by-investment",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "Investment")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "Investment")
              )
            );
          return result;
        }
      } catch (error) {
        log.error(
          "Error fetching transactions with category 'Investment':",
          error
        );
        throw error;
      }
    }
  );

  // Handler for getting Reversal transactions
  ipcMain.handle(
    "get-transactions-by-reversal",
    async (event, caseId, individualId) => {
      try {
        if (individualId) {
          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.statementId, individualId.toString()),
                eq(transactions.category, "Refund/Reversal")
              )
            );
          return result;
        } else {
          const allStatements = await db
            .select()
            .from(statements)
            .where(eq(statements.caseId, caseId));

          const statementIds = allStatements.map((stmt) => stmt.id.toString());

          const result = await db
            .select()
            .from(transactions)
            .where(
              and(
                inArray(transactions.statementId, statementIds),
                eq(transactions.category, "Refund/Reversal")
              )
            );
          return result;
        }
      } catch (error) {
        log.error(
          "Error fetching transactions with category 'Reversal':",
          error
        );
        throw error;
      }
    }
  );
}

module.exports = { registerIndividualDashboardIpc };
