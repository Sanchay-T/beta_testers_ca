const fs = require("fs");
const path = require("path");

const DEFAULT_IDLE_THRESHOLD_MS = 2 * 60 * 1000;

class ActiveTimeTracker {
  constructor({ userDataPath, idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS } = {}) {
    if (!userDataPath) {
      throw new Error("ActiveTimeTracker requires userDataPath");
    }
    this.filePath = path.join(userDataPath, "user-activity.json");
    this.idleThresholdMs = idleThresholdMs;
    this.state = {
      totalMs: 0,
      sessionStart: null,
      lastInteraction: 0,
    };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf8");
        const parsed = JSON.parse(raw);
        this.state = {
          totalMs: Number(parsed.totalMs) || 0,
          sessionStart: parsed.sessionStart || null,
          lastInteraction: Number(parsed.lastInteraction) || 0,
        };
      }
    } catch (error) {
      // If the file is corrupt, start fresh but avoid throwing.
      this.state = {
        totalMs: 0,
        sessionStart: null,
        lastInteraction: 0,
      };
    }
  }

  _persist() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(this.state, null, 2),
        "utf8"
      );
    } catch (error) {
      // Swallow persist errors; metrics uploads should continue even if we can't save.
    }
  }

  markActive(timestamp = Date.now()) {
    if (!this.state.sessionStart) {
      this.state.sessionStart = timestamp;
    }
    this.state.lastInteraction = timestamp;
    this._persist();
  }

  maybePause(timestamp = Date.now()) {
    if (!this.state.sessionStart) {
      return;
    }
    const idleTime = timestamp - this.state.lastInteraction;
    if (idleTime >= this.idleThresholdMs) {
      this.state.totalMs += this.state.lastInteraction - this.state.sessionStart;
      this.state.sessionStart = null;
      this._persist();
    }
  }

  finalizeSession(timestamp = Date.now()) {
    if (!this.state.sessionStart) {
      return;
    }
    this.state.totalMs += timestamp - this.state.sessionStart;
    this.state.sessionStart = null;
    this.state.lastInteraction = timestamp;
    this._persist();
  }

  getTotals(timestamp = Date.now()) {
    let total = this.state.totalMs;
    if (this.state.sessionStart) {
      total += timestamp - this.state.sessionStart;
    }
    return {
      totalMinutes: Math.round(total / 60000),
      rawMillis: total,
    };
  }
}

module.exports = ActiveTimeTracker;
