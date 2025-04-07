import { ipcMain, app } from "electron";
import axios from "axios";
import fs from "fs/promises";
import crypto from "crypto";
import os from "os";
import path from "path";

const SALT = "YourSuperSalt!@#";
const ITERATIONS = 100_000;

function getMachineFingerprint() {
    return os.hostname() + os.userInfo().username;
}

async function encryptLicenseData(plainText) {

    const fingerprint = getMachineFingerprint();
    const keyMaterial = crypto.pbkdf2Sync(
        fingerprint,
        Buffer.from(SALT, "utf8"),
        ITERATIONS,
        48, // 32 bytes key + 16 bytes IV
        "sha256"
    );

    const key = keyMaterial.slice(0, 32);
    const iv = keyMaterial.slice(32, 48);

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    return encrypted;
}
