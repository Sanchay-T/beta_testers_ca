const {sqliteTable,text,real,integer} = require("drizzle-orm/sqlite-core");
const {cases} = require("./Cases");

const failedStatements = sqliteTable("failed_statements", {
    id: integer("id").primaryKey({autoIncrement: true}).notNull(),
    caseId: integer("case_id")
        .notNull()
        .references(() => cases.id, {onDelete: "CASCADE"}),
    data: text("data", { mode: "json" }).notNull(),
});

module.exports = { failedStatements };