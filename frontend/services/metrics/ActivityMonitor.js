const { powerMonitor } = require("electron");
const ActiveTimeTracker = require("./ActiveTimeTracker");

class ActivityMonitor {
  constructor({
    ipcMain,
    userDataPath,
    idleThresholdMs,
    idleCheckIntervalMs = 30 * 1000,
    shouldTrack = () => true,
  } = {}) {
    if (!ipcMain) {
      throw new Error("ActivityMonitor requires ipcMain");
    }
    this.ipcMain = ipcMain;
    this.tracker = new ActiveTimeTracker({ userDataPath, idleThresholdMs });
    this.idleCheckIntervalMs = idleCheckIntervalMs;
    this.shouldTrack = shouldTrack;

    this._registerIpcChannels();
    this._registerPowerEvents();
    this._startIdleTimer();
  }

  attachToWindow(win) {
    if (!win) {
      return;
    }
    win.on("focus", () => this.markActive());
    win.on("restore", () => this.markActive());
    win.on("blur", () => this.maybePause());
    win.on("minimize", () => this.maybePause());
    win.on("hide", () => this.maybePause());
    win.on("show", () => this.markActive());

    win.once("closed", () => {
      this.finalizeSession({ force: true });
    });
  }

  markActive() {
    if (!this.shouldTrack()) {
      return;
    }
    this.tracker.markActive();
  }

  maybePause() {
    if (!this.shouldTrack()) {
      return;
    }
    this.tracker.maybePause();
  }

  finalizeSession({ force = false } = {}) {
    if (!force && !this.shouldTrack()) {
      return;
    }
    this.tracker.finalizeSession();
  }

  getTotals() {
    return this.tracker.getTotals();
  }

  dispose() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
    this.ipcMain.removeAllListeners("user-activity:ping");
    this.ipcMain.removeAllListeners("user-activity:hidden");
    powerMonitor.removeListener("user-active", this._powerActiveHandler);
    powerMonitor.removeListener("user-idle", this._powerIdleHandler);
  }

  _registerIpcChannels() {
    this.ipcMain.on("user-activity:ping", () => {
      this.markActive();
    });

    this.ipcMain.on("user-activity:hidden", () => {
      this.maybePause();
    });
  }

  _registerPowerEvents() {
    this._powerActiveHandler = () => this.markActive();
    this._powerIdleHandler = () => this.maybePause();
    powerMonitor.on("user-active", this._powerActiveHandler);
    powerMonitor.on("user-idle", this._powerIdleHandler);
  }

  _startIdleTimer() {
    this.idleTimer = setInterval(() => {
      this.maybePause();
    }, this.idleCheckIntervalMs);
    if (this.idleTimer && typeof this.idleTimer.unref === "function") {
      this.idleTimer.unref();
    }
  }
}

module.exports = { ActivityMonitor };
