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
    this.totalMemory = null;
    this.cpuModel = null;
    this.systemRequirementsCheck = null;
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
    const startTime = Date.now();
    const debugLog = (step, data = {}) => {
      const elapsed = Date.now() - startTime;
      log.info(`[SYSINFO DEBUG] ${step} | Elapsed: ${elapsed}ms |`, data);
    };

    try {
      debugLog("START loadData", { userDataPath });
      log.info("Starting system information loading...");

      // Load hashedUUID with timeout
      debugLog("BEFORE computeHashedUUID");
      try {
        this.hashedUUID = await this.computeHashedUUID();
        debugLog("AFTER computeHashedUUID", { hashedUUID: this.hashedUUID?.substring(0, 8) + "..." });
      } catch (uuidError) {
        debugLog("ERROR computeHashedUUID", { error: uuidError.message });
        throw uuidError;
      }

      // Load MAC address with timeout
      debugLog("BEFORE computeMACAddress");
      try {
        this.macAddress = await this.computeMACAddress();
        debugLog("AFTER computeMACAddress", { macAddress: this.macAddress });
      } catch (macError) {
        debugLog("ERROR computeMACAddress", { error: macError.message });
        throw macError;
      }

      // Get hostname (safe, synchronous)
      debugLog("BEFORE computeHostname");
      this.hostname = this.computeHostname();
      debugLog("AFTER computeHostname", { hostname: this.hostname });

      // Get username (safe, synchronous)
      debugLog("BEFORE computeUsername");
      this.username = this.computeUsername();
      debugLog("AFTER computeUsername", { username: this.username });

      // Get system memory information
      debugLog("BEFORE computeMemoryInfo");
      try {
        this.totalMemory = await this.computeMemoryInfo();
        debugLog("AFTER computeMemoryInfo", { totalMemoryGB: Math.round(this.totalMemory / 1024 / 1024 / 1024) });
      } catch (memError) {
        debugLog("ERROR computeMemoryInfo", { error: memError.message });
        this.totalMemory = 0;
      }

      // Get CPU information
      debugLog("BEFORE computeCPUInfo");
      try {
        this.cpuModel = await this.computeCPUInfo();
        debugLog("AFTER computeCPUInfo", { cpuModel: this.cpuModel?.substring(0, 50) + "..." });
      } catch (cpuError) {
        debugLog("ERROR computeCPUInfo", { error: cpuError.message });
        this.cpuModel = "unknown";
      }

      // Perform system requirements check
      debugLog("BEFORE performSystemRequirementsCheck");
      this.systemRequirementsCheck = this.performSystemRequirementsCheck();
      debugLog("AFTER performSystemRequirementsCheck", this.systemRequirementsCheck);

      // Load Windows User SID if on Windows, else set as null.
      if (process.platform === "win32") {
        debugLog("BEFORE computeWindowsUserSID");
        try {
          this.userSID = await this.computeWindowsUserSID(userDataPath);
          debugLog("AFTER computeWindowsUserSID", { userSID: this.userSID });
        } catch (sidError) {
          debugLog("ERROR computeWindowsUserSID", { error: sidError.message });
          throw sidError;
        }
      } else {
        this.userSID = "SIDWindows3";
        debugLog("SKIP computeWindowsUserSID (not Windows)", { userSID: this.userSID });
      }

      debugLog("SUCCESS loadData complete", {
        totalTime: Date.now() - startTime,
        uuid: this.uuid?.substring(0, 8) + "...",
        hashedUUID: this.hashedUUID?.substring(0, 8) + "...",
        macAddress: this.macAddress,
        hostname: this.hostname,
        username: this.username,
        userSID: this.userSID
      });
      log.info("System information loaded successfully.");
    } catch (error) {
      debugLog("FATAL ERROR in loadData", { 
        error: error.message,
        stack: error.stack,
        totalTime: Date.now() - startTime
      });
      log.error("Error during system information loading:", error);
      // Set fallback values so app doesn't crash
      this.hashedUUID = this.hashedUUID || "fallback-hash";
      this.macAddress = this.macAddress || "00:00:00:00:00:00";
      this.hostname = this.hostname || os.hostname();
      this.username = this.username || "unknown";
      this.userSID = this.userSID || "S-1-5-21-fallback";
      debugLog("APPLIED FALLBACK VALUES", {
        hashedUUID: this.hashedUUID,
        macAddress: this.macAddress,
        hostname: this.hostname,
        username: this.username,
        userSID: this.userSID
      });
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
    const startTime = Date.now();
    const debugLog = (method, status, data = {}) => {
      const elapsed = Date.now() - startTime;
      log.info(`[MAC DEBUG] ${method} - ${status} | Elapsed: ${elapsed}ms |`, data);
    };

    try {
      debugLog("computeMACAddress", "START");
      log.info("Getting MAC address with safe method...");

      // Method 1: Try WMI with timeout
      debugLog("WMI", "ATTEMPTING");
      try {
        const wmiCommand =
          'wmic path Win32_NetworkAdapter where "NetConnectionStatus=2" get MACAddress /value';
        debugLog("WMI", "EXECUTING", { command: wmiCommand });
        const result = execSync(wmiCommand, {
          timeout: 5000,
          encoding: "utf8",
          windowsHide: true,
        });
        debugLog("WMI", "EXECUTED", { resultLength: result.length });

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
        debugLog("WMI", "FAILED", { error: wmiError.message, code: wmiError.code });
        log.warn("WMI MAC address failed:", wmiError.message);
      }

      // Method 2: Use Node.js os.networkInterfaces() (safer than systeminformation)
      debugLog("NODE_INTERFACES", "ATTEMPTING");
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
      debugLog("GETMAC", "ATTEMPTING");
      log.info("Trying getmac command...");
      try {
        debugLog("GETMAC", "EXECUTING");
        const getMacResult = execSync("getmac /fo csv /nh", {
          timeout: 5000,
          encoding: "utf8",
          windowsHide: true,
        });
        debugLog("GETMAC", "EXECUTED", { resultLength: getMacResult.length });

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
        debugLog("GETMAC", "FAILED", { error: getMacError.message, code: getMacError.code });
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
      const cmdStartTime = Date.now();
      log.info("[SID DEBUG] Executing whoami /user command...");
      exec("whoami /user", { timeout: 10000 }, (error, stdout, stderr) => {
        const cmdElapsed = Date.now() - cmdStartTime;
        log.info(`[SID DEBUG] whoami command completed in ${cmdElapsed}ms`);
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

  // Get system memory information
  async computeMemoryInfo() {
    try {
      log.info("Getting system memory information...");
      
      if (process.platform === "win32") {
        // Use Windows-specific WMI command for accurate memory info
        const wmiCommand = 'wmic computersystem get TotalPhysicalMemory /value';
        const result = execSync(wmiCommand, {
          timeout: 5000,
          encoding: "utf8",
          windowsHide: true,
        });
        
        const match = result.match(/TotalPhysicalMemory=(\d+)/);
        if (match && match[1]) {
          const totalMemory = parseInt(match[1]);
          log.info("Total Physical Memory (bytes):", totalMemory);
          log.info("Total Physical Memory (GB):", Math.round(totalMemory / 1024 / 1024 / 1024 * 100) / 100);
          return totalMemory;
        }
      }
      
      // Fallback to Node.js os.totalmem()
      const totalMemory = os.totalmem();
      log.info("Total Memory (fallback - bytes):", totalMemory);
      log.info("Total Memory (fallback - GB):", Math.round(totalMemory / 1024 / 1024 / 1024 * 100) / 100);
      return totalMemory;
      
    } catch (error) {
      log.error("Error retrieving memory information:", error);
      // Fallback to os.totalmem()
      const totalMemory = os.totalmem();
      log.warn("Using fallback memory detection:", Math.round(totalMemory / 1024 / 1024 / 1024 * 100) / 100, "GB");
      return totalMemory;
    }
  }

  // Get CPU information
  async computeCPUInfo() {
    try {
      log.info("Getting CPU information...");
      
      if (process.platform === "win32") {
        // Use Windows-specific WMI command for CPU info
        const wmiCommand = 'wmic cpu get Name /value';
        const result = execSync(wmiCommand, {
          timeout: 5000,
          encoding: "utf8",
          windowsHide: true,
        });
        
        const match = result.match(/Name=(.+)/);
        if (match && match[1]) {
          const cpuModel = match[1].trim();
          log.info("CPU Model:", cpuModel);
          return cpuModel;
        }
      }
      
      // Fallback to Node.js os.cpus()
      const cpus = os.cpus();
      if (cpus && cpus.length > 0) {
        const cpuModel = cpus[0].model;
        log.info("CPU Model (fallback):", cpuModel);
        return cpuModel;
      }
      
      return "unknown";
      
    } catch (error) {
      log.error("Error retrieving CPU information:", error);
      // Fallback to os.cpus()
      try {
        const cpus = os.cpus();
        if (cpus && cpus.length > 0) {
          const cpuModel = cpus[0].model;
          log.warn("Using fallback CPU detection:", cpuModel);
          return cpuModel;
        }
      } catch (fallbackError) {
        log.error("Fallback CPU detection failed:", fallbackError);
      }
      return "unknown";
    }
  }

  // Perform system requirements check
  performSystemRequirementsCheck() {
    const requirements = {
      meetsRequirements: true,
      issues: [],
      memoryGB: 0,
      hasInsufficientRAM: false,
      hasLowEndCPU: false,
      shouldBlockUpdates: false
    };


    try {
      // Check memory requirements (8GB minimum)
      if (this.totalMemory) {
        const memoryGB = this.totalMemory / 1024 / 1024 / 1024;
        requirements.memoryGB = Math.round(memoryGB * 100) / 100;
        
        if (memoryGB < 8) {
          requirements.hasInsufficientRAM = true;
          requirements.meetsRequirements = false;
          requirements.issues.push(`RAM: ${requirements.memoryGB}GB (minimum 8GB required)`);
          log.warn("System has insufficient RAM:", requirements.memoryGB, "GB");
        } else {
          log.info("System RAM check passed:", requirements.memoryGB, "GB");
        }
      }

      // Check CPU requirements (Intel i5 minimum)
      if (this.cpuModel && this.cpuModel !== "unknown") {
        const cpuModel = this.cpuModel.toLowerCase();
        
        // Check for Intel processors
        if (cpuModel.includes('intel')) {
          // Check for processors below i5
          const isLowEndIntel = (
            cpuModel.includes('celeron') ||
            cpuModel.includes('pentium') ||
            cpuModel.includes('atom') ||
            (cpuModel.includes('core') && (
              cpuModel.includes('i3') ||
              cpuModel.includes('core 2') ||
              cpuModel.includes('core duo')
            ))
          );
          
          if (isLowEndIntel) {
            requirements.hasLowEndCPU = true;
            requirements.meetsRequirements = false;
            requirements.issues.push(`CPU: ${this.cpuModel} (Intel i5 or equivalent recommended)`);
            log.warn("System has low-end CPU:", this.cpuModel);
          } else {
            log.info("Intel CPU check passed:", this.cpuModel);
          }
        } else {
          // For non-Intel CPUs, we'll be less restrictive but still log for monitoring
          log.info("Non-Intel CPU detected:", this.cpuModel);
          
          // Check for very low-end AMD processors
          if (cpuModel.includes('amd') && (
            cpuModel.includes('e1-') ||
            cpuModel.includes('e2-') ||
            cpuModel.includes('a4-') ||
            cpuModel.includes('a6-') ||
            cpuModel.includes('athlon x2') ||
            cpuModel.includes('sempron')
          )) {
            requirements.hasLowEndCPU = true;
            requirements.meetsRequirements = false;
            requirements.issues.push(`CPU: ${this.cpuModel} (Higher performance CPU recommended)`);
            log.warn("System has low-end AMD CPU:", this.cpuModel);
          }
        }
      }

      // Determine if updates should be blocked
      requirements.shouldBlockUpdates = requirements.hasInsufficientRAM;
      
      if (requirements.shouldBlockUpdates) {
        log.warn("System requirements check FAILED - Updates will be blocked:", requirements.issues);
      } else if (!requirements.meetsRequirements) {
        log.warn("System requirements check shows warnings but updates allowed:", requirements.issues);
      } else {
        log.info("System requirements check PASSED");
      }

      return requirements;
      
    } catch (error) {
      log.error("Error during system requirements check:", error);
      return {
        meetsRequirements: false,
        issues: ["System requirements check failed"],
        memoryGB: 0,
        hasInsufficientRAM: true,
        hasLowEndCPU: false,
        shouldBlockUpdates: true,
        error: error.message
      };
    }
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

  getTotalMemory() {
    return this.totalMemory;
  }

  getMemoryGB() {
    if (this.totalMemory) {
      return Math.round(this.totalMemory / 1024 / 1024 / 1024 * 100) / 100;
    }
    return 0;
  }

  getCPUModel() {
    return this.cpuModel;
  }

  getSystemRequirementsCheck() {
    return this.systemRequirementsCheck;
  }

  meetsMinimumRequirements() {
    return this.systemRequirementsCheck?.meetsRequirements || false;
  }

  shouldBlockUpdates() {
    return this.systemRequirementsCheck?.shouldBlockUpdates || false;
  }
}

module.exports = SystemInformation.getInstance();
