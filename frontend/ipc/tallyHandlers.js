const { ipcMain } = require("electron");
const log = require("electron-log");
const databaseManager = require('../db/db');
const { eq,inArray } = require("drizzle-orm");
const { statements } = require("../db/schema/Statement");
const { transactions } = require("../db/schema/Transactions");
const axios = require("axios");
const { buildTallyXml } = require("./buildTallyXml");
const { XMLParser } = require("fast-xml-parser");

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

  // create a new ipc handler to update the status of the transactions
  ipcMain.handle("update-transaction-status", async (event,transactionIds) => {
    try {
      const updatedTransactions = await db
        .update(transactions)
        .set({ imported: 1 })
        .where(inArray(transactions.id, transactionIds));
      return true;
    } catch (error) {
      console.error("Error updating transaction status:", error);
      return false;
    }
  });

  ipcMain.handle("tally-upload", async (event, tallyUploadData) => {
    const successIds = [];
    const failedTransactions = [];
    const parser = new XMLParser(); // XML Parser for response

    const end = tallyUploadData.length;
    // const end = 2;
    for (let i = 0; i <end; i++) {
      const row = tallyUploadData[i];
      const xmlContent = buildTallyXml(row);
      try {
        const response = await axios.post("http://localhost:9000", xmlContent, {
          headers: { "Content-Type": "application/xml" },
        });
        const xmlResponse = response.data;
        const parsedResponse = parser.parse(xmlResponse);
        const lineError = parsedResponse.RESPONSE?.LINEERROR || null;

        if (lineError) {
          console.error(`Transaction ${row.id} Failed: ${lineError}`);
          failedTransactions.push({ id: row.id, error: lineError });
      } else {
          console.log(`Transaction ${row.id} Successful`);
          successIds.push(row.id);
      }



        } catch (error) {
          console.error(`Transaction ${row.id} Failed (Server Error): ${error.message}`);
          failedTransactions.push({ id: row.id, error: error.message });
      }
    }

    // Outside for loop
    // Call backend API to update success statuses
    if (successIds.length > 0) {
      // const updateResult = await ipcRenderer.invoke("update-transaction-status", successIds);
      try {
        const updatedTransactions = await db
          .update(transactions)
          .set({ imported: 1 })
          .where(inArray(transactions.id, successIds));
      } catch (error) {
        console.error("Error updating transaction status:", error);
      }
  } 

  log.info({successIds, failedTransactions});

  return { success: true, successIds, failedTransactions };
  });

}

module.exports = { registerTallyIpc };
