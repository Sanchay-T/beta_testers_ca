const crypto = require("crypto");
const os = require("os")

const SALT = "YourSuperSalt!@#"; // Keep this safe
const ITERATIONS = 100_000;

function getMachineFingerprint() {
    return os.hostname() + os.userInfo().username;
}

function getKeys() {
    const fingerprint = getMachineFingerprint();
    const keyMaterial = crypto.pbkdf2Sync(
        fingerprint,
        Buffer.from(SALT, "utf8"),
        ITERATIONS,
        64, // We now want 64 bytes instead of 48
        "sha256"
    );

    const aesKey = keyMaterial.slice(0, 32);     // AES-256 key
    const iv = keyMaterial.slice(32, 48);        // 16-byte IV
    const hmacKey = keyMaterial.slice(48, 64);   // 16-byte HMAC key

    return { aesKey, iv, hmacKey };
}

function encryptData(plainText) {
    const { aesKey, iv, hmacKey } = getKeys();

    const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const encryptedBase64 = encrypted.toString("base64");

    const hmac = crypto.createHmac("sha256", hmacKey)
        .update(encryptedBase64)
        .digest("base64");

    return JSON.stringify({
        hmac,
        data: encryptedBase64
    });
}

function decryptData(jsonString) {
    const { aesKey, iv, hmacKey } = getKeys();

    let parsed;
    try {
        parsed = JSON.parse(jsonString);
    } catch (e) {
        throw new Error("Invalid encrypted format.");
    }

    const { hmac, data } = parsed;

    const computedHmac = crypto.createHmac("sha256", hmacKey)
        .update(data)
        .digest("base64");

    const hmacMatch = crypto.timingSafeEqual(
        Buffer.from(hmac, "base64"),
        Buffer.from(computedHmac, "base64")
    );

    if (!hmacMatch) {
        throw new Error("Data has been tampered with or corrupted.");
    }

    const encryptedText = Buffer.from(data, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);

    return decrypted.toString("utf8");
}

module.exports = {
    encryptData,
    decryptData
};
