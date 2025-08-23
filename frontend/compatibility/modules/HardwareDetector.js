// HardwareDetector.js
const os = require('os');
const si = require('systeminformation');
const { AppModeConfigManager } = require('../config/AppModeConfigManager');

class HardwareDetector {
  constructor(logger = null) {
    this.logger = logger;
    this.cachedSpecs = null;
    this.detectionTimestamp = null;
  }

  /**
   * Get complete system specifications
   * @param {boolean} forceRefresh - Force refresh cached data
   * @returns {Promise<Object>} System specifications
   */
  async getSystemSpecs(forceRefresh = false) {
    // Return cached data if available and not forcing refresh
    if (this.cachedSpecs && !forceRefresh) {
      this.logger?.info('HARDWARE_DETECTION', 'Using cached system specifications');
      return this.cachedSpecs;
    }

    try {
      const startTime = Date.now();
      this.logger?.info('HARDWARE_DETECTION', 'Starting hardware detection...');

      // Get basic info from os module
      const basicSpecs = this.getBasicSpecs();

      // Get detailed info from systeminformation
      const detailedSpecs = await this.getDetailedSpecs();

      // Apply testing overrides if in development mode
      const finalSpecs = this.applyTestingOverrides({
        ...basicSpecs,
        ...detailedSpecs,
        detectionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      this.cachedSpecs = finalSpecs;
      this.detectionTimestamp = Date.now();

      this.logger?.info('HARDWARE_DETECTION', 'Hardware detection completed', {
        detectionTime: finalSpecs.detectionTime,
        ram: finalSpecs.ram,
        cpu: finalSpecs.cpu.model,
        processorClass: finalSpecs.cpu.class
      });

      return finalSpecs;

    } catch (error) {
      this.logger?.error('HARDWARE_DETECTION', 'Failed to detect hardware', { error: error.message });
      return this.getFallbackSpecs();
    }
  }

  /**
   * Get basic system specs using Node.js os module
   * @returns {Object} Basic system specifications
   */
  getBasicSpecs() {
    const totalRAM = os.totalmem();
    const freeRAM = os.freemem();
    const cpus = os.cpus();

    return {
      ram: {
        total: Math.round(totalRAM / (1024 * 1024 * 1024) * 100) / 100, // GB with 2 decimals
        totalBytes: totalRAM,
        free: Math.round(freeRAM / (1024 * 1024 * 1024) * 100) / 100,
        freeBytes: freeRAM,
        used: Math.round((totalRAM - freeRAM) / (1024 * 1024 * 1024) * 100) / 100,
        unit: 'GB'
      },
      cpu: {
        model: cpus[0]?.model || 'Unknown CPU',
        cores: cpus.length,
        speed: cpus[0]?.speed || 0,
        architecture: os.arch()
      },
      platform: {
        type: os.type(),
        platform: os.platform(),
        release: os.release(),
        hostname: os.hostname()
      }
    };
  }

  /**
   * Get detailed system specs using systeminformation
   * @returns {Promise<Object>} Detailed system specifications
   */
  async getDetailedSpecs() {
    try {
      const [cpu, mem, system] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.system()
      ]);

      return {
        cpu: {
          ...this.cachedSpecs?.cpu || {},
          brand: cpu.brand,
          manufacturer: cpu.manufacturer,
          family: cpu.family,
          model: cpu.model,
          stepping: cpu.stepping,
          revision: cpu.revision,
          voltage: cpu.voltage,
          speedMax: cpu.speedMax,
          speedMin: cpu.speedMin,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          processors: cpu.processors,
          socket: cpu.socket,
          cache: cpu.cache,
          class: this.classifyProcessor(cpu.brand)
        },
        memory: {
          total: Math.round(mem.total / (1024 * 1024 * 1024) * 100) / 100,
          free: Math.round(mem.free / (1024 * 1024 * 1024) * 100) / 100,
          used: Math.round(mem.used / (1024 * 1024 * 1024) * 100) / 100,
          active: Math.round(mem.active / (1024 * 1024 * 1024) * 100) / 100,
          available: Math.round(mem.available / (1024 * 1024 * 1024) * 100) / 100,
          swapTotal: Math.round(mem.swaptotal / (1024 * 1024 * 1024) * 100) / 100,
          swapUsed: Math.round(mem.swapused / (1024 * 1024 * 1024) * 100) / 100
        },
        system: {
          manufacturer: system.manufacturer,
          model: system.model,
          version: system.version,
          serial: system.serial,
          uuid: system.uuid,
          sku: system.sku
        }
      };
    } catch (error) {
      this.logger?.warn('HARDWARE_DETECTION', 'Failed to get detailed specs, using basic specs only', { error: error.message });
      return {};
    }
  }

