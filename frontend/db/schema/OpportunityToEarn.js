const { sqliteTable, text, real, integer } = require("drizzle-orm/sqlite-core");
const { cases } = require("./Cases");

const opportunityToEarn = sqliteTable("opportunity_to_earn", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  caseId: integer("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "CASCADE" }),
  homeLoanValue: real("home_loan_value").notNull(),
  loanAgainstProperty: real("loan_against_property").notNull(),
  businessLoan: real("business_loan").notNull(),
  termPlan: real("term_plan").notNull(),
  generalInsurance: real("general_insurance").notNull(),
});

module.exports = { opportunityToEarn };
