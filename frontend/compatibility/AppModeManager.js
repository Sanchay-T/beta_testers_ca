// AppModeManager.js
// Main orchestrator for app mode detection and classification system
const { ModeDecisionEngine } = require('./modules/ModeDecisionEngine');
const { ModeStorageManager } = require('./modules/ModeStorageManager');
const { HybridModeFlow } = require('./ui/HybridModeFlow');
const { ModeTestingPanel } = require('./testing/ModeTestingPanel');
const { AppModeConfigManager } = require('./config/AppModeConfigManager');

class AppModeManager {
  constructor(logger = null, compatibilityWindow = null) {
    this.logger = logger;
    this.window = compatibilityWindow;
    
    // Initialize core components
    this.decisionEngine = new ModeDecisionEngine(logger, this.updateProgress.bind(this));
    this.storageManager = new ModeStorageManager(logger);
    this.hybridFlow = new HybridModeFlow(logger, compatibilityWindow);
    this.testingPanel = new ModeTestingPanel(logger, compatibilityWindow);
    
    // State tracking
    this.isRunning = false;
    this.currentPhase = 'idle';
    this.results = null;
    
    // Scenario persistence for testing mode
    this.lastUsedScenario = null;
    this.sessionStartTime = Date.now();
    this.SCENARIO_PERSISTENCE_TIMEOUT = 300000; // 5 minutes
    
    this.logger?.info('APP_MODE_MANAGER', 'AppModeManager initialized');
  }

  /**
   * Run complete app mode detection and classification process
   * @param {Object} options - Detection options
   * @param {string} options.scenario - Testing scenario (highEnd, midRange, lowEnd)
   * @returns {Promise<Object>} Complete mode determination result
   */
  async runModeDetection(options = {}) {
    if (this.isRunning) {
      return { success: false, reason: 'Mode detection already running' };
    }

    const startTime = Date.now();
    this.isRunning = true;
    this.currentPhase = 'starting';

    try {
      this.logger?.info('APP_MODE_MANAGER', 'Starting complete mode detection process');

      // [MODE_DEBUG] Enhanced scenario persistence logic
      this.handleScenarioPersistence(options);

      // Phase 1: Load configuration and check development mode
      this.currentPhase = 'configuration';
      const config = AppModeConfigManager.getConfig();
      const isDevelopmentMode = config.developmentMode?.enabled;

      if (isDevelopmentMode && config.developmentMode?.showTestingPanel && !options.scenario) {
        // Development mode - show testing panel ONLY if no specific scenario is being tested
        return await this.runDevelopmentModeFlow(config);
      }

      // Phase 2: Run mode detection
      this.currentPhase = 'detection';
      this.updateProgress('Determining optimal app mode for your system...', 10);
      
      const decisionResult = await this.decisionEngine.determineAppMode(options);

      // Phase 3: Handle mode-specific flows
      this.currentPhase = 'mode_handling';
      const flowResult = await this.handleModeSpecificFlow(decisionResult);

      // Phase 4: Save results
      this.currentPhase = 'saving';
      this.updateProgress('Saving mode configuration...', 90);
      
      const saveResult = await this.storageManager.saveModeDecision(
        decisionResult, 
        flowResult.userChoices
      );

      // Phase 5: Complete
      this.currentPhase = 'complete';
      const finalResult = this.createFinalResult(
        decisionResult, 
        flowResult, 
        saveResult, 
        startTime
      );

      this.results = finalResult;
      this.logger?.info('APP_MODE_MANAGER', 'Mode detection completed successfully', {
        mode: finalResult.determinedMode,
        canProceed: finalResult.canProceed,
        duration: finalResult.duration
      });

      return finalResult;

    } catch (error) {
      this.logger?.error('APP_MODE_MANAGER', 'Mode detection failed', {
        error: error.message,
        phase: this.currentPhase,
        stack: error.stack
      });

      return this.createErrorResult(error, startTime);

    } finally {
      this.isRunning = false;
      this.currentPhase = 'idle';
    }
  }

