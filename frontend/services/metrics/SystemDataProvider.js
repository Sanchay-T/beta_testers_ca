const os = require("os");
const log = require("electron-log");
const systemInformation = require("../../SystemInformation");

class SystemDataProvider {
  constructor({ logger = log } = {}) {
    this.logger = logger;
    this.loaded = false;
  }

  async ensureLoaded(userDataPath) {
    if (this.loaded) {
      return;
    }
    try {
      await systemInformation.loadData(userDataPath);
      this.loaded = true;
    } catch (error) {
      this.logger.error("Metrics: failed to load system information", error);
    }
  }

  getDeviceSnapshot() {
    const hostname = systemInformation.getHostname() || os.hostname();
    const sid = systemInformation.getWindowsUserSID();
    const totalMemoryBytes = systemInformation.getTotalMemory() || os.totalmem();
    const totalRamGb = totalMemoryBytes / 1024 / 1024 / 1024;

    return {
      deviceId: sid || hostname,
      hostname,
      osPlatform: os.platform(),
      osRelease: os.release(),
      architecture: os.arch(),
      totalRamGb: totalRamGb || 0,
      cpuModel: systemInformation.getCPUModel() || this.getFallbackCpuModel(),
      compatibilityMode: this.getCompatibilityMode(),
    };
  }

  getFallbackCpuModel() {
    const cpus = os.cpus();
    if (cpus && cpus.length) {
      return cpus[0].model;
    }
    return "unknown";
  }

  getCompatibilityMode() {
    const requirements = systemInformation.getSystemRequirementsCheck();
    if (requirements && requirements.mode) {
      return requirements.mode;
    }
    return "UNKNOWN";
  }
}

module.exports = SystemDataProvider;
