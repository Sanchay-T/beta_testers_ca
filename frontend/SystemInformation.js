const axios = require("axios");
const { getSystemUUID } = require("./utils/getSystemUUID")
const crypto = require("crypto");
const log = require("electron-log");

// username : 2-32e6d741
// licensekey : SOMEX4Y4ZLicenseKEYForCAOffline

class SystemInformation {
    // Static instance to hold the single instance of the class
    static instance;

    constructor() {
        if (SystemInformation.instance) {
            return SystemInformation.instance;
        }

        SystemInformation.instance = this; // Set the singleton instance
    }

    static getInstance() {
        if (!SystemInformation.instance) {
            SystemInformation.instance = new SystemInformation();
        }
        return SystemInformation.instance;
    }

   

    // Hash UUID with salt to prevent reverse-engineering
    async getHashedUUID() {
        const uuid = await getSystemUUID();
        const salt = process.env.UUID_SALT || 'default-salt'; // Use env variable!
        log.info("UUID Salt:", salt);
        return crypto.createHash('sha256').update(uuid + salt).digest('hex');
    }


    // async isValidUUIDHash(storedHash) {
    //     const computedHash = await this.getHashedUUID();
    //     log.info("Stoede UUID Hash:", storedHash);
    //     log.info("UUID Computed:", computedHash);
    //     // const salt = process.env.UUID_SALT || 'default-salt'; // Use the same salt
    //     // const computedHash = crypto.createHash('sha256').update(uuid + salt).digest('hex');

    //     return computedHash === storedHash;
    // }

}

// // Export a single instance of the LicenseManager
// // const licenseManager = new LicenseManager().getInstance();
module.exports = SystemInformation.getInstance();