  /**
   * Handle scenario persistence logic for testing mode
   * @param {Object} options - Detection options (modified in-place)
   */
  handleScenarioPersistence(options) {
    const config = AppModeConfigManager.getConfig();
    const isDevelopmentMode = config.developmentMode?.enabled;

    if (!isDevelopmentMode) {
      // Not in development mode, no scenario persistence needed
      this.logger?.info('APP_MODE_MANAGER', '[MODE_DEBUG] Not in development mode, skipping scenario persistence');
      return;
    }

    // Check if we're within session timeout
    const isWithinSession = this.isWithinSessionTimeout();

    // Log current state
    this.logger?.info('APP_MODE_MANAGER', '[MODE_DEBUG] Scenario persistence check', {
      providedScenario: options.scenario,
      lastUsedScenario: this.lastUsedScenario,
      isWithinSession: isWithinSession,
      sessionAge: Date.now() - this.sessionStartTime
    });

    // If no scenario provided, try to use persisted scenario
    if (!options.scenario && this.lastUsedScenario && isWithinSession) {
      options.scenario = this.lastUsedScenario;
      this.logger?.info('APP_MODE_MANAGER', '[MODE_DEBUG] Using persisted scenario from previous detection', {
        persistedScenario: options.scenario,
        source: 'previous_test_session'
      });
    }

    // Store scenario for future use (only if provided and within development mode)
    if (options.scenario && options.scenario !== 'current') {
      this.lastUsedScenario = options.scenario;
      this.logger?.info('APP_MODE_MANAGER', '[MODE_DEBUG] Storing scenario for future detections', {
        storedScenario: options.scenario,
        sessionTimeout: this.SCENARIO_PERSISTENCE_TIMEOUT
      });
    }
  }

  /**
   * Check if we're within the scenario persistence timeout
   * @returns {boolean} Whether we're within session timeout
   */
  isWithinSessionTimeout() {
    return (Date.now() - this.sessionStartTime) < this.SCENARIO_PERSISTENCE_TIMEOUT;
  }

  /**
   * Run development mode flow with testing panel
   * @param {Object} config - Configuration object
   * @returns {Promise<Object>} Development mode result
   */
  async runDevelopmentModeFlow(config) {
    this.logger?.info('APP_MODE_MANAGER', 'Running development mode flow with testing panel');

    try {
      // Initialize testing panel
      this.testingPanel.initialize();

      // Show testing panel in compatibility window
      if (this.window && !this.window.isDestroyed()) {
        const testingHTML = this.testingPanel.generateTestingPanelHTML();
        
        this.window.webContents.send('compatibility:show-testing-panel', {
          html: testingHTML
        });

        // Wait for user to complete testing
        return await this.waitForTestingCompletion();
      } else {
        throw new Error('Compatibility window not available for testing panel');
      }

    } catch (error) {
      this.logger?.error('APP_MODE_MANAGER', 'Development mode flow failed', {
        error: error.message
      });

      // Fallback to auto-detection
      this.logger?.info('APP_MODE_MANAGER', 'Falling back to auto-detection');
      const decisionResult = await this.decisionEngine.determineAppMode();
      const flowResult = await this.handleModeSpecificFlow(decisionResult);
      
      return this.createFinalResult(decisionResult, flowResult, null, Date.now());
    }
  }

  /**
   * Wait for testing completion in development mode
   * @returns {Promise<Object>} Testing completion result
   */
  async waitForTestingCompletion() {
    return new Promise((resolve) => {
      const { ipcMain } = require('electron');

      // Set up handlers for testing completion
      const proceedHandler = () => {
        const lastDecision = this.storageManager.loadLastModeDecision();
        if (lastDecision) {
          resolve({
            success: true,
            determinedMode: lastDecision.determinedMode,
            canProceed: true,
            developmentMode: true,
            lastDecision: lastDecision,
            userMessage: `🧪 Testing Mode: ${lastDecision.determinedMode} selected`,
            timestamp: new Date().toISOString()
          });
        } else {
          resolve({
            success: false,
            canProceed: false,
            reason: 'No mode decision made in testing',
            developmentMode: true
          });
        }
      };

      const cancelHandler = () => {
        resolve({
          success: false,
          canProceed: false,
          reason: 'User cancelled testing',
          developmentMode: true
        });
      };

      // Listen for proceed/cancel signals
      this.window.webContents.once('compatibility:proceed', proceedHandler);
      this.window.webContents.once('compatibility:cancel', cancelHandler);

      // Cleanup handlers after timeout
      setTimeout(() => {
        this.window.webContents.removeListener('compatibility:proceed', proceedHandler);
        this.window.webContents.removeListener('compatibility:cancel', cancelHandler);
        
        // Auto-proceed after timeout
        proceedHandler();
      }, 300000); // 5 minute timeout
    });
  }

