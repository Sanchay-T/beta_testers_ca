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
      this.logger?.info('MODE_DECISION', '[FINALIZE] Input decision to finalizer:', {
        decisionMode: decision.mode,
        decisionConfidence: decision.confidence,
        decisionReason: decision.reason,
        hardwareCheck: decision.hardware?.meetsFullModeRequirements,
        scanTestResults: decision.scanTest
      });
      
      const finalResult = this.finalizeDecision(decision, startTime);

      // 🎯 CRITICAL: Store the result as the definitive source of truth
      this.decisionResult = finalResult;
      this.logger?.info('MODE_DECISION', '🎯 [CRITICAL] FINAL RESULT STORED IN decisionResult property');
      
      this.logger?.info('MODE_DECISION', '=== MODE DETERMINATION COMPLETED ===');
      this.logger?.info('MODE_DECISION', '🎯 [FINAL_SUMMARY] Complete mode determination result:', {
        FINAL_DETERMINED_MODE: finalResult.mode,
        FINAL_CONFIDENCE: finalResult.confidence,
        FINAL_DURATION: `${finalResult.duration}ms`,
        FINAL_USER_MESSAGE: finalResult.userMessage,
        FINAL_RECOMMENDED_ACTION: finalResult.recommendedAction,
        FINAL_HARDWARE_ADEQUATE: finalResult.analysis.hardware.meetsFullModeRequirements,
        FINAL_SCAN_TEST_PASSED: finalResult.analysis.scanTest?.passed,
        FINAL_DECISION_PATH: finalResult.analysis.decisionPath?.join(' → '),
        FINAL_TIMESTAMP: finalResult.timestamp,
        FINAL_NEXT_STEPS: finalResult.nextSteps,
        FINAL_TECHNICAL_INFO: {
          configVersion: finalResult.technical.configVersion,
          testMode: finalResult.technical.testMode,
          overridesApplied: finalResult.technical.overridesApplied
        }
      });

      this.logger?.info('MODE_DECISION', '🎯 === RETURNING FINAL RESULT TO CALLER ===');
      this.logger?.info('MODE_DECISION', `🎯 [RETURN] MODE: ${finalResult.mode} | CONFIDENCE: ${finalResult.confidence} | CAN_PROCEED: true`);
      
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

    // 🎯 UNIVERSAL RAM-FIRST DECISION LOGIC:
    // RAM < 4GB    → HYBRID (not compatible with offline processing)
    // 4GB ≤ RAM ≤ 8GB → UNSCAN (offline but no scanning)  
    // RAM > 8GB    → SCAN (full offline with scanning)
    this.logger?.info('MODE_DECISION', '🎯 [DECISION_POINT] Starting UNIVERSAL RAM-FIRST mode determination logic...');
    
    const actualRAM = hardwareCheck.ram.actual;
    const actualCPU = hardwareCheck.cpu.actual;
    
    this.logger?.info('MODE_DECISION', '[UNIVERSAL_LOGIC] System specs:', {
      RAM: `${actualRAM}GB`,
      CPU: actualCPU,
      decisionStrategy: 'RAM_FIRST_PRIORITY'
    });
    
    // DECISION RULE 1: RAM < 4GB → HYBRID MODE
    if (actualRAM < 4) {
      this.updateProgress('RAM below 4GB - HYBRID mode required...', 70);
      this.logger?.info('MODE_DECISION', '🎯 [DECISION] ❌ RAM < 4GB -> DETERMINING HYBRID MODE');
      this.logger?.info('MODE_DECISION', '[UNIVERSAL_LOGIC] HYBRID decision rationale:', {
        ramCheck: `${actualRAM}GB < 4GB = INSUFFICIENT_FOR_OFFLINE`,
        cpuRelevance: 'CPU irrelevant - RAM is limiting factor',
        finalDecision: 'HYBRID'
      });
      
      const hybridDecision = {
        mode: 'HYBRID',
        reason: `Insufficient RAM (${actualRAM}GB < 4GB required for offline processing)`,
        confidence: 'high',
        hardware: hardwareCheck,
        scanTest: null, // No scan test needed - RAM insufficient
        recommendedAction: 'upgrade_or_cloud'
      };
      
      this.logger?.info('MODE_DECISION', '🎯 [DECISION_MADE] HYBRID MODE decision created:', {
        finalMode: hybridDecision.mode,
        finalConfidence: hybridDecision.confidence,
        finalReason: hybridDecision.reason,
        ramLimiting: `${actualRAM}GB < 4GB`,
        scanTestSkipped: 'RAM insufficient, scan test not applicable'
      });
      return hybridDecision;
    }
    
    // DECISION RULE 2: 4GB ≤ RAM ≤ 8GB → UNSCAN MODE  
    else if (actualRAM >= 4) {
      this.updateProgress('RAM > 4GB - SCAN mode (full processing with scanning)...', 70);
      this.logger?.info('MODE_DECISION', '🎯 [DECISION] ✅ RAM > 4GB -> DETERMINING SCAN MODE');
      this.logger?.info('MODE_DECISION', '[UNIVERSAL_LOGIC] SCAN decision rationale:', {
        ramCheck: `${actualRAM}GB > 4GB = EXCELLENT_FOR_FULL_OFFLINE`,
        cpuNote: `CPU: ${actualCPU} (secondary consideration)`,
        finalDecision: 'SCAN'
      });
      
      const scanDecision = {
        mode: 'SCAN',
        reason: `Excellent RAM (${actualRAM}GB) perfect for full offline processing with scanning`,
        confidence: 'high',
        hardware: hardwareCheck,
        scanTest: { passed: true, reason: 'Assumed passed - RAM sufficient for all operations', duration: 0 },
        recommendedAction: 'proceed'
      };
      
      this.logger?.info('MODE_DECISION', '🎯 [DECISION_MADE] SCAN MODE decision created:', {
        finalMode: scanDecision.mode,
        finalConfidence: scanDecision.confidence,
        finalReason: scanDecision.reason,
        ramExcellent: `${actualRAM}GB > 4GB`,
        scanTestSkipped: 'SCAN mode determined by RAM - scan test unnecessary'
      });
      return scanDecision;
    }
    
    // FALLBACK (should never reach here with proper RAM detection)
    else {
      this.logger?.error('MODE_DECISION', '❌ [FALLBACK] Unexpected RAM value - defaulting to HYBRID');
      const fallbackDecision = {
        mode: 'HYBRID',
        reason: `Unexpected RAM detection (${actualRAM}GB) - defaulting to safe HYBRID mode`,
        confidence: 'low',
        hardware: hardwareCheck,
        scanTest: null,
        recommendedAction: 'upgrade_or_cloud'
      };
      return fallbackDecision;
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
    this.logger?.info('MODE_DECISION', '🎯 === STARTING FINAL DECISION CREATION ===');
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Log input decision details
    this.logger?.info('MODE_DECISION', '[FINALIZE] Input decision analysis:', {
      inputMode: decision.mode,
      inputConfidence: decision.confidence,
      inputReason: decision.reason,
      inputRecommendedAction: decision.recommendedAction,
      hardwareMeetsRequirements: decision.hardware?.meetsFullModeRequirements,
      scanTestResult: decision.scanTest?.passed,
      processingDuration: `${duration}ms`
    });

    this.updateProgress(`Mode determined: ${decision.mode}`, 95);

    const config = AppModeConfigManager.getConfig();
    const notifications = config.userExperience?.notifications || {};

    // Log configuration details
    this.logger?.info('MODE_DECISION', '[FINALIZE] Configuration context:', {
      configVersion: config.version,
      developmentModeEnabled: config.developmentMode?.enabled || false,
      testingOverridesActive: this.hasOverridesApplied(config),
      notificationsAvailable: Object.keys(notifications).length
    });

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

    // 🎯 COMPREHENSIVE FINAL RESULT LOGGING
    this.logger?.info('MODE_DECISION', '🎯 === FINAL DECISION RESULT CREATED ===');
    this.logger?.info('MODE_DECISION', '[FINAL_RESULT] Core decision:', {
      FINAL_MODE: result.mode,
      FINAL_CONFIDENCE: result.confidence,
      FINAL_REASON: result.reason,
      FINAL_RECOMMENDED_ACTION: result.recommendedAction,
      FINAL_DURATION: `${result.duration}ms`,
      FINAL_TIMESTAMP: result.timestamp
    });

    this.logger?.info('MODE_DECISION', '[FINAL_RESULT] Hardware analysis:', {
      RAM_ACTUAL: result.analysis.hardware.ram?.actual,
      RAM_REQUIRED: result.analysis.hardware.ram?.required,
      RAM_MEETS_REQ: result.analysis.hardware.ram?.meets,
      CPU_ACTUAL: result.analysis.hardware.cpu?.actual,
      CPU_REQUIRED: result.analysis.hardware.cpu?.required,
      CPU_MEETS_REQ: result.analysis.hardware.cpu?.meets,
      HARDWARE_SUFFICIENT: result.analysis.hardware.meetsFullModeRequirements
    });

    this.logger?.info('MODE_DECISION', '[FINAL_RESULT] Scan test results:', {
      SCAN_TEST_EXECUTED: !!result.analysis.scanTest,
      SCAN_TEST_PASSED: result.analysis.scanTest?.passed,
      SCAN_TEST_DURATION: result.analysis.scanTest?.duration,
      SCAN_TEST_PERFORMANCE: result.analysis.scanTest?.performance,
      SCAN_TEST_REASON: result.analysis.scanTest?.reason
    });

    this.logger?.info('MODE_DECISION', '[FINAL_RESULT] Decision path:', {
      DECISION_PATH: result.analysis.decisionPath,
      PATH_LENGTH: result.analysis.decisionPath?.length,
      PATH_SUMMARY: result.analysis.decisionPath?.join(' → ')
    });

    this.logger?.info('MODE_DECISION', '[FINAL_RESULT] User experience:', {
      USER_MESSAGE: result.userMessage,
      NEXT_STEPS_COUNT: result.nextSteps?.length,
      NEXT_STEPS: result.nextSteps
    });

    this.logger?.info('MODE_DECISION', '[FINAL_RESULT] Technical metadata:', {
      CONFIG_VERSION: result.technical.configVersion,
      TEST_MODE_ACTIVE: result.technical.testMode,
      OVERRIDES_APPLIED: result.technical.overridesApplied,
      DECISION_ENGINE_VERSION: result.technical.decisionEngine
    });

    this.updateProgress('Decision analysis complete!', 100);

    // Final summary log
    this.logger?.info('MODE_DECISION', '🎯 === FINAL RESULT SUMMARY ===');
    this.logger?.info('MODE_DECISION', `✅ DETERMINED MODE: ${result.mode}`);
    this.logger?.info('MODE_DECISION', `✅ CONFIDENCE LEVEL: ${result.confidence}`);
    this.logger?.info('MODE_DECISION', `✅ PROCESSING TIME: ${result.duration}ms`);
    this.logger?.info('MODE_DECISION', `✅ HARDWARE ADEQUATE: ${result.analysis.hardware.meetsFullModeRequirements}`);
    this.logger?.info('MODE_DECISION', `✅ SCAN TEST STATUS: ${result.analysis.scanTest?.passed ? 'PASSED' : 'FAILED/SKIPPED'}`);
    this.logger?.info('MODE_DECISION', `✅ USER MESSAGE: ${result.userMessage}`);
    this.logger?.info('MODE_DECISION', '🎯 === FINAL DECISION COMPLETE - RETURNING RESULT ===');

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
    this.logger?.info('MODE_DECISION', '🎯 [ACCESS] getLastDecision() called');
    
    if (this.decisionResult) {
      this.logger?.info('MODE_DECISION', '🎯 [ACCESS] Returning stored decision result:', {
        storedMode: this.decisionResult.mode,
        storedConfidence: this.decisionResult.confidence,
        storedTimestamp: this.decisionResult.timestamp,
        storedDuration: this.decisionResult.duration,
        hasAnalysis: !!this.decisionResult.analysis,
        hasUserMessage: !!this.decisionResult.userMessage,
        hasNextSteps: !!this.decisionResult.nextSteps
      });
      return this.decisionResult;
    } else {
      this.logger?.warn('MODE_DECISION', '🎯 [ACCESS] No decision result stored - returning null');
      return null;
    }
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