// utils/getSystemUUID.js
const { execSync } = require("child_process");
const log = require("electron-log");
const crypto = require("crypto");

async function getSystemUUID() {
  try {
    // Method 1: Try WMI with timeout (safer than systeminformation)
    log.info("Attempting to get UUID using WMI...");

    try {
      const wmiCommand = "wmic csproduct get UUID /value";
      const result = execSync(wmiCommand, {
        timeout: 5000, // 5 second timeout
        encoding: "utf8",
        windowsHide: true,
      });

      const match = result.match(/UUID=(.+)/);
      if (match && match[1] && match[1].trim() !== "") {
        const uuid = match[1].trim();
        log.info("Successfully got UUID from WMI:", uuid);
        return uuid;
      }
    } catch (wmiError) {
      log.warn("WMI UUID failed:", wmiError.message);
    }

    // Method 2: Try motherboard serial number
    log.info("Trying motherboard serial as fallback...");
    try {
      const mbCommand = "wmic baseboard get SerialNumber /value";
      const mbResult = execSync(mbCommand, {
        timeout: 5000,
        encoding: "utf8",
        windowsHide: true,
      });

      const mbMatch = mbResult.match(/SerialNumber=(.+)/);
      if (mbMatch && mbMatch[1] && mbMatch[1].trim() !== "") {
        const serial = mbMatch[1].trim();
        log.info("Using motherboard serial as UUID:", serial);
        return serial;
      }
    } catch (mbError) {
      log.warn("Motherboard serial failed:", mbError.message);
    }

    // Method 3: Generate stable UUID based on computer name + user
    log.info("Using computer-based UUID generation...");
    const computerName = process.env.COMPUTERNAME || "unknown";
    const userName = process.env.USERNAME || "unknown";
    const combined = `${computerName}-${userName}`;
    const hash = crypto.createHash("sha256").update(combined).digest("hex");
    const uuid = [
      hash.substr(0, 8),
      hash.substr(8, 4),
      hash.substr(12, 4),
      hash.substr(16, 4),
      hash.substr(20, 12),
    ].join("-");

    log.info("Generated stable UUID from system info:", uuid);
    return uuid;
  } catch (error) {
    log.error("All UUID methods failed:", error.message);

    // Final fallback - generate from hostname
    const hostname = require("os").hostname();
    const fallbackHash = crypto
      .createHash("md5")
      .update(hostname)
      .digest("hex");
    const fallbackUuid = [
      fallbackHash.substr(0, 8),
      fallbackHash.substr(8, 4),
      fallbackHash.substr(12, 4),
      fallbackHash.substr(16, 4),
      fallbackHash.substr(20, 12),
    ].join("-");

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
