const path = require("path");
const fs = require("fs");
const log = require("electron-log");
const { decryptData } = require("./CryptoHandler"); // Adjust this path as needed

class LicenseManager {
    static instance;

    constructor() {
        if (LicenseManager.instance) {
            return LicenseManager.instance;
        }

        this.userDataPath = null;
        this.isActivated = false;
        this.licenseFileName = "clientLicense.enc";
        this.licenseData = null; // <-- Field to hold decrypted license info
        LicenseManager.instance = this;
    }

    static getInstance() {
        if (!LicenseManager.instance) {
            LicenseManager.instance = new LicenseManager();
        }
        return LicenseManager.instance;
    }

    async init(userDataPath) {
        this.userDataPath = userDataPath;
        log.info("User Data Path: ", path.join(this.userDataPath, this.licenseFileName));
        const filePath = path.join(this.userDataPath, this.licenseFileName);
        if (!fs.existsSync(filePath)) {
            log.info("Encrypted license file not found at", filePath);
            return false;
        }

        try {
            const encrypted = fs.readFileSync(filePath);
            const decrypted = await decryptData(encrypted);
            const parsed = JSON.parse(decrypted);

            log.info("License file contents:", parsed);

            const now = Date.now() / 1000;
            log.info("Current timestamp:", now);
            log.info("Expiry timestamp:", parsed.licenseExpiry);
            if (parsed.licenseExpiry && now < parsed.licenseExpiry) {
                this.isActivated = true;
                this.licenseData = parsed; // <-- Store parsed license data
                log.info("Valid license file found. License activated.");
                return true;
            } else {
                log.warn("License expired or malformed.");
                return false;
            }
        } catch (err) {
            log.error("Failed to decrypt or parse license file:", err.message);
            return false;
        }
    }

    async checkActivation() {
        return this.isActivated;
    }

    getLicenseInfo() {
        return this.licenseData; // <-- Accessor method if needed externally
    }
}

module.exports = LicenseManager.getInstance();
