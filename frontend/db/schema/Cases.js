const { sqliteTable, text, integer } = require("drizzle-orm/sqlite-core");
const { users } = require("./User");

const cases = sqliteTable("cases", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(), // String-based primary key
  // title: text("title").notNull(), // Case title
  // description: text("description"), // Optional case description
  name: text("name").notNull(),
  userId: integer("user_id") // Foreign key referencing users.id
    .notNull()
    .references(() => users.id, { onDelete: "CASCADE" }),
  status: text("status").notNull(),
  pages: integer("pages").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(), // Timestamp of creation
});

module.exports = { cases };
