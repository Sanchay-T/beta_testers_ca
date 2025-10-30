const axios = require("axios");
const { promisify } = require("util");
const zlib = require("zlib");
const log = require("electron-log");

const gzipAsync = promisify(zlib.gzip);
const DEFAULT_TIMEOUT_MS = 10_000;

class MetricsUploader {
  constructor({
    endpoint,
    token,
    testKey,
    logger = log,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.logger = logger;
    this.endpoint =
      endpoint || process.env.METRICS_ENDPOINT || "https://cyphersol.co.in/api/metrics/ingest/";
    this.token = token || process.env.METRICS_AUTH_TOKEN || null;
    this.testKey = testKey || process.env.METRICS_TEST_KEY || null;
    this.timeoutMs = timeoutMs;
  }

  setEndpoint(endpoint) {
    if (endpoint) {
      this.endpoint = endpoint;
    }
  }

  setToken(token) {
    this.token = token;
  }

  setTestKey(testKey) {
    this.testKey = testKey;
  }

  async upload(payload) {
    if (!this.endpoint) {
      throw new Error("Metrics: endpoint URL is not configured");
    }
    if (!payload) {
      throw new Error("Metrics: payload is empty");
    }

    const json = JSON.stringify(payload);
    const compressed = await gzipAsync(Buffer.from(json, "utf8"));

    const headers = {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      "Content-Length": compressed.length,
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    if (this.testKey) {
      headers["x-api-key"] = this.testKey;
    }

    try {
      const response = await axios.post(this.endpoint, compressed, {
        headers,
        timeout: this.timeoutMs,
      });
      this.logger.info("Metrics: upload successful", {
        status: response.status,
        endpoint: this.endpoint,
      });
      return {
        success: true,
        status: response.status,
      };
    } catch (error) {
      const status = error.response?.status || null;
      this.logger.error("Metrics: upload failed", {
        message: error.message,
        status,
        endpoint: this.endpoint,
      });
      return {
        success: false,
        status,
        error: error.message,
      };
    }
  }
}

module.exports = MetricsUploader;
