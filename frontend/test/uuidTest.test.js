// test/uuidTest.test.mjs
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const minimist = require('minimist');
const crypto = require("crypto");
const LicenseManager = require('../LicenseManager'); // Adjust the path as needed

// Parse command-line arguments for UUID and expected hash
const args = minimist(process.argv.slice(2));
const testUuid = args.uu || "723A2D01-54FF-11CB-B900-95BEA0D4A45F";
const expectedHash = args.eh || "92e984220520b519847acd0f344b0b513038447684af0dd3e9ac4ea7ab3edb89";

let expect;

describe('LicenseManager - getTestingUUID with passed arguments', function () {
    // Increase timeout if necessary
    this.timeout(5000);

    before(async function () {
        // Dynamically import Chai
        const chaiModule = await import('chai');
        expect = chaiModule.expect;
    });

    it('should return the expected hash for the provided test UUID', async function () {

        // Compute the hash using the provided test UUID (converted to lowercase) and salt.
        const lmHash = await LicenseManager.getHashedUUIDTest(testUuid.toLowerCase());
        expect(lmHash).to.equal(expectedHash);

        // Log all details
        console.log("Test UUID:", testUuid);
        console.log("Expected Hash:", expectedHash);
        console.log("Computed Hash:", lmHash);

        // Final output message indicating success
        if (lmHash === expectedHash) {
            console.log("Success: Generated UUID hash matches the expected hash.");
        } else {
            console.log("Failure: Generated UUID hash does not match the expected hash.");
        }
    });
});
