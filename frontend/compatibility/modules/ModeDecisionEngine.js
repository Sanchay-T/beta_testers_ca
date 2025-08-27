// ModeDecisionEngine.js
const { HardwareDetector } = require('./HardwareDetector');
const { ScanPerformanceTest } = require('./ScanPerformanceTest');
const { AppModeConfigManager } = require('../config/AppModeConfigManager');

class ModeDecisionEngine {
  constructor(logger = null, progressCallback = null) {
    this.logger = logger;
    this.progressCallback = progressCallback;
    this.hardwareDetector = new HardwareDetector(logger);
    this.scanTester = new ScanPerformanceTest(logger, progressCallback);
    this.decisionResult = null;
    this.activeScenario = null; // Track active testing scenario
  }

  /**
   * Determine the appropriate app mode based on system capabilities
   * @param {Object} options - Options for mode determination
   * @param {string} options.scenario - Testing scenario (highEnd, midRange, lowEnd)
   * @returns {Promise<Object>} Mode decision result
   */
  async determineAppMode(options = {}) {
    this.activeScenario = options.scenario;
    const startTime = Date.now();
    this.logger?.info('MODE_DECISION', '=== STARTING MODE DETERMINATION ===');
    this.logger?.info('MODE_DECISION', 'Input options:', {
      scenario: options.scenario,
      hasOverrides: !!options.overrides,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Step 1: Get system specifications
      this.updateProgress('Detecting system specifications...', 10);
      this.logger?.info('MODE_DECISION', 'Getting system specifications...');
      const systemSpecs = await this.hardwareDetector.getSystemSpecs();
      
      this.logger?.info('MODE_DECISION', 'System specs detected:', {
        ram: systemSpecs.ram?.total || 'unknown',
        cpu: systemSpecs.cpu?.class || 'unknown',
        overridden: systemSpecs.overridden || false
      });

      // Step 2: Apply forced mode override if set (for testing)
      const config = AppModeConfigManager.getConfig();
      const forcedMode = config.testingOverrides?.forceMode;
      
      this.logger?.info('MODE_DECISION', '[OVERRIDE_CHECK] Testing overrides:', {
        forcedMode: forcedMode,
        developmentMode: config.developmentMode?.enabled,
        activeScenario: this.activeScenario,
        testingOverrides: config.testingOverrides,
        configVersion: config.version
      });
      
      if (forcedMode && config.developmentMode?.enabled) {
        this.logger?.info('MODE_DECISION', `[FORCED_MODE] Applying override: ${forcedMode}`);
        this.logger?.info('MODE_DECISION', '[FORCED_MODE] Creating forced result...');
        return this.createForcedResult(forcedMode, systemSpecs, startTime);
      }

      // Step 2.5: Apply scenario-based mode forcing (for testing scenarios)
      this.logger?.info('MODE_DECISION', '[SCENARIO_CHECK] Checking for scenario-based mode...');
      const scenarioMode = this.checkScenarioBasedMode(config);
      
      if (scenarioMode && config.developmentMode?.enabled) {
        this.logger?.info('MODE_DECISION', `[SCENARIO_MODE] Applying scenario-based mode: ${scenarioMode}`);
        this.logger?.info('MODE_DECISION', '[SCENARIO_MODE] Source scenario:', this.activeScenario);
        return this.createForcedResult(scenarioMode, systemSpecs, startTime);
      } else {
        this.logger?.info('MODE_DECISION', '[SCENARIO_CHECK] No scenario mode to apply', {
          scenarioMode,
          developmentMode: config.developmentMode?.enabled
        });
      }

      // Step 3: Check hardware requirements for full mode
      this.updateProgress('Checking hardware requirements...', 20);
      this.logger?.info('MODE_DECISION', '[HARDWARE_CHECK] Starting hardware requirements check...');
      const hardwareCheck = await this.checkHardwareRequirements(systemSpecs);
      
      this.logger?.info('MODE_DECISION', '[HARDWARE_CHECK] Results:', {
        meetsRequirements: hardwareCheck.meetsFullModeRequirements,
        ram: hardwareCheck.ram,
        cpu: hardwareCheck.cpu
      });

      // Step 4: Apply decision logic
      this.logger?.info('MODE_DECISION', '[DECISION_LOGIC] Applying decision rules...');
      const decision = await this.applyDecisionLogic(hardwareCheck, systemSpecs);
      
      this.logger?.info('MODE_DECISION', '[DECISION_LOGIC] Decision made:', {
        mode: decision.mode,
        confidence: decision.confidence,
        reason: decision.reason
      });

      // Step 5: Finalize result
      this.logger?.info('MODE_DECISION', '[FINALIZE] Creating final result...');
      const finalResult = this.finalizeDecision(decision, startTime);

      this.decisionResult = finalResult;
      this.logger?.info('MODE_DECISION', '=== MODE DETERMINATION COMPLETED ===');
      this.logger?.info('MODE_DECISION', 'Summary:', {
        determinedMode: finalResult.mode,
        confidence: finalResult.confidence,
        duration: `${finalResult.duration}ms`,
        hardwareMeetsRequirements: finalResult.analysis.hardware.meetsFullModeRequirements,
        scanTestPassed: finalResult.analysis.scanTest?.passed,
        decisionPath: finalResult.analysis.decisionPath
      });

      return finalResult;

    } catch (error) {
      this.logger?.error('MODE_DECISION', 'Mode determination failed', {
        error: error.message,
        stack: error.stack
      });

      return this.createErrorResult(error, startTime);
    }
  }

  /**
   * Check if hardware meets full mode requirements
   * @param {Object} systemSpecs - System specifications
   * @returns {Promise<Object>} Hardware requirements check result
   */
  async checkHardwareRequirements(systemSpecs) {
    this.logger?.info('MODE_DECISION', 'Checking hardware requirements for full mode');

    const config = AppModeConfigManager.getConfig();
    const fullModeRequirements = config.hardwareThresholds.fullMode;

    // Extract relevant specs
    const totalRAM = systemSpecs.ram?.total || systemSpecs.memory?.total || 0;
    const cpuClass = systemSpecs.cpu?.class || 'unknown';

    // Check RAM requirement
    const ramMeetsRequirement = totalRAM >= fullModeRequirements.minRAM;
    
    // Check CPU requirement  
    const cpuMeetsRequirement = this.hardwareDetector.compareCPU(cpuClass, fullModeRequirements.minProcessor);

    const result = {
      meetsFullModeRequirements: ramMeetsRequirement && cpuMeetsRequirement,
      ram: {
        actual: totalRAM,
        required: fullModeRequirements.minRAM,
        unit: 'GB',
        meets: ramMeetsRequirement
      },
      cpu: {
        actual: cpuClass,
        required: fullModeRequirements.minProcessor,
        meets: cpuMeetsRequirement
      },
      specs: systemSpecs
    };

    this.logger?.info('MODE_DECISION', 'Hardware requirements check completed', {
      meetsRequirements: result.meetsFullModeRequirements,
      ram: `${result.ram.actual}GB (required: ${result.ram.required}GB)`,
      cpu: `${result.cpu.actual} (required: ${result.cpu.required}+)`
    });

    return result;
  }

  /**
   * Apply the core decision logic
   * @param {Object} hardwareCheck - Hardware requirements check result
   * @param {Object} systemSpecs - System specifications
   * @returns {Promise<Object>} Decision logic result
   */
  async applyDecisionLogic(hardwareCheck, systemSpecs) {
    this.logger?.info('MODE_DECISION', '[LOGIC] Applying decision rules...');
    this.logger?.info('MODE_DECISION', '[LOGIC] Hardware status:', {
      meetsRequirements: hardwareCheck.meetsFullModeRequirements,
      ram: `${hardwareCheck.ram.actual}GB (needs ${hardwareCheck.ram.required}GB)`,
      cpu: `${hardwareCheck.cpu.actual} (needs ${hardwareCheck.cpu.required}+)`
    });

    // Core Logic: IF (RAM >= 8GB AND CPU >= i5) → Test Scan → SCAN/UNSCAN ELSE → HYBRID
    if (hardwareCheck.meetsFullModeRequirements) {
      this.updateProgress('Hardware meets requirements, testing scan performance...', 40);
      this.logger?.info('MODE_DECISION', '[LOGIC] Hardware sufficient - running scan test...');
      
      // Hardware is good enough, now test scan performance
      const scanTestResult = await this.runScanPerformanceTest();
      
      if (scanTestResult.passed) {
        // Scan test passed -> SCAN MODE
        this.logger?.info('MODE_DECISION', '[LOGIC] Scan test PASSED -> SCAN MODE');
        return {
          mode: 'SCAN',
          reason: 'Hardware meets requirements and scan test passed',
          confidence: 'high',
          hardware: hardwareCheck,
          scanTest: scanTestResult,
          recommendedAction: 'proceed'
        };
      } else {
        // Scan test failed -> UNSCAN MODE
        this.logger?.info('MODE_DECISION', '[LOGIC] Scan test FAILED -> UNSCAN MODE');
        return {
          mode: 'UNSCAN', 
          reason: 'Hardware meets requirements but scan test failed/slow',
          confidence: 'medium',
          hardware: hardwareCheck,
          scanTest: scanTestResult,
          recommendedAction: 'proceed_limited'
        };
      }
    } else {
      // Hardware doesn't meet requirements -> HYBRID MODE
      this.updateProgress('Hardware below requirements, hybrid mode required...', 70);
      this.logger?.info('MODE_DECISION', '[LOGIC] Hardware insufficient -> HYBRID MODE');
      
      return {
        mode: 'HYBRID',
        reason: 'Hardware below minimum requirements for offline processing',
        confidence: 'high',
        hardware: hardwareCheck,
        scanTest: null, // No scan test needed
        recommendedAction: 'upgrade_or_cloud'
      };
    }
  }

  /**
   * Run scan performance test with progress updates
   * @returns {Promise<Object>} Scan test result
   */
  async runScanPerformanceTest() {
    this.logger?.info('MODE_DECISION', 'Starting scan performance test...');

    const config = AppModeConfigManager.getConfig();
    const timeout = config.hardwareThresholds.fullMode.scanTestTimeout;

    try {
      const scanResult = await this.scanTester.runScanTest(timeout);
      
      this.logger?.info('MODE_DECISION', 'Scan performance test completed', {
        passed: scanResult.passed,
        duration: scanResult.duration,
        performance: scanResult.performance
      });

      return scanResult;

    } catch (error) {
      this.logger?.error('MODE_DECISION', 'Scan performance test failed', {
        error: error.message
      });

      return {
        success: false,
        passed: false,
        duration: 0,
        reason: `Scan test error: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Finalize the decision with complete analysis
   * @param {Object} decision - Decision logic result
   * @param {number} startTime - Process start time
   * @returns {Object} Final decision result
   */
  finalizeDecision(decision, startTime) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    this.updateProgress(`Mode determined: ${decision.mode}`, 95);

    const config = AppModeConfigManager.getConfig();
    const notifications = config.userExperience?.notifications || {};

    const result = {
      mode: decision.mode,
      confidence: decision.confidence,
      reason: decision.reason,
      recommendedAction: decision.recommendedAction,
      duration: duration,
      timestamp: new Date().toISOString(),
      
      // Detailed analysis
      analysis: {
        hardware: {
          meetsFullModeRequirements: decision.hardware.meetsFullModeRequirements,
          ram: decision.hardware.ram,
          cpu: decision.hardware.cpu,
          specs: decision.hardware.specs
        },
        scanTest: decision.scanTest,
        decisionPath: this.getDecisionPath(decision)
      },

      // User-facing information
      userMessage: this.getUserMessage(decision.mode, notifications),
      nextSteps: this.getNextSteps(decision.mode),

      // Technical details
      technical: {
        configVersion: config.version,
        testMode: config.developmentMode?.enabled || false,
        overridesApplied: this.hasOverridesApplied(config),
        decisionEngine: 'v1.0.0'
      }
    };

    this.updateProgress('Decision analysis complete!', 100);

    return result;
  }

  /**
   * Get decision path for debugging
   * @param {Object} decision - Decision result
   * @returns {Array} Decision path
   */
  getDecisionPath(decision) {
    const path = ['hardware_check'];
    
    if (decision.hardware.meetsFullModeRequirements) {
      path.push('hardware_sufficient');
      path.push('scan_test');
      if (decision.scanTest?.passed) {
        path.push('scan_passed');
        path.push('mode_scan');
      } else {
        path.push('scan_failed');
        path.push('mode_unscan');
      }
    } else {
      path.push('hardware_insufficient');
      path.push('mode_hybrid');
    }

    return path;
  }

  /**
   * Get user-friendly message based on determined mode
   * @param {string} mode - Determined mode
   * @param {Object} notifications - Notification messages from config
   * @returns {string} User message
   */
  getUserMessage(mode, notifications) {
    const messages = {
      'SCAN': notifications.scanModeEnabled || '✅ Full offline processing with scanning enabled',
      'UNSCAN': notifications.unscanModeEnabled || '⚡ Lightweight offline processing (scanning disabled)',
      'HYBRID': notifications.hybridModeRequired || '🔄 Cloud-assisted processing required'
    };

    return messages[mode] || `Mode: ${mode}`;
  }

  /**
   * Get next steps based on determined mode
   * @param {string} mode - Determined mode
   * @returns {Array} Next steps
   */
  getNextSteps(mode) {
    const steps = {
      'SCAN': [
        'Launch CypherEdge with full capabilities',
        'All features available including ML scanning',
        'Optimal performance expected'
      ],
      'UNSCAN': [
        'Launch CypherEdge with lightweight processing',
        'Manual transaction categorization may be required',
        'Consider hardware upgrade for full features'
      ],
      'HYBRID': [
        'Hybrid mode setup required',
        'Payment and support team contact needed',
        'Consider system upgrade for offline processing'
      ]
    };

    return steps[mode] || ['Mode-specific steps not available'];
  }

  /**
   * Check if any testing overrides are applied
   * @param {Object} config - Configuration object
   * @returns {boolean} Whether overrides are applied
   */
  hasOverridesApplied(config) {
    const overrides = config.testingOverrides || {};
    return !!(overrides.forceRAM || overrides.forceCPU || overrides.forceScanResult || overrides.forceMode);
  }

  /**
   * Create forced result for testing purposes
   * @param {string} forcedMode - Forced mode
   * @param {Object} systemSpecs - System specifications
   * @param {number} startTime - Start time
   * @returns {Object} Forced result
   */
  createForcedResult(forcedMode, systemSpecs, startTime) {
    this.logger?.info('MODE_DECISION', `Using forced mode: ${forcedMode}`);

    return {
      mode: forcedMode.toUpperCase(),
      confidence: 'forced',
      reason: `Forced to ${forcedMode} mode for testing`,
      recommendedAction: 'testing',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      forced: true,
      analysis: {
        hardware: { specs: systemSpecs },
        scanTest: null,
        decisionPath: ['forced_override', `mode_${forcedMode.toLowerCase()}`]
      },
      userMessage: `🧪 Testing Mode: ${forcedMode}`,
      nextSteps: [`Testing ${forcedMode} mode functionality`],
      technical: {
        testMode: true,
        overridesApplied: true,
        decisionEngine: 'v1.0.0'
      }
    };
  }

  /**
   * Create error result
   * @param {Error} error - Error object
   * @param {number} startTime - Start time
   * @returns {Object} Error result
   */
  createErrorResult(error, startTime) {
    return {
      mode: 'ERROR',
      confidence: 'none',
      reason: `Mode determination failed: ${error.message}`,
      recommendedAction: 'fallback',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      error: true,
      analysis: {
        hardware: null,
        scanTest: null,
        decisionPath: ['error'],
        error: error.message
      },
      userMessage: '❌ Unable to determine optimal mode',
      nextSteps: [
        'Check system compatibility',
        'Try running in safe mode',
        'Contact support if issue persists'
      ],
      technical: {
        error: error.message,
        stack: error.stack,
        decisionEngine: 'v1.0.0'
      }
    };
  }

  /**
   * Update progress if callback is provided
   * @param {string} message - Progress message
   * @param {number} percent - Progress percentage
   */
  updateProgress(message, percent) {
    if (this.progressCallback && typeof this.progressCallback === 'function') {
      this.progressCallback({ 
        phase: 'mode_determination',
        message, 
        percent 
      });
    }
  }

  /**
   * Get last decision result
   * @returns {Object|null} Last decision result
   */
  getLastDecision() {
    return this.decisionResult;
  }

  /**
   * Check if scenario-based mode forcing should be applied
   * @param {Object} config - Configuration object
   * @returns {string|null} Forced mode based on scenario, or null
   */
  checkScenarioBasedMode(config) {
    this.logger?.info('MODE_DECISION', '[SCENARIO_MAP] Checking scenario mapping...', {
      activeScenario: this.activeScenario
    });
    
    if (!this.activeScenario) {
      this.logger?.info('MODE_DECISION', '[SCENARIO_MAP] No active scenario');
      return null;
    }

    const scenarioModeMap = {
      'highEnd': 'SCAN',
      'midRange': 'UNSCAN', 
      'lowEnd': 'HYBRID',
      'current': null // Use actual detection for current system
    };

    this.logger?.info('MODE_DECISION', '[SCENARIO_MAP] Default mappings:', scenarioModeMap);

    // Also check the config-defined scenarios
    const configScenarios = config.testing?.scenarios;
    if (configScenarios) {
      this.logger?.info('MODE_DECISION', '[SCENARIO_MAP] Config has custom scenarios:', Object.keys(configScenarios));
      
      for (const [scenarioKey, scenarioConfig] of Object.entries(configScenarios)) {
        if (this.activeScenario === scenarioKey || this.activeScenario === scenarioKey.replace('PC', '')) {
          this.logger?.info('MODE_DECISION', '[SCENARIO_MAP] Found config match:', {
            scenarioKey,
            expectedMode: scenarioConfig.expectedMode
          });
          return scenarioConfig.expectedMode;
        }
      }
    }

    const forcedMode = scenarioModeMap[this.activeScenario];
    this.logger?.info('MODE_DECISION', '[SCENARIO_MAP] Final result:', {
      activeScenario: this.activeScenario,
      forcedMode: forcedMode,
      source: forcedMode ? 'default_map' : 'none'
    });

    return forcedMode;
  }

  /**
   * Reset decision state
   */
  reset() {
    this.decisionResult = null;
    this.activeScenario = null;
    this.hardwareDetector.clearCache();
  }
}

module.exports = { ModeDecisionEngine };