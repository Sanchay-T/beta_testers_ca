const { ipcMain } = require("electron");
const log = require("electron-log");
const databaseManager = require("../db/db");
const { eq, inArray } = require("drizzle-orm");
const { transactions } = require("../db/schema/Transactions");
const axios = require("axios");

function registerVoucherIpc() {
  const db = databaseManager.getInstance().getDatabase();
  log.info("Database instance : ", db);

  ipcMain.handle("update-voucher", async (event, data) => {
    log.info({ data });
    // data is an object with the following
    // [
    // {
    //   voucher_type: voucher_type,
    //   id: id
    // },
    //   voucher_type: voucher_type,
    //   id: id
    // }
    // ]
    // update transactions voucher according to above data
    try {
      if (!Array.isArray(data)) {
        throw new Error("Expected data to be an array.");
      }

      for (const item of data) {
        // Validate that both id and voucher_type are provided.
        if (!item.id || item.voucher_type === undefined) {
          log.warn("Skipping invalid voucher update item:", item);
          continue;
        }

        // Create the update object.
        // Always update voucher_type.
        const updateValues = {
          voucher_type: item.voucher_type,
        };

        // If the new voucher type is "contra" (case-insensitive), update category as well.
        // if (item.voucher_type.toLowerCase() === "contra") {
        //   updateValues.category = "Self transfer";
        // }

        if (item.category.toLowerCase() === "self transfer") {
          updateValues.category = "Self transfer";
        }

        // Update the transaction record.
        await db
          .update(transactions)
          .set(updateValues)
          .where(eq(transactions.id, item.id));
      }

      log.info("Voucher update completed successfully.");
      return true;
    } catch (error) {
      log.error("Error updating voucher data:", error);
      return false;
    }
  });
}

module.exports = { registerVoucherIpc };
