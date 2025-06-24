const keytar = require("keytar");
const axios = require("axios");
const { getSystemUUID } = require("./utils/getSystemUUID");
const crypto = require("crypto");
const log = require("electron-log");

const isDev = process.env.NODE_ENV === "development";

const SERVICE_NAME = "Cyphersol-dumm";
const LICENSE_KEY_ACCOUNT = "license-key";

// const API_URL = isDev ? "https://cyphersol-uat.duckdns.org/validate-offlineapp-login/" : process.env.API_URL || "https://cyphersol.co.in/validate-offlineapp-login/";
const API_URL = "https://cyphersol.co.in/validate-offlineapp-login/";

log.info("API URL : ", API_URL);

const toValidateLicense = process.env.VALIDATE_LICENSE == "true";
// const API_URL = "http://127.0.0.1/validate-offlineapp-login/";
// username : 2-32e6d741
// licensekey : SOMEX4Y4ZLicenseKEYForCAOffline

class LicenseManager {
  // Static instance to hold the single instance of the class
  static instance;

  constructor() {
    if (LicenseManager.instance) {
      return LicenseManager.instance;
    }

    this.isActivated = false;
    LicenseManager.instance = this; // Set the singleton instance
  }

  static getInstance() {
    if (!LicenseManager.instance) {
      LicenseManager.instance = new LicenseManager();
    }
    return LicenseManager.instance;
  }

  // Initialize method to check for existing license key
  async init() {
    try {
      const licenseKey = await keytar.getPassword(
        SERVICE_NAME,
        LICENSE_KEY_ACCOUNT
      );
      this.isActivated = !!licenseKey;
      return this.isActivated;
    } catch (error) {
      console.error("License check failed:", error);
      return false;
    }
  }

  async getLicenseKey() {
    try {
      const licenseKeyData = await keytar.getPassword(
        SERVICE_NAME,
        LICENSE_KEY_ACCOUNT
      );

      if (!licenseKeyData) {
        throw new Error("No license key found");
      }

      const { licenseKey, uuidHash } = JSON.parse(licenseKeyData);

      return { licenseKey, uuidHash };
    } catch (error) {
      console.error("License check failed:", error);
      return false;
    }
  }

  // Method to validate and store license key
  async storeLicense(credentials) {
    const uuidHash = await this.getHashedUUID();

    const licenseData = {
      licenseKey: credentials.licenseKey,
      uuidHash,
    };

    try {
      // const isValid = await this.validateLicense(
      //     credentials.licenseKey,
      //     credentials.email
      // );

      // if (isValid.success) {
      await keytar.setPassword(
        SERVICE_NAME,
        LICENSE_KEY_ACCOUNT,
        JSON.stringify(licenseData)
      );
      this.isActivated = true;
      return { success: true };
      // }

      // return {
      //     success: false,
      //     error: "Invalid license key",
      // };
    } catch (error) {
      return {
        success: false,
        error: "License storage failed",
      };
    }
  }

  calculateRemainingSeconds(expiryTimestamp) {
    // const expiryTimestamp = isValid.data.expiry_timestamp; // Get expiry timestamp from validation
    const currentTimestamp = Date.now() / 1000; // Current time in seconds

    // Calculate remaining seconds
    const remainingSeconds = Math.max(
      Math.floor(expiryTimestamp - currentTimestamp),
      0
    ); // Ensure non-negative value

    console.log("Remaining seconds for license:", remainingSeconds);

    return remainingSeconds;
  }

  // Hash UUID with salt to prevent reverse-engineering
  async getHashedUUID() {
    const uuid = await getSystemUUID();
    const salt = process.env.UUID_SALT || "default-salt"; // Use env variable!
    return crypto
      .createHash("sha256")
      .update(uuid + salt)
      .digest("hex");
  }

  async getHashedUUIDTest(uuid) {
    const salt = process.env.UUID_SALT || "default-salt"; // Use env variable!
    return crypto
      .createHash("sha256")
      .update(uuid + salt)
      .digest("hex");
  }

  async isValidUUIDHash(storedHash) {
    const computedHash = await this.getHashedUUID();
    // const salt = process.env.UUID_SALT || 'default-salt'; // Use the same salt
    // const computedHash = crypto.createHash('sha256').update(uuid + salt).digest('hex');

    return computedHash === storedHash;
  }

  // Placeholder method for validating the license key
  async validateLicense(
    licenseKey,
    username,
    uuidHash = null,
    isActivated = false
  ) {
    try {
      const timestamp = Date.now() / 1000;

      if (isActivated) {
        const isValid = await this.isValidUUIDHash(uuidHash);
        if (!isValid) {
          throw new Error("UUID Hash is invalid");
        }
      } else {
        uuidHash = await this.getHashedUUID();
      }

      if (toValidateLicense) {
        const payload = {
          username: username,
          license_key: licenseKey,
          timestamp: timestamp,
          is_activated: isActivated,
          uuid_hash: uuidHash,
        };

        const apiKey =
          "L4#gP93NEuzyXQFYAGk_KhY2SDHzJJ-O0fqFMlxJ46HZkNLtpdBI.CAgICAgICAk=";

        const response = await axios.post(API_URL, payload, {
          headers: {
            "X-API-Key": apiKey,
          },
        });

        const { data } = response;

        // Handle successful response
        if (response.status === 200) {
          const expiryTimestamp = data.expiry_timestamp;
          const currentTimestamp = Date.now() / 1000;

          // Check if the license has expired
          if (currentTimestamp > expiryTimestamp) {
            throw new Error("License key has expired");
          }

          return { success: true, data: data };
        } else {
          // Handle invalid license or username
          throw new Error(data.detail || "License validation failed");
        }
      } else {
        const data = {
          expiry_timestamp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // Current time in seconds + 30 days
        };

        return { success: true, data: data };
      }
    } catch (error) {
      // console.error(
      //     "License validation error: ",
      //     error.status,
      //     error.response.data
      // );
      // Handle different error cases based on API response
      log.info(error.code, "||", error.message);

      // Check Node.js specific error codes
      if (
        error.code === "ENOTFOUND" ||
        error.code === "ECONNREFUSED" ||
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "EHOSTUNREACH" ||
        error.code === "EAI_AGAIN" ||
        error.code === "EPIPE" ||
        (error.message && error.message.includes("Network Error"))
      ) {
        log.info("Network Error : ", error.code, "||", error.message);
        throw new Error(
          "We're having trouble connecting to our server. Please check your internet connection and try again. If the problem persists, contact our support team."
        );
      }

      if (error.response) {
        // The API returned an error response
        return {
          success: false,
          error: error.response.data.detail || "License validation failed",
        };
      } else if (error.request) {
        // No response received (possible network error)
        log.info("Network Error : ", error.code, "||", error.message);
        throw new Error(
          "We're having trouble connecting to our server. Please check your internet connection and try again. If the problem persists, contact our support team."
        );
      } else {
        // Some other error (e.g., misconfiguration or unexpected error)
        return { success: false, error: error.message };
      }
    }
  }

  // Method to check if the license is activated
  async checkActivation() {
    return this.isActivated;
  }
}

// // Export a single instance of the LicenseManager
// // const licenseManager = new LicenseManager().getInstance();
module.exports = LicenseManager.getInstance();
