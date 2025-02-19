const keytar = require("keytar");
const axios = require("axios");
const { getSystemUUID } = require("./utils/getSystemUUID");
const crypto = require("crypto");
const log = require("electron-log");
const { uuid } = require("systeminformation");

const SERVICE_NAME = "Cyphersol-dumm";
const LICENSE_KEY_ACCOUNT = "license-key";
const API_URL = "https://cyphersol-uat.duckdns.org/validate-offlineapp-login/";
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
      console.log("Init licenseKey:", licenseKey);
      this.isActivated = !!licenseKey;
      console.log("Init isActivated:", this.isActivated);
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
    console.log("UUID Hash in storing:", uuidHash);

    const licenseData = {
      licenseKey: credentials.licenseKey,
      uuidHash,
    };

    try {
      console.log("Credentials:", credentials);
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
      console.log("License storage error:", error);
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
    log.info("UUID Salt:", salt);
    return crypto
      .createHash("sha256")
      .update(uuid + salt)
      .digest("hex");
  }

  async isValidUUIDHash(storedHash) {
    const computedHash = await this.getHashedUUID();
    log.info("Stoede UUID Hash:", storedHash);
    log.info("UUID Computed:", computedHash);
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
        log.info("UUID Hash is valid");
      } else {
        uuidHash = await this.getHashedUUID();
      }

      const payload = {
        username: username,
        license_key: licenseKey,
        timestamp: timestamp,
        is_activated: isActivated,
        uuid_hash: uuidHash,
      };
      // const apiKey =
      //     "U08fir-OsEXdgMZKARdgz5oPvyRT6cIZioOeV_kZdLMeXsAc46_x.CAgICAgICAo=";
      const apiKey =
        "L4#gP93NEuzyXQFYAGk_KhY2SDHzJJ-O0fqFMlxJ46HZkNLtpdBI.CAgICAgICAk=";

      const response = await axios.post(API_URL, payload, {
        headers: {
          "X-API-Key": apiKey,
        },
      });

      // console.log("License Validation Response : ", response);
      const { data } = response;
      console.log("Response Status : ", response.status);
      console.log("Data : ", data);

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
    } catch (error) {
      console.error(
        "License validation error: ",
        error.status,
        error.response.data
      );
      // Handle different error cases based on API response
      if (error.response) {
        // The API returned an error response
        return {
          success: false,
          error: error.response.data.detail || "License validation failed",
        };
      } else if (error.request) {
        // No response received (possible network error)
        return {
          success: false,
          error: "No response from the license validation server",
        };
      } else {
        // Some other error (e.g., misconfiguration or unexpected error)
        return { success: false, error: error.message };
      }
    }
  }

  // Method to check if the license is activated
  async checkActivation() {
    console.log("isActivated:", this.isActivated);
    return this.isActivated;
  }
}

// // Export a single instance of the LicenseManager
// // const licenseManager = new LicenseManager().getInstance();
module.exports = LicenseManager.getInstance();
