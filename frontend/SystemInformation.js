const axios = require("axios");
const crypto = require("crypto");
const log = require("electron-log");
const si = require("systeminformation");
const { exec } = require("child_process");
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
            // Load hashedUUID
            this.hashedUUID = await this.computeHashedUUID();
            // Load MAC address
            this.macAddress = await this.computeMACAddress();
            // Load connected Wi‑Fi SSID
            // this.ssid = await this.computeConnectedSSID();

            this.hostname = this.computeHostname();

            this.username = this.computeUsername();

            // Load Windows User SID if on Windows, else set as null.
            if (process.platform === "win32") {
                this.userSID = await this.computeWindowsUserSID(userDataPath);
                // this.userSID = "Windows3";
            } else {
                this.userSID = "SIDWindows3";
            }
            log.info("System information loaded successfully.");
        } catch (error) {
            log.error("Error during system information loading:", error);
        }
    }

    // Hash UUID with salt to prevent reverse-engineering
    async computeHashedUUID() {
        const uuid = await getSystemUUID();
        this.uuid = uuid; // Store the raw UUID for later use
        const salt = process.env.UUID_SALT || 'default-salt';
        log.info("UUID Salt:", salt);
        return crypto.createHash('sha256').update(uuid + salt).digest('hex');
    }

    // Get the MAC address of the first non-internal, active network interface
    async computeMACAddress() {
        try {
            const networkInterfaces = await si.networkInterfaces();
            // Filter for an active non-internal interface that has a MAC
            const activeInterface = networkInterfaces.find(iface =>
                !iface.internal &&
                iface.mac &&
                (iface.operstate === 'up' || iface.operstate === 'unknown')
            );

            if (activeInterface && activeInterface.mac) {
                log.info("MAC Address:", activeInterface.mac);
                return activeInterface.mac;
            } else {
                log.warn("No active MAC address found.");
                return 'unknown';
            }
        } catch (error) {
            log.error("Error retrieving MAC address:", error);
            return 'error';
        }
    }

    // Get the currently connected Wi‑Fi SSID (if available)
    async computeConnectedSSID() {
        try {
            const wifiConnections = await si.wifiConnections();
            if (wifiConnections.length > 0 && wifiConnections[0].ssid) {
                const ssid = wifiConnections[0].ssid;
                log.info("Connected SSID:", ssid);
                return ssid;
            } else {
                log.warn("No active Wi‑Fi connection found.");
                return 'none';
            }
        } catch (error) {
            log.error("Error retrieving Wi‑Fi SSID:", error);
            return 'error';
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
            exec('whoami /user', (error, stdout, stderr) => {
                if (error) {
                    log.error("Error retrieving SID:", error);
                    return reject(error);
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

                    log.info("User SID:", sid)

                    resolve(sid);
                } else {
                    log.error("Could not parse SID from output:", stdout);
                    reject(new Error("Failed to retrieve SID"));
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

    computeUsername() {
        const userInfo = os.userInfo();
        log.info("Current Username:", userInfo.username);
        return userInfo.username;
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

    getConnectedSSID() {
        return this.ssid;
    }

    getWindowsUserSID() {
        return this.userSID;
    }

    getHostname() {
        return this.hostname;
    }

    getUsername() {
        return this.username
    }
}

module.exports = SystemInformation.getInstance();
