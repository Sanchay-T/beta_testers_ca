const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const isDevelopment = !app.isPackaged || process.env.NODE_ENV === "development";

const configPath = isDevelopment
  ? path.join(__dirname, "config.json")
  : path.join(app.getPath("userData"), "config.json");

let config = {
  useLocalServer: true,
  isOcrEnabled: false,
  mode_detected_last_checked_at: null,
  detected_mode: null,
};

try {
  const data = fs.readFileSync(configPath, "utf8");
  config = JSON.parse(data);
} catch (error) {
  // File might not exist, which is fine.
}

const AppConfig = {
  isDev: isDevelopment,
  useLocalServer: config.useLocalServer,
  isOcrEnabled: config.isOcrEnabled,
  mode_detected_last_checked_at: config.mode_detected_last_checked_at || null,
  detected_mode: config.detected_mode || null,
  baseDir: isDevelopment ? __dirname : process.resourcesPath,
  userDataDir: app.getPath("userData"),
  configPath: configPath,
  setMode: (detectedMode) => {
    const mode = detectedMode.toLowerCase();
    AppConfig.detected_mode = mode;
    config.detected_mode = mode;

    if (mode === 'scan') {
      AppConfig.useLocalServer = true;
      AppConfig.isOcrEnabled = true;
    } else if (mode === 'unscan') {
      AppConfig.useLocalServer = true;
      AppConfig.isOcrEnabled = false;
    } else if (mode === 'hybrid') {
      AppConfig.useLocalServer = false;
      AppConfig.isOcrEnabled = false;
    } else {
      // Default case
      AppConfig.useLocalServer = true;
      AppConfig.isOcrEnabled = false;
    }

    config.useLocalServer = AppConfig.useLocalServer;
    config.isOcrEnabled = AppConfig.isOcrEnabled;
    
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
