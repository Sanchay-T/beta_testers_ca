const log = require("electron-log");
const path = require("path");
const { exec } = require("child_process");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const getIsDev = () => {
  if (global.AppConfig && typeof global.AppConfig.isDev === "boolean") {
    return global.AppConfig.isDev;
  }

  try {
    const { app } = require("electron");
    if (app && typeof app.isPackaged === "boolean") {
      return !app.isPackaged;
    }
  } catch (err) {
    console.warn("Could not access electron app:", err.message);
  }

  return process.env.NODE_ENV === "development";
};

const getBaseDir = () => {
  if (global.AppConfig && global.AppConfig.baseDir !== undefined) {
    return global.AppConfig.baseDir;
  }
  return getIsDev() ? __dirname : process.resourcesPath;
};

let isDev = null;
let BASE_DIR = null;

const ensureInitialized = () => {
  if (isDev === null) {
    isDev = getIsDev();
    BASE_DIR = getBaseDir();
    log.info("DB Initialized: isDev =", isDev, "BASE_DIR =", BASE_DIR);
    log.info("process.env.NODE_ENV", process.env.NODE_ENV);
  }
};

const drizzleConfigPath = path.resolve(__dirname, "../drizzle.config.js");
log.info("drizzleConfigPath", drizzleConfigPath);

log.info("DB process.env.DB_FILE_NAME", process.env.DB_FILE_NAME);
const { drizzle } = require("drizzle-orm/libsql");
const { migrate } = require("drizzle-orm/libsql/migrator");

class DatabaseManager {
  static instance = null;
  #db = null;
  #initialized = false;

  constructor() {
    if (DatabaseManager.instance) {
      throw new Error("Use DatabaseManager.getInstance()");
    }
    ensureInitialized();
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
      const dbName =
        (process.env.FOR_ATS == "true" ? "ats_db.sqlite3" : "db.sqlite3") ||
        "db.sqlite3";
      log.info("DB process.env.FOR_ATS", process.env.FOR_ATS, {
        dbName,
      });
      const dbUrl = `file:${
        isDev
          ? path.resolve(__dirname, `../${dbName}`)
          : path.join(userDataPath, `${dbName}`)
      }`;

      log.info("Resolved dbUrl:", dbUrl);

      if (!dbUrl) {
        throw new Error(
          "DATABASE_URL is not defined in the environment variables."
        );
      }

      this.#db = drizzle(dbUrl);
      const migrationsFolder = path.resolve(__dirname, "../drizzle");
      log.info("migrationsFolder : ", migrationsFolder);

      await migrate(this.#db, {
        migrationsFolder,
      });

      this.#initialized = true;
      log.info("Migrations completed successfully.");
      return this.#db;
    } catch (error) {
      log.error("Error initializing database:", error);
      throw error;
    }
  }

  getDatabase() {
    return this.#db;
  }
}

module.exports = DatabaseManager;
