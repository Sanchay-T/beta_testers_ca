const { sqliteTable, text, real, integer } = require("drizzle-orm/sqlite-core");
const { cases } = require("./Cases");

const summary = sqliteTable("summary", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  caseId: integer("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "CASCADE" }),
  data: text("data", { mode: "json" }).notNull(),
});

module.exports = { summary };
