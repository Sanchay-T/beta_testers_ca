const { ipcMain } = require("electron");
const log = require("electron-log");
const databaseManager = require('../db/db');
const { opportunityToEarn } = require("../db/schema/OpportunityToEarn");
const { eq } = require("drizzle-orm");
const { statements } = require("../db/schema/Statement");
const { cases } = require("../db/schema/Cases");

function registerOpportunityToEarnIpc() {

  const db = databaseManager.getInstance().getDatabase();
  log.info("Database instance : ", db);

  ipcMain.handle("getOpportunityToEarn", async () => {
    try {
      const data = await db
        .select({
          caseId: opportunityToEarn.caseId,
          homeLoanValue: opportunityToEarn.homeLoanValue,
          loanAgainstProperty: opportunityToEarn.loanAgainstProperty,
          businessLoan: opportunityToEarn.businessLoan,
          termPlan: opportunityToEarn.termPlan,
          generalInsurance: opportunityToEarn.generalInsurance,
          caseName: cases.name,
          statementCustomerName: statements.customerName,
        })
        .from(opportunityToEarn)
        .leftJoin(cases, eq(cases.id, opportunityToEarn.caseId))
        .leftJoin(statements, eq(statements.caseId, opportunityToEarn.caseId));

      return { success: true, data };
    } catch (error) {
      console.error("Error fetching opportunity data:", error);
      return { success: false, message: error.message };
    }
  });
}

module.exports = { registerOpportunityToEarnIpc };
