const { sqliteTable, text, integer, real } = require("drizzle-orm/sqlite-core");
const { cases } = require("./Cases");

const statements = sqliteTable("statements", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  caseId: integer("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "CASCADE" }),
  accountNumber: text("account_number").notNull(),
  customerName: text("customer_name").notNull(),
  ifscCode: text("ifsc_code"),
  bankName: text("bank_name"),
  filePath: text("file_path").notNull().default("downloads"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  startDate: integer("start_date", { mode: "timestamp" }),
  endDate: integer("end_date", { mode: "timestamp" }),
  password: text("password"),

});

module.exports = { statements };
