const { sqliteTable, text, real, integer } = require("drizzle-orm/sqlite-core");
const { statements } = require("./Statement");

const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  statementId: text("statement_id")
    .notNull()
    .references(() => statements.id, { onDelete: "CASCADE" }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(),
  balance: real("balance").notNull(),
  // add default value in the entity
  bank: text("bank").notNull().default("unknown"),
  entity: text("entity").notNull().default("unknown"),
  voucher_type: text("voucher_type").default("unknown"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(Date.now()),
});

module.exports = { transactions };
