const { ipcMain } = require("electron");
const log = require("electron-log");
const databaseManager = require("../db/db");
const { opportunityToEarn } = require("../db/schema/OpportunityToEarn");
const { eq, and, desc } = require("drizzle-orm");
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
        .leftJoin(
          statements,
          and(
            eq(statements.caseId, opportunityToEarn.caseId),
            // Assuming you have a createdAt or similar timestamp field
            eq(
              statements.id,
              db
                .select({ id: statements.id })
                .from(statements)
                .where(eq(statements.caseId, opportunityToEarn.caseId))
                .orderBy(desc(statements.createdAt))
                .limit(1)
            )
          )
        );

      log.info("Opportunity to earn data:", data);

      return { success: true, data };
    } catch (error) {
      console.error("Error fetching opportunity data:", error);
      return { success: false, message: error.message };
    }
  });
}

module.exports = { registerOpportunityToEarnIpc };
