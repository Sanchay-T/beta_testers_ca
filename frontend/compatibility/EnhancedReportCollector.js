// EnhancedReportCollector.js
// Comprehensive report collection system for compatibility checker
// Collects user interactions, system info, test results, and mode decisions

const fs = require('fs');
const path = require('path');
const os = require('os');
const pathResolver = require('./utils/PathResolver');
const { app } = require('electron');

class EnhancedReportCollector {
  constructor(logger = null) {
    this.logger = logger;
    this.isDev = !app.isPackaged;
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    
    this.report = {
      meta: {
        sessionId: this.sessionId,
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        environment: this.isDev ? 'development' : 'production',
        appVersion: app.getVersion(),
        compatibilityCheckerVersion: '2.0.0'
      },
      system: {},
      compatibility: {
        startTime: null,
        endTime: null,
        duration: null,
        testResults: [],
        overallResult: null
      },
      modeDetection: {
        determinedMode: null,
        confidence: null,
        reason: null,
        analysis: null,
        timestamp: null
      },
      userInteractions: [],
      notifications: [],
      finalOutcome: null,
      storage: {
        paths: this.getStoragePaths(),
        files: []
      },
      errors: []
    };

    this.initializeSystemInfo();
    this.logger?.info('ENHANCED_REPORT', 'Enhanced report collector initialized', {
      sessionId: this.sessionId,
      environment: this.isDev ? 'development' : 'production'
    });
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `compat-${timestamp}-${random}`;
  }

  /**
   * Get storage paths based on environment
   * @returns {Object} Storage paths
   */
  getStoragePaths() {
    const userDataDir = app.getPath('userData');
    
    if (this.isDev) {
      // Development paths - use PathResolver for dynamic paths
      return {
        compatibilityLogs: pathResolver.getLogDir(),
        userLogs: path.join(userDataDir, 'logs', 'compatibility'),
        modeDecision: path.join(userDataDir, 'appMode'),
        reports: pathResolver.getReportsDir(),
        sessions: path.join(userDataDir, 'sessions')
      };
    } else {
      // Production paths
      const cypherEdgeDir = path.join(userDataDir, '..', 'CypherEdge');
      return {
        compatibilityLogs: path.join(cypherEdgeDir, 'logs', 'compatibility'),
        userLogs: path.join(cypherEdgeDir, 'logs', 'compatibility'),
        modeDecision: path.join(cypherEdgeDir, 'appMode'),
        reports: path.join(cypherEdgeDir, 'compatibility-reports'),
        sessions: path.join(cypherEdgeDir, 'sessions')
      };
    }
  }