  /**
   * Classify processor based on brand/model
   * @param {string} cpuBrand - CPU brand string
   * @returns {string} Processor class (i3, i5, i7, i9, ryzen3, etc.)
   */
  classifyProcessor(cpuBrand) {
    if (!cpuBrand) return 'unknown';

    // Clean the brand string to handle encoding issues
    const brand = cpuBrand
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')  // Replace special chars with spaces
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();

    this.logger?.info('HARDWARE_DETECTION', 'CPU classification attempt', {
      originalBrand: cpuBrand,
      cleanedBrand: brand
    });

    // Intel processors (check for common patterns)
    if (brand.includes('intel') || brand.includes('core') || brand.match(/\bi[3579]\b/)) {
      if (brand.includes('i9') || brand.match(/\bi9\b/)) return 'i9';
      if (brand.includes('i7') || brand.match(/\bi7\b/)) return 'i7';
      if (brand.includes('i5') || brand.match(/\bi5\b/)) return 'i5';
      if (brand.includes('i3') || brand.match(/\bi3\b/)) return 'i3';
      if (brand.includes('celeron')) return 'celeron';
      if (brand.includes('pentium')) return 'pentium';
      if (brand.includes('atom')) return 'atom';
      if (brand.includes('xeon')) return 'xeon';
    }

    // AMD processors
    if (brand.includes('amd') || brand.includes('ryzen')) {
      if (brand.includes('ryzen 9') || brand.includes('ryzen9')) return 'ryzen9';
      if (brand.includes('ryzen 7') || brand.includes('ryzen7')) return 'ryzen7';
      if (brand.includes('ryzen 5') || brand.includes('ryzen5')) return 'ryzen5';
      if (brand.includes('ryzen 3') || brand.includes('ryzen3')) return 'ryzen3';
      if (brand.includes('threadripper')) return 'threadripper';
      if (brand.includes('epyc')) return 'epyc';
    }

    // Log unclassified processors for debugging
    this.logger?.warn('HARDWARE_DETECTION', 'CPU classification failed - defaulting to other', {
      originalBrand: cpuBrand,
      cleanedBrand: brand
    });

    return 'other';
  }

  /**
   * Apply testing overrides from configuration
   * @param {Object} specs - Original specifications
   * @returns {Object} Specifications with overrides applied
   */
  applyTestingOverrides(specs) {
    const config = AppModeConfigManager.getConfig();
    const overrides = config.testingOverrides || {};

    let modifiedSpecs = { ...specs };

    // Apply RAM override
    if (overrides.forceRAM && typeof overrides.forceRAM === 'number') {
      modifiedSpecs.ram.total = overrides.forceRAM;
      modifiedSpecs.memory = modifiedSpecs.memory || {};
      modifiedSpecs.memory.total = overrides.forceRAM;
      this.logger?.info('HARDWARE_DETECTION', `Applied RAM override: ${overrides.forceRAM}GB`);
    }

    // Apply CPU override
    if (overrides.forceCPU && typeof overrides.forceCPU === 'string') {
      modifiedSpecs.cpu.class = overrides.forceCPU;
      modifiedSpecs.cpu.model = `Overridden ${overrides.forceCPU.toUpperCase()} Processor`;
      this.logger?.info('HARDWARE_DETECTION', `Applied CPU override: ${overrides.forceCPU}`);
    }

    // Mark as overridden for debugging
    if (overrides.forceRAM || overrides.forceCPU) {
      modifiedSpecs.overridden = true;
      modifiedSpecs.originalSpecs = {
        ram: specs.ram.total,
        cpu: specs.cpu.class
      };
    }

    return modifiedSpecs;
  }

