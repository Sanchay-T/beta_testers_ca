const path = require("path");
const fs = require("fs");
const log = require("electron-log");
const { decryptData } = require("./CryptoHandler"); // Adjust this path as needed
const axios = require("axios");

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

                // Validate the session with the .NET server before marking activation.
                const validationResult = await this.validateSession(parsed);
                if (validationResult && validationResult.success) {
                    this.isActivated = true;
                    this.licenseData = parsed; // Store the license data
                    log.info("Session validated and license activated.");
                    return true;
                } else {
                    log.warn("Session validation failed. License not activated. Reason:", validationResult.message);
                    return false;
                }
            } else {
                log.warn("License expired or malformed.");
                return false;
            }
        } catch (err) {
            log.error("Failed to decrypt or parse license file:", err.message);
            return false;
        }
    }

    async validateSession(licenseData) {
        // Prepare the payload for the .NET endpoint.
        const payload = {
            clientId: licenseData.clientId || "",
            uuid: licenseData.uuid || "",
            hostname: licenseData.hostname || "",
            macAddress: licenseData.macAddress || ""
        };

        const gatewayPort = licenseData.port || 7890;
        const gatewayIp = licenseData.ip || "localhost";

        log.info("Validating session with payload:", payload);

        try {
            // Replace with the actual URL and port for your .NET HTTP API.
            const response = await axios.post(
                `http://${gatewayIp}:${gatewayPort}/api/license/validate-session`,
                payload,
                { headers: { "Content-Type": "application/json" }, timeout: 3000 },
            );
            const result = response.data;
            log.info("Session validation result:", result);
            return result;
        } catch (err) {
            if (err.code === 'ECONNABORTED') {
                log.error("Request timed out while validating session.", err.code);
                return {
                    success: false,
                    message: "Request timed out. Please ensure the validation server is responsive."
                };
            }

            if (!err.response) {
                log.error("Network error during session validation:", err.code);
                log.warn("Fallback activated: Not activating license due to unreachable validation server.");
                return {
                    success: false,
                    message: "Validation server is not reachable. Please try again later."
                };
            }

            // Server responded with a status code outside the 2xx range
            const statusCode = err.response.status;
            const statusText = err.response.statusText || 'Unknown error';
            log.error(`Server returned an error during session validation: [${statusCode}] ${statusText}`);

            return {
                success: false,
                message: `Session validation failed with status ${statusCode}: ${statusText}`
            };
        }
    }

    async checkActivation() {
        return this.isActivated;
    }

    setLicenseInfo(licenseData) {
        log.info("Setting license data:", licenseData);
        this.licenseData = licenseData; // <-- Setter method if needed externally
    }

    getLicenseInfo() {
        return this.licenseData; // <-- Accessor method if needed externally
    }
}

module.exports = LicenseManager.getInstance();
