// AppModeConfigManager.js
const fs = require('fs');
const path = require('path');

class AppModeConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, 'appModeConfig.json');
    this.config = null;
    this.isLoaded = false;
  }

  /**
   * Load configuration from JSON file
   * @returns {Object} Configuration object
   */
  loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      this.isLoaded = true;

      // Validate configuration structure
      this.validateConfig();

      return this.config;
    } catch (error) {
      console.error('❌ Failed to load app mode configuration:', error.message);
      return this.getDefaultConfig();
    }
  }

  /**
   * Save configuration to JSON file
   * @param {Object} newConfig - Updated configuration
   */
  saveConfig(newConfig) {
    try {
      // Update timestamp
      newConfig.lastUpdated = new Date().toISOString().split('T')[0];
      
      // Validate before saving
      this.config = newConfig;
      this.validateConfig();

      // Write to file with proper formatting
      fs.writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2), 'utf8');
      
      console.log('✅ Configuration saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to save configuration:', error.message);
      return false;
    }
  }

  /**
   * Get current configuration (load if not already loaded)
   * @returns {Object} Configuration object
   */
  getConfig() {
    if (!this.isLoaded) {
      return this.loadConfig();
    }
    return this.config;
  }

  /**
   * Get hardware thresholds for a specific mode
   * @param {string} mode - Mode name ('fullMode' or 'hybridMode')
   * @returns {Object} Hardware thresholds
   */
  getHardwareThresholds(mode) {
    const config = this.getConfig();
    return config.hardwareThresholds[mode] || {};
  }

  /**
   * Check if development mode is enabled
   * @returns {boolean} Development mode status
   */
  isDevelopmentMode() {
    const config = this.getConfig();
    return config.developmentMode?.enabled || false;
  }

  /**
   * Get testing overrides
   * @returns {Object} Testing override values
   */
  getTestingOverrides() {
    const config = this.getConfig();
    return config.testingOverrides || {};
  }

  /**
   * Apply testing override
   * @param {string} key - Override key
   * @param {any} value - Override value
   */
  setTestingOverride(key, value) {
    const config = this.getConfig();
    if (!config.testingOverrides) {
      config.testingOverrides = {};
    }
    config.testingOverrides[key] = value;
    this.saveConfig(config);
  }

  /**
   * Reset all testing overrides
   */
  resetTestingOverrides() {
    const config = this.getConfig();
    config.testingOverrides = {
      forceRAM: null,
      forceCPU: null,
      forceScanResult: null,
      forceMode: null,
      simulateSlowScan: false
    };
    this.saveConfig(config);
  }

  /**
   * Get user experience messages
   * @returns {Object} User experience configuration
   */
  getUserExperience() {
    const config = this.getConfig();
    return config.userExperience || {};
  }

  /**
   * Get testing scenarios
   * @returns {Object} Testing scenarios
   */
  getTestingScenarios() {
    const config = this.getConfig();
    return config.testing?.scenarios || {};
  }

  /**
   * Validate configuration structure
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    const config = this.config;
    
    if (!config) {
      throw new Error('Configuration is null or undefined');
    }

    // Check required sections
    const requiredSections = ['hardwareThresholds', 'userExperience', 'storage'];
    for (const section of requiredSections) {
      if (!config[section]) {
        throw new Error(`Missing required configuration section: ${section}`);
      }
    }

    // Validate hardware thresholds
    const thresholds = config.hardwareThresholds;
    if (!thresholds.fullMode || !thresholds.hybridMode) {
      throw new Error('Missing hardware threshold modes');
    }

    // Validate numeric values
    if (typeof thresholds.fullMode.minRAM !== 'number' || thresholds.fullMode.minRAM <= 0) {
      throw new Error('Invalid minRAM value for fullMode');
    }

    if (typeof thresholds.fullMode.scanTestTimeout !== 'number' || thresholds.fullMode.scanTestTimeout <= 0) {
      throw new Error('Invalid scanTestTimeout value');
    }

    console.log('✅ Configuration validation passed');
  }

  /**
   * Get default configuration if loading fails
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    console.log('⚠️ Using default configuration');
    return {
      version: "1.0.0",
      developmentMode: { enabled: true, showTestingPanel: true },
      hardwareThresholds: {
        fullMode: { minRAM: 8, minProcessor: "i5", scanTestTimeout: 30000 },
        hybridMode: { maxRAM: 8, maxProcessor: "i5" }
      },
      userExperience: {
        hybridModeFlow: {
          messages: {
            lowSpecWarning: "This PC requires hybrid mode",
            alternativePCQuestion: "Do you have another PC?",
            paymentRequired: "Hybrid mode requires subscription"
          }
        }
      },
      storage: { decisionFile: "appModeDecision.json" }
    };
  }

  /**
   * Export configuration for debugging
   * @returns {string} JSON string of configuration
   */
  exportConfig() {
    const config = this.getConfig();
    return JSON.stringify(config, null, 2);
  }
}

// Export singleton instance
module.exports = { AppModeConfigManager: new AppModeConfigManager() };