  /**
   * Check if system meets requirements for a specific mode
   * @param {string} mode - Mode to check ('fullMode' or 'hybridMode')
   * @param {Object} specs - System specifications (optional, will detect if not provided)
   * @returns {Promise<Object>} Requirements check result
   */
  async checkModeRequirements(mode, specs = null) {
    if (!specs) {
      specs = await this.getSystemSpecs();
    }

    const config = AppModeConfigManager.getConfig();
    const requirements = config.hardwareThresholds[mode];

    if (!requirements) {
      return { meets: false, reason: 'Invalid mode specified' };
    }

    const result = {
      meets: false,
      mode: mode,
      checks: {},
      reason: '',
      specs: {
        ram: specs.ram?.total || specs.memory?.total || 0,
        cpu: specs.cpu?.class || 'unknown'
      }
    };

    if (mode === 'fullMode') {
      // Check RAM requirement
      const ramMeets = (specs.ram?.total || specs.memory?.total || 0) >= requirements.minRAM;
      result.checks.ram = {
        required: `>= ${requirements.minRAM}GB`,
        actual: `${specs.ram?.total || specs.memory?.total || 0}GB`,
        meets: ramMeets
      };

      // Check CPU requirement
      const cpuClass = specs.cpu?.class || 'unknown';
      const cpuMeets = this.compareCPU(cpuClass, requirements.minProcessor);
      result.checks.cpu = {
        required: `>= ${requirements.minProcessor}`,
        actual: cpuClass,
        meets: cpuMeets
      };

      result.meets = ramMeets && cpuMeets;
      if (!result.meets) {
        const failedChecks = [];
        if (!ramMeets) failedChecks.push('RAM');
        if (!cpuMeets) failedChecks.push('CPU');
        result.reason = `Insufficient ${failedChecks.join(' and ')}`;
      }
    }

    this.logger?.info('HARDWARE_DETECTION', `Mode requirements check: ${mode}`, {
      meets: result.meets,
      reason: result.reason,
      checks: result.checks
    });

    return result;
  }

  /**
   * Compare CPU class against minimum requirement
   * @param {string} actualCPU - Detected CPU class
   * @param {string} requiredCPU - Required CPU class
   * @returns {boolean} Whether CPU meets requirement
   */
  compareCPU(actualCPU, requiredCPU) {
    const cpuHierarchy = {
      'unknown': 0,
      'atom': 1,
      'celeron': 2,
      'pentium': 3,
      'i3': 4,
      'ryzen3': 4,
      'i5': 5,
      'ryzen5': 5,
      'i7': 6,
      'ryzen7': 6,
      'i9': 7,
      'ryzen9': 7,
      'xeon': 8,
      'threadripper': 8,
      'epyc': 9
    };

    const actualScore = cpuHierarchy[actualCPU.toLowerCase()] || 0;
    const requiredScore = cpuHierarchy[requiredCPU.toLowerCase()] || 0;

    return actualScore >= requiredScore;
  }

  /**
   * Get fallback specifications if detection fails
   * @returns {Object} Fallback specifications
   */
  getFallbackSpecs() {
    this.logger?.warn('HARDWARE_DETECTION', 'Using fallback specifications');
    return {
      ram: { total: 4, unit: 'GB' },
      cpu: { class: 'unknown', model: 'Unknown Processor', cores: 2 },
      platform: { type: 'Unknown', platform: process.platform },
      fallback: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear cached specifications
   */
  clearCache() {
    this.cachedSpecs = null;
    this.detectionTimestamp = null;
    this.logger?.info('HARDWARE_DETECTION', 'Hardware detection cache cleared');
  }

  /**
   * Force refresh hardware specs with improved CPU detection
   * @returns {Promise<Object>} Fresh system specifications
   */
  async forceRefresh() {
    this.logger?.info('HARDWARE_DETECTION', 'Forcing hardware detection refresh with improved CPU classification');
    this.clearCache();
    return await this.getSystemSpecs(true);
  }
}

module.exports = { HardwareDetector };