const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const isDevelopment = !app.isPackaged || process.env.NODE_ENV === "development";

const configPath = isDevelopment
  ? path.join(__dirname, "config.json")
  : path.join(app.getPath("userData"), "config.json");

let config = {
  isCapable: false,
  mode_detected_last_checked_at: null,
};

try {
  const data = fs.readFileSync(configPath, "utf8");
  console.log("Config data loaded:", data);
  config = JSON.parse(data);
} catch (error) {
  // File might not exist, which is fine.
}

const AppConfig = {
  isDev: isDevelopment,
  isCapable: config.isCapable || false,
  mode_detected_last_checked_at: config.mode_detected_last_checked_at || null,
  baseDir: isDevelopment ? __dirname : process.resourcesPath,
  userDataDir: app.getPath("userData"),
  configPath: configPath,
  setIsCapable: (isCapable) => {
    AppConfig.isCapable = isCapable;
    config.isCapable = isCapable;
    AppConfig.mode_detected_last_checked_at = new Date().toISOString();
    config.mode_detected_last_checked_at = AppConfig.mode_detected_last_checked_at;
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log('config.json updated:', config);
    } catch (error) {
      console.error("Failed to write config file:", error);
    }
  },
};

module.exports = AppConfig;