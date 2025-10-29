const crypto = require("crypto");
const path = require("path");

const DEFAULT_SALT = "cypheredge";
const MAX_FILE_NAME_LENGTH = 120;

function getSalt() {
  const salt = process.env.METRICS_HASH_SALT;
  if (salt && salt.trim().length >= 6) {
    return salt.trim();
  }
  return DEFAULT_SALT;
}

function hashValue(value, { lowerCase = false } = {}) {
  if (!value) {
    return null;
  }
  const salt = getSalt();
  const normalized = lowerCase ? String(value).toLowerCase() : String(value);
  return crypto
    .createHash("sha256")
    .update(`${normalized}${salt}`, "utf8")
    .digest("hex");
}

function hashEmail(email) {
  return hashValue(email, { lowerCase: true });
}

function hashLicenseKey(key) {
  return hashValue(key, { lowerCase: true });
}

function hashDeviceId(deviceId) {
  return hashValue(deviceId, { lowerCase: false });
}

function sanitizeFileName(filePath) {
  if (!filePath) {
    return "";
  }
  const base = path.basename(filePath);
  if (base.length <= MAX_FILE_NAME_LENGTH) {
    return base;
  }
  return `${base.slice(0, MAX_FILE_NAME_LENGTH - 3)}...`;
}

function truncateText(text, maxLength = 500) {
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function toISO(timestamp) {
  if (!timestamp) {
    return null;
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === "number") {
    if (timestamp > 3_000_000_000_000) {
      return new Date(timestamp).toISOString();
    }
    return new Date(timestamp * 1000).toISOString();
  }
  const parsed = Number(timestamp);
  if (!Number.isNaN(parsed)) {
    return toISO(parsed);
  }
  const date = new Date(timestamp);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }
  return null;
}

function roundTo(value, decimals = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

module.exports = {
  hashValue,
  hashEmail,
  hashLicenseKey,
  hashDeviceId,
  sanitizeFileName,
  truncateText,
  toISO,
  roundTo,
};