  /**
   * Initialize system information
   */
  initializeSystemInfo() {
    try {
      this.report.system = {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        type: os.type(),
        totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)), // GB
        freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024)), // GB
        cpuCount: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'unknown',
        hostname: os.hostname(),
        userInfo: {
          username: os.userInfo().username,
          homedir: os.userInfo().homedir
        },
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        v8Version: process.versions.v8
      };
    } catch (error) {
      this.logger?.error('REPORT_SYSTEM_INFO', 'Failed to collect system information', {
        error: error.message
      });
      this.addError('system_info_collection', error.message);
    }
  }

  /**
   * Start compatibility check tracking
   */
  startCompatibilityCheck() {
    this.report.compatibility.startTime = new Date().toISOString();
    this.addUserInteraction('compatibility_check_started', {
      timestamp: this.report.compatibility.startTime,
      action: 'Started compatibility check'
    });
    
    this.logger?.info('REPORT_TRACKING', 'Started tracking compatibility check');
  }

  /**
   * Add test result
   * @param {string} testName - Test name
   * @param {Object} result - Test result
   */
  addTestResult(testName, result) {
    const testResult = {
      name: testName,
      timestamp: new Date().toISOString(),
      success: result.success,
      severity: result.severity || 'info',
      message: result.message,
      details: result.details || {},
      duration: result.duration || 0
    };

    this.report.compatibility.testResults.push(testResult);
    
    this.logger?.debug('REPORT_TEST_RESULT', 'Added test result to report', {
      testName,
      success: result.success,
      severity: result.severity
    });
  }

  /**
   * Set mode detection result
   * @param {Object} modeResult - Mode detection result
   */
  setModeDetectionResult(modeResult) {
    this.report.modeDetection = {
      determinedMode: modeResult.determinedMode,
      confidence: modeResult.confidence,
      reason: modeResult.reason,
      analysis: modeResult.analysis,
      timestamp: modeResult.timestamp || new Date().toISOString(),
      duration: modeResult.duration,
      userMessage: modeResult.userMessage,
      canProceed: modeResult.canProceed
    };

    this.addUserInteraction('mode_determined', {
      mode: modeResult.determinedMode,
      confidence: modeResult.confidence,
      reason: modeResult.reason
    });

    this.logger?.info('REPORT_MODE_DETECTION', 'Mode detection result added to report', {
      mode: modeResult.determinedMode,
      confidence: modeResult.confidence
    });
  }

  /**
   * Add user interaction
   * @param {string} action - Action type
   * @param {Object} data - Interaction data
   */
  addUserInteraction(action, data = {}) {
    const interaction = {
      timestamp: new Date().toISOString(),
      action: action,
      data: data,
      sessionTime: Date.now() - this.sessionStartTime
    };

    this.report.userInteractions.push(interaction);
    
    this.logger?.debug('REPORT_USER_INTERACTION', 'User interaction recorded', {
      action,
      sessionTime: interaction.sessionTime
    });
  }

  /**
   * Add notification event
   * @param {string} type - Notification type (UNSCAN, HYBRID, etc.)
   * @param {Object} data - Notification data
   */
  addNotification(type, data = {}) {
    const notification = {
      timestamp: new Date().toISOString(),
      type: type,
      data: data,
      sessionTime: Date.now() - this.sessionStartTime
    };

    this.report.notifications.push(notification);
    
    this.logger?.info('REPORT_NOTIFICATION', 'Notification event recorded', {
      type,
      sessionTime: notification.sessionTime
    });
  }

  /**
   * Add error to report
   * @param {string} context - Error context
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   */
  addError(context, message, details = {}) {
    const error = {
      timestamp: new Date().toISOString(),
      context: context,
      message: message,
      details: details,
      sessionTime: Date.now() - this.sessionStartTime
    };

    this.report.errors.push(error);
    
    this.logger?.error('REPORT_ERROR', 'Error added to report', {
      context,
      message
    });
  }

  /**
   * Set final outcome
   * @param {string} outcome - Final outcome (proceed, cancelled, payment, etc.)
   * @param {Object} data - Additional data
   */
  setFinalOutcome(outcome, data = {}) {
    this.report.finalOutcome = {
      outcome: outcome,
      timestamp: new Date().toISOString(),
      sessionTime: Date.now() - this.sessionStartTime,
      data: data
    };

    // End compatibility check tracking
    this.report.compatibility.endTime = new Date().toISOString();
    this.report.compatibility.duration = Date.now() - this.sessionStartTime;

    this.addUserInteraction('final_outcome_set', {
      outcome: outcome,
      totalDuration: this.report.compatibility.duration
    });

    this.logger?.info('REPORT_FINAL_OUTCOME', 'Final outcome set', {
      outcome,
      duration: this.report.compatibility.duration
    });
  }

  /**
   * Generate comprehensive report summary
   * @returns {Object} Report summary
   */
  generateSummary() {
    const testResults = this.report.compatibility.testResults;
    const successfulTests = testResults.filter(t => t.success).length;
    const failedTests = testResults.filter(t => !t.success).length;
    const criticalIssues = testResults.filter(t => t.severity === 'critical' && !t.success).length;
    const warnings = testResults.filter(t => t.severity === 'warning' && !t.success).length;

    return {
      sessionId: this.sessionId,
      environment: this.report.meta.environment,
      duration: this.report.compatibility.duration,
      mode: this.report.modeDetection.determinedMode,
      outcome: this.report.finalOutcome?.outcome,
      system: {
        platform: this.report.system.platform,
        totalMemory: this.report.system.totalMemory,
        cpuModel: this.report.system.cpuModel
      },
      tests: {
        total: testResults.length,
        successful: successfulTests,
        failed: failedTests,
        critical: criticalIssues,
        warnings: warnings
      },
      interactions: this.report.userInteractions.length,
      notifications: this.report.notifications.length,
      errors: this.report.errors.length
    };
  }

  /**
   * Save comprehensive report to files
   * @returns {Promise<Object>} Save result
   */
  async saveReport() {
    try {
      // Ensure report directories exist
      const reportDir = this.report.storage.paths.reports;
      const sessionDir = this.report.storage.paths.sessions;

      this.ensureDirectoryExists(reportDir);
      this.ensureDirectoryExists(sessionDir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      
      // Main report file
      const reportFileName = `compatibility-report-${this.sessionId}.json`;
      const reportPath = path.join(reportDir, reportFileName);
      
      // Session summary file
      const summaryFileName = `session-summary-${timestamp}.json`;
      const summaryPath = path.join(sessionDir, summaryFileName);

      // Human-readable report
      const readableFileName = `report-${timestamp}.txt`;
      const readablePath = path.join(reportDir, readableFileName);

      // Save main report
      fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2), 'utf8');
      
      // Save summary
      const summary = this.generateSummary();
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

      // Save human-readable report
      const readableContent = this.generateHumanReadableReport();
      fs.writeFileSync(readablePath, readableContent, 'utf8');

      // Update storage files list
      this.report.storage.files = [
        { type: 'main_report', path: reportPath },
        { type: 'summary', path: summaryPath },
        { type: 'readable', path: readablePath }
      ];

      this.logger?.info('REPORT_SAVE', 'Comprehensive report saved successfully', {
        reportPath,
        summaryPath,
        readablePath,
        sessionId: this.sessionId
      });

      return {
        success: true,
        sessionId: this.sessionId,
        files: this.report.storage.files,
        summary: summary
      };

    } catch (error) {
      this.logger?.error('REPORT_SAVE_ERROR', 'Failed to save comprehensive report', {
        error: error.message,
        stack: error.stack
      });

      this.addError('report_save', error.message, { stack: error.stack });

      return {
        success: false,
        error: error.message,
        sessionId: this.sessionId
      };
    }
  }

  /**
   * Generate human-readable report
   * @returns {string} Human-readable report content
   */
  generateHumanReadableReport() {
    const summary = this.generateSummary();
    
    let content = `
CYPHEREDGE COMPATIBILITY CHECK REPORT
=====================================

Session Information:
- Session ID: ${this.sessionId}
- Environment: ${this.report.meta.environment}
- Timestamp: ${this.report.meta.timestamp}
- Duration: ${summary.duration ? Math.round(summary.duration / 1000) + 's' : 'N/A'}

System Information:
- Platform: ${this.report.system.platform} ${this.report.system.arch}
- OS Release: ${this.report.system.release}
- Total Memory: ${this.report.system.totalMemory}GB
- Free Memory: ${this.report.system.freeMemory}GB
- CPU: ${this.report.system.cpuModel}
- CPU Cores: ${this.report.system.cpuCount}

Compatibility Test Results:
- Total Tests: ${summary.tests.total}
- Successful: ${summary.tests.successful}
- Failed: ${summary.tests.failed}
- Critical Issues: ${summary.tests.critical}
- Warnings: ${summary.tests.warnings}

Mode Detection:
- Determined Mode: ${this.report.modeDetection.determinedMode || 'Not determined'}
- Confidence: ${this.report.modeDetection.confidence || 'N/A'}
- Reason: ${this.report.modeDetection.reason || 'N/A'}

User Interactions:
- Total Interactions: ${summary.interactions}
- Notifications Shown: ${summary.notifications}
- Final Outcome: ${summary.outcome || 'Not completed'}

`;

    if (this.report.errors.length > 0) {
      content += `
Errors Encountered:
`;
      this.report.errors.forEach((error, index) => {
        content += `- ${index + 1}. ${error.context}: ${error.message}\n`;
      });
    }

    content += `
Storage Locations (${this.report.meta.environment}):
- Reports: ${this.report.storage.paths.reports}
- Sessions: ${this.report.storage.paths.sessions}
- Mode Decisions: ${this.report.storage.paths.modeDecision}
- Compatibility Logs: ${this.report.storage.paths.compatibilityLogs}

Generated by CypherEdge Enhanced Report Collector v2.0.0
`;

    return content;
  }

  /**
   * Ensure directory exists
   * @param {string} dirPath - Directory path
   */
  ensureDirectoryExists(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      this.logger?.error('REPORT_DIR_CREATE', 'Failed to create directory', {
        path: dirPath,
        error: error.message
      });
    }
  }

  /**
   * Get current report data
   * @returns {Object} Current report
   */
  getReport() {
    return { ...this.report };
  }

  /**
   * Get report summary
   * @returns {Object} Report summary
   */
  getSummary() {
    return this.generateSummary();
  }
}

module.exports = { EnhancedReportCollector };