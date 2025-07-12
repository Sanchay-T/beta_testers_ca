const axios = require("axios");
const crypto = require("crypto");
const log = require("electron-log");
const { execSync, exec } = require("child_process");
const { getSystemUUID } = require("./utils/getSystemUUID");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { encryptData, decryptData } = require("./CryptoHandler"); // your crypto module

// username : 2-32e6d741
// licensekey : SOMEX4Y4ZLicenseKEYForCAOffline

class SystemInformation {
  // Static instance to hold the single instance of the class
  static instance;

  constructor() {
    if (SystemInformation.instance) {
      return SystemInformation.instance;
    }
    // Initialize cache variables
    this.hashedUUID = null;
    this.uuid = null;
    this.macAddress = null;
    this.ssid = null;
    this.userSID = null;
    this.username = null;
    SystemInformation.instance = this;
  }

  // Get singleton instance
  static getInstance() {
    if (!SystemInformation.instance) {
      SystemInformation.instance = new SystemInformation();
    }
    return SystemInformation.instance;
  }

  // Load all system-related data once at startup.
  // This method can be awaited in your startup logic.
  async loadData(userDataPath) {
    try {
      log.info("Starting system information loading...");

      // Load hashedUUID with timeout
      this.hashedUUID = await this.computeHashedUUID();

      // Load MAC address with timeout
      this.macAddress = await this.computeMACAddress();

      // Get hostname (safe, synchronous)
      this.hostname = this.computeHostname();

      // Get username (safe, synchronous)
      this.username = this.computeUsername();

      // Load Windows User SID if on Windows, else set as null.
      if (process.platform === "win32") {
        this.userSID = await this.computeWindowsUserSID(userDataPath);
      } else {
        this.userSID = "SIDWindows3";
      }

      log.info("System information loaded successfully.");
    } catch (error) {
      log.error("Error during system information loading:", error);
      // Set fallback values so app doesn't crash
      this.hashedUUID = this.hashedUUID || "fallback-hash";
      this.macAddress = this.macAddress || "00:00:00:00:00:00";
      this.hostname = this.hostname || os.hostname();
      this.username = this.username || "unknown";
      this.userSID = this.userSID || "S-1-5-21-fallback";
    }
  }

  // Hash UUID with salt to prevent reverse-engineering
  async computeHashedUUID() {
    try {
      const uuid = await getSystemUUID();
      this.uuid = uuid; // Store the raw UUID for later use
      const salt = process.env.UUID_SALT || "cyphersol";
      log.info("UUID Salt:", salt);
      return crypto
        .createHash("sha256")
        .update(uuid + salt)
        .digest("hex");
    } catch (error) {
      log.error("Failed to compute UUID hash:", error);
      // Generate fallback hash
      const fallback = os.hostname() + os.userInfo().username;
      const salt = process.env.UUID_SALT || "cyphersol";
      return crypto
        .createHash("sha256")
        .update(fallback + salt)
        .digest("hex");
    }
  }

