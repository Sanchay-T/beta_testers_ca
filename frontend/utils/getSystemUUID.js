// utils/getSystemUUID.js
const { execSync } = require("child_process");
const log = require("electron-log");
const crypto = require("crypto");

async function getSystemUUID() {
  const startTime = Date.now();
  const debugLog = (method, status, data = {}) => {
    const elapsed = Date.now() - startTime;
    log.info(`[UUID DEBUG] ${method} - ${status} | Elapsed: ${elapsed}ms |`, data);
  };

  debugLog("getSystemUUID", "START");
  
  try {
    // Method 1: Try WMI with timeout (safer than systeminformation)
    debugLog("WMI_UUID", "ATTEMPTING");
    log.info("Attempting to get UUID using WMI...");

    try {
      const wmiCommand = "wmic csproduct get UUID /value";
      debugLog("WMI_UUID", "EXECUTING", { command: wmiCommand });
      const result = execSync(wmiCommand, {
        timeout: 5000, // 5 second timeout
        encoding: "utf8",
        windowsHide: true,
      });
      debugLog("WMI_UUID", "EXECUTED", { resultLength: result.length });

      const match = result.match(/UUID=(.+)/);
      if (match && match[1] && match[1].trim() !== "") {
        const uuid = match[1].trim();
        debugLog("WMI_UUID", "SUCCESS", { uuid });
        log.info("Successfully got UUID from WMI:", uuid);
        return uuid;
      } else {
        debugLog("WMI_UUID", "NO_MATCH", { result: result.substring(0, 100) });
      }
    } catch (wmiError) {
      debugLog("WMI_UUID", "FAILED", { 
        error: wmiError.message, 
        code: wmiError.code,
        signal: wmiError.signal
      });
      log.warn("WMI UUID failed:", wmiError.message);
    }

    // Method 2: Try motherboard serial number
    debugLog("MB_SERIAL", "ATTEMPTING");
    log.info("Trying motherboard serial as fallback...");
    try {
      const mbCommand = "wmic baseboard get SerialNumber /value";
      debugLog("MB_SERIAL", "EXECUTING", { command: mbCommand });
      const mbResult = execSync(mbCommand, {
        timeout: 5000,
        encoding: "utf8",
        windowsHide: true,
      });
      debugLog("MB_SERIAL", "EXECUTED", { resultLength: mbResult.length });

      const mbMatch = mbResult.match(/SerialNumber=(.+)/);
      if (mbMatch && mbMatch[1] && mbMatch[1].trim() !== "") {
        const serial = mbMatch[1].trim();
        debugLog("MB_SERIAL", "SUCCESS", { serial });
        log.info("Using motherboard serial as UUID:", serial);
        return serial;
      } else {
        debugLog("MB_SERIAL", "NO_MATCH", { result: mbResult.substring(0, 100) });
      }
    } catch (mbError) {
      debugLog("MB_SERIAL", "FAILED", { 
        error: mbError.message, 
        code: mbError.code,
        signal: mbError.signal 
      });
      log.warn("Motherboard serial failed:", mbError.message);
    }

    // Method 3: Generate stable UUID based on computer name + user
    debugLog("COMPUTER_UUID", "GENERATING");
    log.info("Using computer-based UUID generation...");
    const computerName = process.env.COMPUTERNAME || "unknown";
    const userName = process.env.USERNAME || "unknown";
    const combined = `${computerName}-${userName}`;
    debugLog("COMPUTER_UUID", "INFO", { computerName, userName, combined });
    
    const hash = crypto.createHash("sha256").update(combined).digest("hex");
    const uuid = [
      hash.substring(0, 8),
      hash.substring(8, 12),
      hash.substring(12, 16),
      hash.substring(16, 20),
      hash.substring(20, 32),
    ].join("-");

    debugLog("COMPUTER_UUID", "SUCCESS", { uuid, totalTime: Date.now() - startTime });
    log.info("Generated stable UUID from system info:", uuid);
    return uuid;
  } catch (error) {
    debugLog("FALLBACK_UUID", "ERROR", { error: error.message, stack: error.stack });
    log.error("All UUID methods failed:", error.message);

    // Final fallback - generate from hostname
    const hostname = require("os").hostname();
    debugLog("FALLBACK_UUID", "GENERATING", { hostname });
    
    const fallbackHash = crypto
      .createHash("md5")
      .update(hostname)
      .digest("hex");
    const fallbackUuid = [
      fallbackHash.substring(0, 8),
      fallbackHash.substring(8, 12),
      fallbackHash.substring(12, 16),
      fallbackHash.substring(16, 20),
      fallbackHash.substring(20, 32),
    ].join("-");

    debugLog("FALLBACK_UUID", "SUCCESS", { 
      uuid: fallbackUuid, 
      totalTime: Date.now() - startTime 
    });
    log.info("Using final fallback UUID:", fallbackUuid);
    return fallbackUuid;
  }
}

// Remove the hanging Linux fallback
async function getLinuxFallbackUUID() {
  // Simplified for cross-platform compatibility
  const os = require("os");
  const hostname = os.hostname();
  const hash = crypto.createHash("md5").update(hostname).digest("hex");
  return [
    hash.substr(0, 8),
    hash.substr(8, 4),
    hash.substr(12, 4),
    hash.substr(16, 4),
    hash.substr(20, 12),
  ].join("-");
}

module.exports = { getSystemUUID };
