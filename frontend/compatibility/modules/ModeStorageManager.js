// ModeStorageManager.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { AppModeConfigManager } = require('../config/AppModeConfigManager');

class ModeStorageManager {
  constructor(logger = null) {
    this.logger = logger;
    this.userDataDir = app.getPath('userData');
    this.storageDir = path.join(this.userDataDir, 'appMode');
    this.ensureStorageDirectory();
  }

  /**
   * Ensure storage directory exists
   */
  ensureStorageDirectory() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.logger?.info('MODE_STORAGE', 'Created app mode storage directory', {
          path: this.storageDir
        });
      }
    } catch (error) {
      this.logger?.error('MODE_STORAGE', 'Failed to create storage directory', {
        error: error.message,
        path: this.storageDir
      });
    }
  }

  /**
   * Save mode decision result for other developer to consume
   * @param {Object} decisionResult - Mode decision result
   * @param {Object} userChoices - User interaction choices (for hybrid mode)
   * @returns {Promise<Object>} Storage result
   */
  async saveModeDecision(decisionResult, userChoices = null) {
    const startTime = Date.now();
    this.logger?.info('MODE_STORAGE', 'Saving mode decision result');

    try {
      // Create the main decision file for other developer
      const mainDecision = this.createMainDecisionFile(decisionResult, userChoices);
      const mainDecisionPath = path.join(this.storageDir, 'appModeDecision.json');
      
      // Create detailed log file for debugging
      const detailedLog = this.createDetailedLogFile(decisionResult, userChoices);
      const detailedLogPath = path.join(this.storageDir, 'modeDecisionLog.json');

      // Create historical record
      const historicalRecord = this.createHistoricalRecord(decisionResult, userChoices);
      const historyPath = path.join(this.storageDir, 'decisionHistory.json');

      // Save main decision file (primary handoff point)
      await this.saveJSONFile(mainDecisionPath, mainDecision);

      // Save detailed log file
      await this.saveJSONFile(detailedLogPath, detailedLog);

      // Append to history
      await this.appendToHistory(historyPath, historicalRecord);

      // Create backup with timestamp
      const backupPath = this.createTimestampedBackup(decisionResult);

      const storageResult = {
        success: true,
        duration: Date.now() - startTime,
        files: {
          mainDecision: mainDecisionPath,
          detailedLog: detailedLogPath,
          history: historyPath,
          backup: backupPath
        },
        decision: decisionResult.mode,
        timestamp: new Date().toISOString()
      };

      this.logger?.info('MODE_STORAGE', 'Mode decision saved successfully', {
        mode: decisionResult.mode,
        files: Object.keys(storageResult.files).length,
        duration: storageResult.duration
      });

      return storageResult;

    } catch (error) {
      this.logger?.error('MODE_STORAGE', 'Failed to save mode decision', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create main decision file for other developer consumption
   * @param {Object} decisionResult - Decision result
   * @param {Object} userChoices - User choices
   * @returns {Object} Main decision data
   */
  createMainDecisionFile(decisionResult, userChoices) {
    return {
      // PRIMARY INFORMATION FOR OTHER DEVELOPER
      determinedMode: decisionResult.mode, // SCAN, UNSCAN, or HYBRID
      confidence: decisionResult.confidence,
      timestamp: decisionResult.timestamp,
      
      // HARDWARE SPECIFICATIONS
      systemSpecifications: {
        ram: {
          total: decisionResult.analysis?.hardware?.ram?.actual || 0,
          unit: 'GB',
          meetsRequirement: decisionResult.analysis?.hardware?.ram?.meets || false
        },
        cpu: {
          class: decisionResult.analysis?.hardware?.cpu?.actual || 'unknown',
          meetsRequirement: decisionResult.analysis?.hardware?.cpu?.meets || false
        },
        platform: decisionResult.analysis?.hardware?.specs?.platform || {}
      },

      // TEST RESULTS
      scanTest: decisionResult.analysis?.scanTest ? {
        conducted: true,
        passed: decisionResult.analysis.scanTest.passed,
        duration: decisionResult.analysis.scanTest.duration,
        performance: decisionResult.analysis.scanTest.performance
      } : {
        conducted: false,
        reason: 'Hardware requirements not met'
      },

      // USER INTERACTION (for hybrid mode)
      userChoices: userChoices || {
        hasAlternativePC: null,
        proceedWithPayment: null,
        hybridModeEnabled: false
      },

      // DECISION LOGIC
      decisionReasoning: {
        primaryReason: decisionResult.reason,
        decisionPath: decisionResult.analysis?.decisionPath || [],
        recommendedAction: decisionResult.recommendedAction
      },

      // APPLICATION GUIDANCE
      applicationBehavior: this.getApplicationBehavior(decisionResult.mode),
      
      // METADATA
      metadata: {
        decisionEngineVersion: '1.0.0',
        configurationVersion: AppModeConfigManager.getConfig().version,
        testMode: decisionResult.technical?.testMode || false,
        overridesApplied: decisionResult.technical?.overridesApplied || false
      }
    };
  }

  /**
   * Create detailed log file for debugging purposes
   * @param {Object} decisionResult - Decision result  
   * @param {Object} userChoices - User choices
   * @returns {Object} Detailed log data
   */
  createDetailedLogFile(decisionResult, userChoices) {
    return {
      sessionInfo: {
        timestamp: new Date().toISOString(),
        duration: decisionResult.duration,
        mode: decisionResult.mode,
        confidence: decisionResult.confidence
      },
      
      fullDecisionResult: decisionResult,
      userInteraction: userChoices,
      
      systemEnvironment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        electronVersion: process.versions.electron,
        appVersion: app.getVersion(),
        userDataDir: this.userDataDir
      },

      configuration: AppModeConfigManager.exportConfig(),
      
      performanceMetrics: {
        decisionDuration: decisionResult.duration,
        hardwareDetectionTime: decisionResult.analysis?.hardware?.specs?.detectionTime || 0,
        scanTestTime: decisionResult.analysis?.scanTest?.duration || 0
      },

      debugInfo: {
        decisionPath: decisionResult.analysis?.decisionPath || [],
        overridesApplied: decisionResult.technical?.overridesApplied || false,
        errors: decisionResult.technical?.error || null
      }
    };
  }

  /**
   * Create historical record for tracking
   * @param {Object} decisionResult - Decision result
   * @param {Object} userChoices - User choices
   * @returns {Object} Historical record
   */
  createHistoricalRecord(decisionResult, userChoices) {
    return {
      id: this.generateDecisionId(),
      timestamp: new Date().toISOString(),
      mode: decisionResult.mode,
      confidence: decisionResult.confidence,
      reason: decisionResult.reason,
      duration: decisionResult.duration,
      
      specs: {
        ram: decisionResult.analysis?.hardware?.ram?.actual || 0,
        cpu: decisionResult.analysis?.hardware?.cpu?.actual || 'unknown'
      },
      
      scanTest: {
        conducted: !!decisionResult.analysis?.scanTest,
        passed: decisionResult.analysis?.scanTest?.passed || false,
        duration: decisionResult.analysis?.scanTest?.duration || 0
      },
      
      userChoices: userChoices || {},
      
      metadata: {
        appVersion: app.getVersion(),
        configVersion: AppModeConfigManager.getConfig().version,
        testMode: decisionResult.technical?.testMode || false
      }
    };
  }

  /**
   * Get application behavior guidance for determined mode
   * @param {string} mode - Determined mode
   * @returns {Object} Application behavior guidance
   */
  getApplicationBehavior(mode) {
    const behaviors = {
      'SCAN': {
        features: {
          mlScanning: true,
          pdfProcessing: true,
          fullOfflineMode: true,
          advancedAnalytics: true
        },
        performance: {
          expectedSpeed: 'optimal',
          memoryUsage: 'high',
          cpuIntensive: true
        },
        recommendations: [
          'Enable all features',
          'Use full ML pipeline',
          'Expect optimal performance'
        ]
      },
      
      'UNSCAN': {
        features: {
          mlScanning: false,
          pdfProcessing: true,
          fullOfflineMode: true,
          advancedAnalytics: false
        },
        performance: {
          expectedSpeed: 'good',
          memoryUsage: 'moderate', 
          cpuIntensive: false
        },
        recommendations: [
          'Disable ML scanning features',
          'Use lightweight processing pipeline',
          'Manual categorization may be needed'
        ]
      },
      
      'HYBRID': {
        features: {
          mlScanning: false,
          pdfProcessing: false,
          fullOfflineMode: false,
          advancedAnalytics: true
        },
        performance: {
          expectedSpeed: 'variable',
          memoryUsage: 'low',
          cpuIntensive: false,
          requiresInternet: true
        },
        recommendations: [
          'Use cloud processing for heavy operations',
          'Require internet connectivity',
          'Payment and setup required'
        ]
      }
    };

    return behaviors[mode] || {
      features: {},
      performance: {},
      recommendations: ['Mode-specific behavior not defined']
    };
  }

  /**
   * Save JSON file with proper error handling
   * @param {string} filePath - File path
   * @param {Object} data - Data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveJSONFile(filePath, data) {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonString, 'utf8');
      this.logger?.info('MODE_STORAGE', `Saved file: ${path.basename(filePath)}`);
      return true;
    } catch (error) {
      this.logger?.error('MODE_STORAGE', `Failed to save ${path.basename(filePath)}`, {
        error: error.message,
        path: filePath
      });
      return false;
    }
  }

  /**
   * Append record to history file
   * @param {string} historyPath - History file path
   * @param {Object} record - Record to append
   * @returns {Promise<boolean>} Success status
   */
  async appendToHistory(historyPath, record) {
    try {
      let history = [];
      
      // Read existing history if file exists
      if (fs.existsSync(historyPath)) {
        const existingData = fs.readFileSync(historyPath, 'utf8');
        history = JSON.parse(existingData);
      }

      // Add new record
      history.push(record);

      // Keep only last 50 records to prevent file from growing too large
      if (history.length > 50) {
        history = history.slice(-50);
      }

      // Save updated history
      await this.saveJSONFile(historyPath, history);
      return true;

    } catch (error) {
      this.logger?.error('MODE_STORAGE', 'Failed to update history', {
        error: error.message,
        path: historyPath
      });
      return false;
    }
  }

  /**
   * Create timestamped backup
   * @param {Object} decisionResult - Decision result
   * @returns {string|null} Backup file path
   */
  createTimestampedBackup(decisionResult) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `decision_${decisionResult.mode}_${timestamp}.json`;
      const backupPath = path.join(this.storageDir, 'backups');
      
      // Ensure backups directory exists
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }

      const fullBackupPath = path.join(backupPath, backupFileName);
      fs.writeFileSync(fullBackupPath, JSON.stringify(decisionResult, null, 2), 'utf8');
      
      return fullBackupPath;

    } catch (error) {
      this.logger?.warn('MODE_STORAGE', 'Failed to create backup', { error: error.message });
      return null;
    }
  }

  /**
   * Generate unique decision ID
   * @returns {string} Decision ID
   */
  generateDecisionId() {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load the most recent mode decision
   * @returns {Object|null} Most recent decision
   */
  loadLastModeDecision() {
    try {
      const decisionPath = path.join(this.storageDir, 'appModeDecision.json');
      
      if (fs.existsSync(decisionPath)) {
        const data = fs.readFileSync(decisionPath, 'utf8');
        return JSON.parse(data);
      }
      
      return null;

    } catch (error) {
      this.logger?.error('MODE_STORAGE', 'Failed to load last decision', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get decision history
   * @param {number} limit - Maximum number of records to return
   * @returns {Array} Decision history
   */
  getDecisionHistory(limit = 10) {
    try {
      const historyPath = path.join(this.storageDir, 'decisionHistory.json');
      
      if (fs.existsSync(historyPath)) {
        const data = fs.readFileSync(historyPath, 'utf8');
        const history = JSON.parse(data);
        return history.slice(-limit);
      }
      
      return [];

    } catch (error) {
      this.logger?.error('MODE_STORAGE', 'Failed to load decision history', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Clean up old files
   * @param {number} maxAge - Maximum age in days
   * @returns {number} Number of files cleaned
   */
  cleanupOldFiles(maxAge = 30) {
    let cleanedCount = 0;
    
    try {
      const backupPath = path.join(this.storageDir, 'backups');
      
      if (fs.existsSync(backupPath)) {
        const files = fs.readdirSync(backupPath);
        const cutoffTime = Date.now() - (maxAge * 24 * 60 * 60 * 1000);
        
        for (const file of files) {
          const filePath = path.join(backupPath, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        }
      }
      
      this.logger?.info('MODE_STORAGE', `Cleaned up ${cleanedCount} old backup files`);
      
    } catch (error) {
      this.logger?.error('MODE_STORAGE', 'Failed to cleanup old files', {
        error: error.message
      });
    }
    
    return cleanedCount;
  }

  /**
   * Get storage directory path
   * @returns {string} Storage directory path
   */
  getStorageDirectory() {
    return this.storageDir;
  }

  /**
   * Get storage status and file information
   * @returns {Object} Storage status
   */
  getStorageStatus() {
    try {
      const status = {
        directory: this.storageDir,
        exists: fs.existsSync(this.storageDir),
        files: {}
      };

      if (status.exists) {
        const files = ['appModeDecision.json', 'modeDecisionLog.json', 'decisionHistory.json'];
        
        for (const file of files) {
          const filePath = path.join(this.storageDir, file);
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            status.files[file] = {
              exists: true,
              size: stats.size,
              modified: stats.mtime.toISOString()
            };
          } else {
            status.files[file] = { exists: false };
          }
        }
      }

      return status;

    } catch (error) {
      return {
        directory: this.storageDir,
        exists: false,
        error: error.message
      };
    }
  }
}

module.exports = { ModeStorageManager };