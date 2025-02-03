// const { app } = require("electron");
const log = require("electron-log");
const path = require("path");
const { exec } = require("child_process");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const isDev = process.env.NODE_ENV === "development";
log.info('process.env.NODE_ENV', process.env.NODE_ENV);
// log.info("DB App userData path : ", app.getPath("userData"));
const BASE_DIR = isDev ? __dirname : process.resourcesPath;
const drizzleConfigPath = path.resolve(__dirname, "../drizzle.config.js");
log.info('drizzleConfigPath', drizzleConfigPath);


log.info('DB process.env.DB_FILE_NAME', process.env.DB_FILE_NAME);
const { drizzle } = require("drizzle-orm/libsql");
const { migrate } = require("drizzle-orm/libsql/migrator");

// const { createClient } = require("@libsql/client");
// const { schema } = require("./schema");


class DatabaseManager {
  static instance = null;
  #db = null;
  #initialized = false;

  constructor() {
    if (DatabaseManager.instance) {
      throw new Error("Use DatabaseManager.getInstance()");
    }
    DatabaseManager.instance = this;
  }

  static getInstance() {
    if (!DatabaseManager.instance) {
      log.info("Creating new DatabaseManager instance");
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(userDataPath) {
    if (this.#initialized) {
      log.info("Database already initialized");
      return this.#db;
    }

    try {
      const dbUrl = `file:${isDev
        ? path.resolve(__dirname, "../db.sqlite3")
        : path.join(userDataPath, "db.sqlite3")}`;

      log.info("Resolved dbUrl:", dbUrl);

      if (!dbUrl) {
        throw new Error("DATABASE_URL is not defined in the environment variables.");
      }

      this.#db = drizzle(dbUrl);
      // this.#initialized = true;

      const migrationsFolder = path.resolve(__dirname, "../drizzle");
      log.info('migrationsFolder : ', migrationsFolder);

      migrate(this.#db, {
        migrationsFolder: migrationsFolder, // Ensure this path points to your migrations folder
      })
        .then(() => {
          log.info("Migrations completed successfully.");
        })
        .catch((error) => {
          log.error("Error running migrations:", error);
          throw error;
        });

    } catch (error) {
      log.error("Error initializing database:", error);
      throw error;
    }
  }

  getDatabase() {
    // if (!this.#initialized) {
    //   throw new Error("Database not initialized. Call initialize() first");
    // }
    return this.#db;
  }
}

// Export the class instead of an instance
module.exports = DatabaseManager;