  /**
   * Handle mode-specific user flows
   * @param {Object} decisionResult - Mode decision result
   * @returns {Promise<Object>} Mode-specific flow result
   */
  async handleModeSpecificFlow(decisionResult) {
    this.logger?.info('APP_MODE_MANAGER', `Handling ${decisionResult.mode} mode flow`);

    switch (decisionResult.mode) {
      case 'SCAN':
        return await this.handleScanModeFlow(decisionResult);
        
      case 'UNSCAN':
        return await this.handleUnscanModeFlow(decisionResult);
        
      case 'HYBRID':
        return await this.handleHybridModeFlow(decisionResult);
        
      default:
        this.logger?.warn('APP_MODE_MANAGER', 'Unknown mode detected', { mode: decisionResult.mode });
        return this.createModeFlowResult('unknown', true);
    }
  }

  /**
   * Handle SCAN mode flow
   * @param {Object} decisionResult - Decision result
   * @returns {Promise<Object>} Flow result
   */
  async handleScanModeFlow(decisionResult) {
    this.updateProgress('✅ Full scanning mode enabled - preparing optimal configuration...', 70);
    
    // SCAN mode - everything works, just show success message
    this.logger?.info('APP_MODE_MANAGER', 'SCAN mode confirmed - full functionality available');
    
    return this.createModeFlowResult('scan_ready', true, {
      message: decisionResult.userMessage,
      features: ['Full ML Scanning', 'Advanced Analytics', 'Offline Processing'],
      performance: 'Optimal'
    });
  }

  /**
   * Handle UNSCAN mode flow
   * @param {Object} decisionResult - Decision result
   * @returns {Promise<Object>} Flow result
   */
  async handleUnscanModeFlow(decisionResult) {
    this.updateProgress('⚡ Lightweight mode enabled - configuring optimized experience...', 70);
    
    // UNSCAN mode - show what features are disabled
    this.logger?.info('APP_MODE_MANAGER', 'UNSCAN mode confirmed - lightweight processing enabled');
    
    return this.createModeFlowResult('unscan_ready', true, {
      message: decisionResult.userMessage,
      features: ['Basic Processing', 'Manual Categorization', 'Offline Operation'],
      limitations: ['ML Scanning Disabled', 'Advanced Analytics Limited'],
      performance: 'Good'
    });
  }

  /**
   * Handle HYBRID mode flow
   * @param {Object} decisionResult - Decision result
   * @returns {Promise<Object>} Flow result
   */
  async handleHybridModeFlow(decisionResult) {
    this.updateProgress('🔄 Hybrid mode required - initiating setup process...', 50);
    
    this.logger?.info('APP_MODE_MANAGER', 'HYBRID mode detected - starting hybrid flow');
    
    try {
      // Run hybrid mode flow (alternative PC question -> payment screen)
      const hybridResult = await this.hybridFlow.startHybridFlow(decisionResult);
      
      this.logger?.info('APP_MODE_MANAGER', 'Hybrid flow completed', {
        outcome: hybridResult.outcome,
        canProceed: hybridResult.canProceed
      });
      
      return this.createModeFlowResult(
        hybridResult.outcome, 
        hybridResult.canProceed, 
        {
          hybridSetup: hybridResult.userChoices.hybridModeEnabled,
          userChoices: hybridResult.userChoices
        }
      );

    } catch (error) {
      this.logger?.error('APP_MODE_MANAGER', 'Hybrid flow failed', { error: error.message });
      
      return this.createModeFlowResult('hybrid_error', false, {
        error: error.message
      });
    }
  }

