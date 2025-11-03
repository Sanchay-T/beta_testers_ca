const fs = require("fs");
const path = require("path");
const os = require("os");
const log = require("electron-log");

const DEFAULT_LIMIT = 20;

let electronApp = null;
try {
  const electron = require("electron");
  electronApp = electron?.app || null;
} catch (_) {
  electronApp = null;
}

function resolveQueueFile(customPath) {
  if (customPath) {
    return customPath;
  }

  const userDataDir =
    electronApp && typeof electronApp.getPath === "function"
      ? electronApp.getPath("userData")
      : null;

  if (userDataDir) {
    return path.join(userDataDir, "metrics-queue.json");
  }

  return path.join(os.tmpdir(), "cypheredge-metrics-queue.json");
}

function safeReadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    log.warn("Metrics: failed to read queue file, resetting", {
      filePath,
      error: error.message,
    });
    return [];
  }
}

function safeWriteJSON(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    log.error("Metrics: failed to write queue file", {
      filePath,
      error: error.message,
    });
    throw error;
  }
}

class MetricsQueue {
  constructor({ limit = DEFAULT_LIMIT, logger = log, filePath } = {}) {
    this.logger = logger;
    this.limit = limit;
    this.filePath = resolveQueueFile(filePath);
  }

  getPending() {
    return safeReadJSON(this.filePath);
  }

  save(pending) {
    safeWriteJSON(this.filePath, pending);
  }

  enqueue(payload) {
    const entry = {
      payload,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    const pending = this.getPending();
    pending.push(entry);
    while (pending.length > this.limit) {
      pending.shift();
    }
    this.save(pending);
    this.logger.info(
      `Metrics: queued payload. pending=${pending.length}, limit=${this.limit}`
    );
    return pending.length;
  }

  peek() {
    const pending = this.getPending();
    return pending[0] || null;
  }

  shift() {
    const pending = this.getPending();
    const removed = pending.shift();
    this.save(pending);
    this.logger.info(
      `Metrics: removed payload from queue. pending=${pending.length}`
    );
    return removed || null;
  }

  incrementAttempts() {
    const pending = this.getPending();
    if (!pending.length) {
      return 0;
    }
    pending[0].attempts += 1;
    if (pending[0].payload && pending[0].payload.meta) {
      pending[0].payload.meta.upload_attempts = pending[0].attempts;
    }
    this.save(pending);
    return pending[0].attempts;
  }

  clear() {
    this.save([]);
  }
}

module.exports = MetricsQueue;
