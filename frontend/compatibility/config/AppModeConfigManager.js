// AppModeConfigManager.js
const fs = require('fs');
const path = require('path');
const pathResolver = require('../utils/PathResolver');

class AppModeConfigManager {
  constructor() {
    // Use the centralized path resolver for robust path resolution
    const configDir = pathResolver.getConfigDir();
    const tempConfigPath = path.join(configDir, 'temp_appModeConfig.json');
    const mainConfigPath = path.join(configDir, 'appModeConfig.json');
    
    // Ensure config directory exists
    pathResolver.ensureDir(configDir);
    
    // Check if config file exists, create if needed
    if (!fs.existsSync(mainConfigPath) && !fs.existsSync(tempConfigPath)) {
      console.log(`⚠️ [CONFIG] Config file not found, creating default at: ${configDir}`);
      this.createDefaultConfigFile(configDir);
    }
    
    this.configPath = fs.existsSync(tempConfigPath) ? tempConfigPath : mainConfigPath;
    this.config = null;
    this.isLoaded = false;
    
    console.log(`🧪 [CONFIG] Using config file: ${this.configPath}`);
  }

  /**
   * Create default config file if it doesn't exist
   * @param {string} configDir - Directory to create config in
   */
  createDefaultConfigFile(configDir) {
    try {
      const configPath = path.join(configDir, 'appModeConfig.json');
      const defaultConfig = this.getDefaultConfig();
      
      // Ensure directory exists
      pathResolver.ensureDir(configDir);
      
      // Write default config
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      console.log(`✅ [CONFIG] Created default config file at: ${configPath}`);
    } catch (error) {
      console.error(`❌ [CONFIG] Failed to create default config file:`, error.message);
    }
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

      // Debug log which config is being used
      const configType = this.configPath.includes('temp_') ? 'TEMP (scenario testing)' : 'MAIN';
      console.log(`🧪 [CONFIG] Using ${configType} config: ${path.basename(this.configPath)}`);
      
      if (configType === 'TEMP (scenario testing)') {
        console.log(`🧪 [CONFIG] Temp config overrides:`, this.config.testingOverrides);
      }

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
    // Always check for temp config in case it was created after instantiation
    const configDir = pathResolver.getConfigDir();
    const tempConfigPath = path.join(configDir, 'temp_appModeConfig.json');
    const mainConfigPath = path.join(configDir, 'appModeConfig.json');
    const currentBestPath = fs.existsSync(tempConfigPath) ? tempConfigPath : mainConfigPath;
    
    // Reload if path changed or not loaded yet
    if (!this.isLoaded || this.configPath !== currentBestPath) {
      this.configPath = currentBestPath;
      this.loadConfig();
    }

    // Create a copy of the config to avoid modifying the original
    const config = JSON.parse(JSON.stringify(this.config));
    
    // Override development mode based on NODE_ENV
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      // Force disable development mode in production
      config.developmentMode = {
        enabled: false,
        showTestingPanel: false,
        testingOverrides: {}
      };
      
      // Clear any testing overrides to ensure real hardware detection
      config.testingOverrides = {};
      
      console.log('🚀 [CONFIG] NODE_ENV=production detected - disabling development features');
      console.log('🚀 [CONFIG] Testing panel, scenarios, and overrides disabled');
      console.log('🚀 [CONFIG] Using real hardware detection for mode classification');
    } else {
      // Development mode - use config as-is
      console.log('🧪 [CONFIG] NODE_ENV=development - testing features enabled');
    }
    
