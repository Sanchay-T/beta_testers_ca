const { ipcMain } = require("electron");
const log = require("electron-log");
const databaseManager = require('../db/db');
const { opportunityToEarn } = require("../db/schema/OpportunityToEarn");
const { eq } = require("drizzle-orm");
const { statements } = require("../db/schema/Statement");
const { cases } = require("../db/schema/Cases");

function registerTallyIpc() {

  const db = databaseManager.getInstance().getDatabase();
  log.info("Database instance : ", db);

  ipcMain.handle("get-payment-reciept-voucher", async () => {
    try {

      return { success: true, data };
    } catch (error) {
      console.error("Error fetching opportunity data:", error);
      return { success: false, message: error.message };
    }
  });
}

module.exports = { registerOpportunityToEarnIpc };