  /**
   * Create mode flow result
   * @param {string} outcome - Flow outcome
   * @param {boolean} canProceed - Whether app can proceed
   * @param {Object} details - Additional details
   * @returns {Object} Mode flow result
   */
  createModeFlowResult(outcome, canProceed, details = {}) {
    return {
      outcome: outcome,
      canProceed: canProceed,
      userChoices: details.userChoices || {},
      details: details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create final result combining all phases
   * @param {Object} decisionResult - Mode decision result
   * @param {Object} flowResult - Mode flow result
   * @param {Object} saveResult - Save operation result
   * @param {number} startTime - Process start time
   * @returns {Object} Final result
   */
  createFinalResult(decisionResult, flowResult, saveResult, startTime) {
    const endTime = Date.now();
    
    return {
      success: true,
      
      // Primary information for other developer
      determinedMode: decisionResult.mode,
      canProceed: flowResult.canProceed,
      confidence: decisionResult.confidence,
      
      // User experience
      userMessage: decisionResult.userMessage,
      nextSteps: decisionResult.nextSteps,
      
      // Flow details
      modeDecision: decisionResult,
      userFlow: flowResult,
      storage: saveResult,
      
      // Metadata
      duration: endTime - startTime,
      timestamp: new Date().toISOString(),
      phase: 'complete',
      
      // Technical details
      technical: {
        configVersion: AppModeConfigManager.getConfig().version,
        developmentMode: AppModeConfigManager.isDevelopmentMode(),
        storageLocation: saveResult?.files?.mainDecision,
        decisionEngineVersion: '1.0.0'
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
      success: false,
      determinedMode: 'ERROR',
      canProceed: false,
      reason: `Mode detection failed: ${error.message}`,
      error: error.message,
      phase: this.currentPhase,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      technical: {
        stack: error.stack,
        phase: this.currentPhase
      }
    };
  }

  /**
   * Update progress callback
   * @param {string} message - Progress message
   * @param {number} percent - Progress percentage
   */
  updateProgress(message, percent) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('app-mode:progress', {
        phase: this.currentPhase,
        message: message,
        percent: percent
      });
    }

    this.logger?.info('APP_MODE_PROGRESS', message, {
      phase: this.currentPhase,
      percent: percent
    });
  }

  /**
   * Get last results
   * @returns {Object|null} Last results
   */
  getLastResults() {
    return this.results;
  }

  /**
   * Check if mode detection is currently running
   * @returns {boolean} Running status
   */
  isDetectionRunning() {
    return this.isRunning;
  }

  /**
   * Get current phase
   * @returns {string} Current phase
   */
  getCurrentPhase() {
    return this.currentPhase;
  }

  /**
   * Load stored mode decision (for other developer)
   * @returns {Object|null} Stored decision
   */
  loadStoredDecision() {
    return this.storageManager.loadLastModeDecision();
  }

  /**
   * Get mode decision history
   * @param {number} limit - Number of records to return
   * @returns {Array} Decision history
   */
  getDecisionHistory(limit = 10) {
    return this.storageManager.getDecisionHistory(limit);
  }

  /**
   * Get storage status
   * @returns {Object} Storage status
   */
  getStorageStatus() {
    return this.storageManager.getStorageStatus();
  }

  /**
   * Reset manager state
   */
  reset() {
    this.isRunning = false;
    this.currentPhase = 'idle';
    this.results = null;
    this.decisionEngine.reset();
    this.hybridFlow.cleanup();
    
    // Reset scenario persistence
    this.lastUsedScenario = null;
    this.sessionStartTime = Date.now();
    
    this.logger?.info('APP_MODE_MANAGER', 'Manager state reset');
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.reset();
    this.hybridFlow.cleanup();
    
    // Clean up any remaining IPC handlers
    const { ipcMain } = require('electron');
    try {
      // Remove app-mode specific handlers
      const handlersToRemove = [
        'app-mode:start-detection',
        'app-mode:get-status',
        'app-mode:get-results',
        'app-mode:reset'
      ];

      handlersToRemove.forEach(handler => {
        try {
          ipcMain.removeHandler(handler);
        } catch (e) {
          // Handler may not exist
        }
      });
    } catch (error) {
      this.logger?.warn('APP_MODE_MANAGER', 'Cleanup warning', { error: error.message });
    }

    this.logger?.info('APP_MODE_MANAGER', 'Manager cleanup completed');
  }

  /**
   * Register IPC handlers for external communication
   */
  registerIPCHandlers() {
    const { ipcMain } = require('electron');

    // Start mode detection
    ipcMain.handle('app-mode:start-detection', async () => {
      return await this.runModeDetection();
    });

    // Get current status
    ipcMain.handle('app-mode:get-status', () => {
      return {
        isRunning: this.isRunning,
        currentPhase: this.currentPhase,
        lastResults: this.results
      };
    });

    // Get stored decision
    ipcMain.handle('app-mode:get-results', () => {
      return this.loadStoredDecision();
    });

    // Reset manager
    ipcMain.handle('app-mode:reset', () => {
      this.reset();
      return { success: true };
    });

    this.logger?.info('APP_MODE_MANAGER', 'IPC handlers registered');
  }
}

module.exports = { AppModeManager };