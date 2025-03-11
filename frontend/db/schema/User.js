// src/db/schema.js
const { sqliteTable, text, integer } = require("drizzle-orm/sqlite-core");

// Users table
const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  name: text("name").unique().notNull(),
  email: text("email").unique().notNull(),
  role: text("role").notNull().default("CA"),
  password: text("password").notNull(),
  dateJoined: integer("date_joined", { mode: "timestamp" }).notNull(),
  lastLogin: integer("last_login", { mode: "timestamp" }),
});

module.exports = { users };