  // Get the MAC address with timeout and fallbacks
  async computeMACAddress() {
    try {
      log.info("Getting MAC address with safe method...");

      // Method 1: Try WMI with timeout
      try {
        const wmiCommand =
          'wmic path Win32_NetworkAdapter where "NetConnectionStatus=2" get MACAddress /value';
        const result = execSync(wmiCommand, {
          timeout: 5000,
          encoding: "utf8",
          windowsHide: true,
        });

        const lines = result.split("\n");
        for (const line of lines) {
          const match = line.match(/MACAddress=(.+)/);
          if (match && match[1] && match[1].trim() !== "") {
            const mac = match[1].trim();
            if (mac !== "00:00:00:00:00:00" && mac.length === 17) {
              log.info("MAC Address from WMI:", mac);
              return mac;
            }
          }
        }
      } catch (wmiError) {
        log.warn("WMI MAC address failed:", wmiError.message);
      }

      // Method 2: Use Node.js os.networkInterfaces() (safer than systeminformation)
      log.info("Trying Node.js network interfaces...");
      const interfaces = os.networkInterfaces();

      for (const [name, interfaceList] of Object.entries(interfaces)) {
        if (interfaceList) {
          for (const iface of interfaceList) {
            if (
              !iface.internal &&
              iface.mac &&
              iface.mac !== "00:00:00:00:00:00"
            ) {
              log.info("MAC Address from Node.js:", iface.mac);
              return iface.mac;
            }
          }
        }
      }

      // Method 3: Try getmac command
      log.info("Trying getmac command...");
      try {
        const getMacResult = execSync("getmac /fo csv /nh", {
          timeout: 5000,
          encoding: "utf8",
          windowsHide: true,
        });

        const lines = getMacResult.split("\n");
        for (const line of lines) {
          const parts = line.split(",");
          if (parts.length >= 1) {
            const mac = parts[0].replace(/"/g, "").trim();
            if (mac && mac !== "00-00-00-00-00-00" && mac.length >= 12) {
              // Convert from XX-XX-XX format to XX:XX:XX format
              const formattedMac = mac.replace(/-/g, ":");
              log.info("MAC Address from getmac:", formattedMac);
              return formattedMac;
            }
          }
        }
      } catch (getMacError) {
        log.warn("getmac command failed:", getMacError.message);
      }

      // Final fallback
      log.warn("All MAC address methods failed, using fallback");
      return "unknown-mac-address";
    } catch (error) {
      log.error("Error retrieving MAC address:", error);
      return "error-mac-address";
    }
  }

  // Get the currently connected Wi‑Fi SSID (if available) - REMOVED systeminformation
  async computeConnectedSSID() {
    try {
      // Use Windows netsh command instead of systeminformation
      const result = execSync("netsh wlan show profiles", {
        timeout: 5000,
        encoding: "utf8",
        windowsHide: true,
      });

      const lines = result.split("\n");
      for (const line of lines) {
        if (line.includes("All User Profile")) {
          const match = line.match(/:\s*(.+)/);
          if (match && match[1]) {
            const ssid = match[1].trim();
            log.info("Connected SSID:", ssid);
            return ssid;
          }
        }
      }

      log.warn("No Wi-Fi SSID found");
      return "none";
    } catch (error) {
      log.error("Error retrieving Wi‑Fi SSID:", error);
      return "error";
    }
  }

  async computeWindowsUserSID(userDataPath) {
    if (process.platform !== "win32") {
      log.warn("computeWindowsUserSID is only supported on Windows platforms.");
      return "unsupported_platform";
    }

    const sidCachePath = path.join(userDataPath, "sid.enc");

    // Check if SID is already securely cached
    if (fs.existsSync(sidCachePath)) {
      try {
        const encrypted = fs.readFileSync(sidCachePath, "utf8");
        const sid = decryptData(encrypted);
        log.info("Loaded cached User SID.");
        log.info("User SID:", sid);
        return sid;
      } catch (err) {
        log.warn("Failed to read cached SID. Recomputing.", err);
      }
    }

    // Compute SID using command and securely store it
    return new Promise((resolve, reject) => {
      exec("whoami /user", { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          log.error("Error retrieving SID:", error);
          // Generate fallback SID
          const fallbackSid = `S-1-5-21-${Date.now()}-${Math.random()
            .toString()
            .substr(2, 10)}-1001`;
          log.warn("Using fallback SID:", fallbackSid);
          return resolve(fallbackSid);
        }

        const sidMatch = stdout.match(/S-\d-\d+-(?:\d+-){2,}\d+/);
        if (sidMatch) {
          const sid = sidMatch[0];
          log.info("User SID:", sid);

          try {
            const encrypted = encryptData(sid);
            fs.writeFileSync(sidCachePath, encrypted, "utf8");
            log.info("User SID cached securely.");
          } catch (encryptErr) {
            log.error("Failed to cache encrypted SID:", encryptErr);
          }

          resolve(sid);
        } else {
          log.error("Could not parse SID from output:", stdout);
          // Generate fallback SID
          const fallbackSid = `S-1-5-21-${Date.now()}-${Math.random()
            .toString()
            .substr(2, 10)}-1001`;
          log.warn("Using fallback SID:", fallbackSid);
          resolve(fallbackSid);
        }
      });
    });
  }

  // Synchronously get the hostname using Node's os module
  computeHostname() {
    const hostname = os.hostname();
    log.info("Hostname:", hostname);
    return hostname;
  }

  // Synchronously get the username using Node's os module
  computeUsername() {
    const username = os.userInfo().username;
    log.info("Current Username:", username);
    return username;
  }

  // Accessor methods to retrieve the cached values
  getUUID() {
    return this.uuid;
  }

  getHashedUUID() {
    return this.hashedUUID;
  }

  getMACAddress() {
    return this.macAddress;
  }

  getSSID() {
    return this.ssid;
  }

  getWindowsUserSID() {
    return this.userSID;
  }

  getHostname() {
    return this.hostname;
  }

  getUsername() {
    return this.username;
  }
}

module.exports = SystemInformation.getInstance();
