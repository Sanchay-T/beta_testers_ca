const { sqliteTable, text, integer } = require("drizzle-orm/sqlite-core");

const Category_Master = sqliteTable("Category_Master", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  debit_credit: text("debit_credit").notNull(),
  category: text("category").notNull(),
  particulars: text("particulars").notNull(),
  preferences: text("preferences"),
});

module.exports = { Category_Master };
