const { sqliteTable, text, integer } = require("drizzle-orm/sqlite-core");
const { users } = require("./User");

const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  category: text("category").notNull(),
});

module.exports = { categories };