    return config;
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
      lastUpdated: new Date().toISOString().split('T')[0],
      environment: "development",
      description: "Auto-generated default configuration for app mode detection and classification",
      developmentMode: {
        enabled: false,
        showTestingPanel: false,
        autoLaunch: true,
        allowOverrides: false,
        verboseLogging: false,
        debugInfo: false
      },
      hardwareThresholds: {
        fullMode: {
          minRAM: 8,
          minRAMUnit: "GB",
          minProcessor: "i5",
          processorTypes: ["i5", "i7", "i9", "ryzen5", "ryzen7", "ryzen9"],
          scanTestTimeout: 30000,
          scanTestTimeoutUnit: "ms",
          description: "Requirements for full offline mode with ML scanning"
        },
        hybridMode: {
          maxRAM: 8,
          maxRAMUnit: "GB",
          maxProcessor: "i5",
          lowEndProcessors: ["i3", "celeron", "pentium", "atom", "ryzen3"],
          description: "Low-end hardware requiring cloud-assisted processing"
        }
      },
      testingOverrides: {
        forceRAM: null,
        forceCPU: null,
        forceScanResult: null,
        forceMode: null,
        simulateSlowScan: false
      },
      userExperience: {
        hybridModeFlow: {
          timeouts: {
            alternativePCPrompt: 15000,
            paymentScreen: 0
          },
          messages: {
            lowSpecWarning: "This PC requires hybrid mode upgrade for optimal CypherEdge performance",
            alternativePCQuestion: "Do you have another PC or system available?",
            alternativePCAdvice: "Please try running CypherEdge on your other system for better performance",
            paymentRequired: "Hybrid mode requires a subscription. Scan the QR code to connect with our support team.",
            paymentInstructions: "After payment, contact support to enable hybrid mode for this system."
          },
          qrCode: {
            paymentUrl: "upi://pay?pa=support@cyphersol.co.in&pn=CypherEdge%20Support&am=2499&cu=INR",
            supportContact: "support@cyphersol.co.in",
            supportPhone: "+91-XXXX-XXXX-XX"
          }
        },
        notifications: {
          scanModeEnabled: "✅ SCAN MODE: Full offline processing with ML scanning enabled",
          unscanModeEnabled: "⚡ UNSCAN MODE: Lightweight offline processing (ML scanning disabled)",
          hybridModeRequired: "🔄 HYBRID MODE: Cloud-assisted processing required for this hardware"
        }
      },
      logging: {
        captureSystemSpecs: true,
        captureTestResults: true,
        captureTimings: true,
        captureUserChoices: true,
        emailReporting: false,
        detailedDebugLogs: true
      },
      storage: {
        decisionFile: "appModeDecision.json",
        logFile: "appModeDetection.log",
        backupCount: 10
      },
      testing: {
        scenarios: {
          lowEnd: {
            name: "Low-End PC (HYBRID Mode)",
            hardwareProfile: { ram: 4, processor: "i3" },
            expectedMode: "HYBRID"
          },
          midRange: {
            name: "Mid-Range PC (UNSCAN Mode)",
            hardwareProfile: { ram: 8, processor: "i5" },
            expectedMode: "UNSCAN"
          },
          highEnd: {
            name: "High-End PC (SCAN Mode)",
            hardwareProfile: { ram: 16, processor: "i7" },
            expectedMode: "SCAN"
          }
        }
      }
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

// Create and export singleton instance with static-like access
const configManagerInstance = new AppModeConfigManager();

// Export both the class and instance with static-like methods
module.exports = {
  AppModeConfigManager: {
    // Static-like methods that delegate to the singleton instance
    getConfig: () => configManagerInstance.getConfig(),
    saveConfig: (config) => configManagerInstance.saveConfig(config),
    getHardwareThresholds: (mode) => configManagerInstance.getHardwareThresholds(mode),
    isDevelopmentMode: () => configManagerInstance.isDevelopmentMode(),
    setTestingOverride: (key, value) => configManagerInstance.setTestingOverride(key, value),
    resetTestingOverrides: () => configManagerInstance.resetTestingOverrides(),
    exportConfig: () => configManagerInstance.exportConfig(),
    
    // For debugging/testing - access to instance
    getInstance: () => configManagerInstance
  }
};