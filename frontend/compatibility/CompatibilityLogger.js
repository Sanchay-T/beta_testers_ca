// CompatibilityLogger.js
// Enhanced logging system for System Compatibility Checker Phase 2
// Provides structured logging, performance tracking, and detailed debugging capabilities

const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

class CompatibilityLogger {
  constructor(options = {}) {
    this.startTime = Date.now();
    this.sessionId = this.generateSessionId();
    this.logLevel = options.logLevel || process.env.CYPHERIDGE_COMPAT_DEBUG ? 'DEBUG' : 'INFO';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;
    
    // Log levels in order of severity
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      CRITICAL: 4
    };

    // Initialize log files
    if (this.enableFile) {
      this.initializeLogFiles();
    }

    // Log session start
    this.logSessionStart();
  }

  generateSessionId() {
    return `compat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  initializeLogFiles() {
    try {
      // Determine environment and set appropriate paths
      const isDev = !app.isPackaged;
      const userDataPath = app.getPath('userData');
      
      if (isDev) {
        // Development paths
        this.logDir = path.join(__dirname, 'log');  // Project directory
        this.userLogDir = path.join(userDataPath, 'logs', 'compatibility');
        this.reportsDir = path.join(__dirname, 'log', 'reports');
        this.sessionsDir = path.join(userDataPath, 'sessions');
      } else {
        // Production paths - all under CypherEdge directory
        const cypherEdgeDir = path.join(userDataPath, '..', 'CypherEdge');
        this.logDir = path.join(cypherEdgeDir, 'logs', 'compatibility');
        this.userLogDir = path.join(cypherEdgeDir, 'logs', 'compatibility');
        this.reportsDir = path.join(cypherEdgeDir, 'compatibility-reports');
        this.sessionsDir = path.join(cypherEdgeDir, 'sessions');
      }
      
      // Create all necessary directories
      [this.logDir, this.userLogDir, this.reportsDir, this.sessionsDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // Create log files with timestamps
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const timeString = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Clean timestamp
      
      // Main comprehensive flow log in compatibility/log
      this.flowLogFile = path.join(this.logDir, `FLOW_${timeString}.log`);
      this.detailedLogFile = path.join(this.logDir, `DETAILED_${timeString}.log`);
      
      // Standard logs in both locations
      this.logFile = path.join(this.logDir, `compatibility-${timestamp}.log`);
      this.jsonLogFile = path.join(this.logDir, `compatibility-${timeString}.json`);
      this.debugLogFile = path.join(this.logDir, `compatibility-debug-${timeString}.log`);
      
      // Also save to user data directory
      this.userLogFile = path.join(this.userLogDir, `compatibility-${timestamp}.log`);
      
      // Initialize comprehensive flow tracking
      this.flowSteps = [];
      this.detailedEvents = [];

      // Initialize JSON log file with session start
      this.jsonLogs = [];
      
    } catch (error) {
      console.error('Failed to initialize log files:', error);
      this.enableFile = false;
    }
  }

  logSessionStart() {
    const systemInfo = this.getSystemInfo();
    const sessionStart = {
      event: 'SESSION_START',
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      systemInfo,
      logLevel: this.logLevel,
      version: this.getCypherEdgeVersion()
    };

    this.log('INFO', 'SESSION_START', 'Compatibility check session started', sessionStart);
    
    // Write comprehensive flow header
    this.writeFlowLog('\n' + '='.repeat(80));
    this.writeFlowLog('CYPHEREDGE SYSTEM COMPATIBILITY CHECKER - COMPREHENSIVE FLOW LOG');
    this.writeFlowLog('='.repeat(80));
    this.writeFlowLog(`Session ID: ${this.sessionId}`);
    this.writeFlowLog(`Start Time: ${new Date().toISOString()}`);
    this.writeFlowLog(`Platform: ${systemInfo.platform} | Architecture: ${systemInfo.arch}`);
    this.writeFlowLog(`Memory: ${systemInfo.totalMemory} total | ${systemInfo.freeMemory} free`);
    this.writeFlowLog('='.repeat(80) + '\n');
    
    this.writeFlowLog('FLOW START: Initialization Step -1 beginning...');
  }

  getSystemInfo() {
    try {
      return {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + 'GB',
        freeMemory: Math.round(os.freememory() / (1024 * 1024 * 1024)) + 'GB',
        cpus: os.cpus().length,
        hostname: os.hostname(),
        userInfo: {
          username: os.userInfo().username,
          homedir: os.userInfo().homedir
        }
      };
    } catch (error) {
      return { error: 'Unable to collect system info: ' + error.message };
    }
  }

  getCypherEdgeVersion() {
    try {
      const packagePath = path.join(__dirname, '..', 'package.json');
      if (fs.existsSync(packagePath)) {
        const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return packageData.version || 'unknown';
      }
    } catch (error) {
      // Ignore version detection errors
    }
    return 'unknown';
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.logLevel];
  }

  formatLogMessage(level, category, message, data = null, timing = null) {
    const timestamp = new Date().toISOString();
    const sessionTime = Date.now() - this.startTime;
    
    const logEntry = {
      timestamp,
      sessionId: this.sessionId,
      sessionTime: `${sessionTime}ms`,
      level,
      category,
      message
    };

    if (data) {
      logEntry.data = data;
    }

    if (timing) {
      logEntry.timing = timing;
    }

    return logEntry;
  }

  log(level, category, message, data = null, timing = null) {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.formatLogMessage(level, category, message, data, timing);

    // Console logging with colors and formatting
    if (this.enableConsole) {
      this.logToConsole(logEntry);
    }

    // File logging
    if (this.enableFile) {
      this.logToFile(logEntry);
      this.logToJsonFile(logEntry);
    }
  }

  logToConsole(logEntry) {
    const { level, category, message, sessionTime, timing } = logEntry;
    
    // Color coding for different levels
    let colorCode = '';
    let resetCode = '\x1b[0m';
    
    switch (level) {
      case 'DEBUG': colorCode = '\x1b[36m'; break;  // Cyan
      case 'INFO': colorCode = '\x1b[32m'; break;   // Green
      case 'WARN': colorCode = '\x1b[33m'; break;   // Yellow
      case 'ERROR': colorCode = '\x1b[31m'; break;  // Red
      case 'CRITICAL': colorCode = '\x1b[35m'; break; // Magenta
    }

    // Format the console message
    let consoleMessage = `${colorCode}[${level}]${resetCode} `;
    consoleMessage += `${colorCode}[COMPAT-${category}]${resetCode} `;
    consoleMessage += `${message} `;
    consoleMessage += `${colorCode}(+${sessionTime}`;
    
    if (timing) {
      consoleMessage += ` | ${timing.duration}ms`;
    }
    
    consoleMessage += `)${resetCode}`;

    console.log(consoleMessage);

    // Log additional data if present (for DEBUG level)
    if (this.logLevel === 'DEBUG' && logEntry.data) {
      console.log('  📊 Data:', JSON.stringify(logEntry.data, null, 2));
    }
  }

  logToFile(logEntry) {
    try {
      const logLine = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.category}] ${logEntry.message}`;
      const logLineWithData = logEntry.data 
        ? `${logLine} | Data: ${JSON.stringify(logEntry.data)}\n`
        : `${logLine}\n`;
      
      // Write to both locations
      fs.appendFileSync(this.logFile, logLineWithData);
      if (this.userLogFile) {
        fs.appendFileSync(this.userLogFile, logLineWithData);
      }
      
      // Track comprehensive flow
      this.trackFlowEvent(logEntry);
      
      // Write detailed events
      if (logEntry.level !== 'DEBUG') {
        this.writeDetailedLog(logEntry);
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  logToJsonFile(logEntry) {
    try {
      this.jsonLogs.push(logEntry);
      
      // Write to JSON file (overwrite each time to maintain valid JSON)
      fs.writeFileSync(this.jsonLogFile, JSON.stringify(this.jsonLogs, null, 2));
    } catch (error) {
      console.error('Failed to write to JSON log file:', error);
    }
  }

  // Convenience methods for different log levels
  debug(category, message, data = null, timing = null) {
    this.log('DEBUG', category, message, data, timing);
  }

  info(category, message, data = null, timing = null) {
    this.log('INFO', category, message, data, timing);
  }

  warn(category, message, data = null, timing = null) {
    this.log('WARN', category, message, data, timing);
  }

  error(category, message, data = null, timing = null) {
    this.log('ERROR', category, message, data, timing);
  }

  critical(category, message, data = null, timing = null) {
    this.log('CRITICAL', category, message, data, timing);
  }

  // Test execution logging methods
  startTest(suiteName, testName) {
    const testId = `${suiteName}-${testName}`;
    const startTime = Date.now();
    
    this.info('TEST_START', `Starting test: ${testName}`, {
      suite: suiteName,
      test: testName,
      testId,
      startTime
    });

    return {
      testId,
      startTime,
      finish: (result) => this.finishTest(testId, suiteName, testName, startTime, result)
    };
  }

  finishTest(testId, suiteName, testName, startTime, result) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const level = result.success ? 'INFO' : (result.severity === 'warning' ? 'WARN' : 'ERROR');
    const status = result.success ? 'PASSED' : (result.severity === 'warning' ? 'WARNING' : 'FAILED');
    
    this.log(level, 'TEST_COMPLETE', `Test ${status}: ${testName}`, {
      suite: suiteName,
      test: testName,
      testId,
      result,
      timing: {
        startTime,
        endTime,
        duration: `${duration}ms`
      }
    }, { duration });
  }

  // Performance tracking
  startTimer(operation) {
    const startTime = Date.now();
    return {
      startTime,
      stop: () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        this.debug('PERFORMANCE', `${operation} completed`, {
          operation,
          timing: {
            startTime,
            endTime,
            duration: `${duration}ms`
          }
        }, { duration });
        return { duration, startTime, endTime };
      }
    };
  }

  // Session completion
  endSession(results) {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    const summary = {
      sessionId: this.sessionId,
      totalDuration: `${totalDuration}ms`,
      results: {
        canProceed: results.canProceed,
        successes: results.successes?.length || 0,
        warnings: results.warnings?.length || 0,
        errors: results.issues?.length || 0
      },
      endTime: new Date().toISOString()
    };

    this.info('SESSION_END', 'Compatibility check session completed', summary);
    
    // Write comprehensive flow summary
    this.writeFlowLog('\n' + '='.repeat(80));
    this.writeFlowLog('SESSION COMPLETE - SUMMARY');
    this.writeFlowLog('='.repeat(80));
    this.writeFlowLog(`Total Duration: ${totalDuration}ms`);
    this.writeFlowLog(`Can Proceed: ${results.canProceed}`);
    this.writeFlowLog(`Tests Passed: ${summary.results.successes}`);
    this.writeFlowLog(`Warnings: ${summary.results.warnings}`);
    this.writeFlowLog(`Errors: ${summary.results.errors}`);
    this.writeFlowLog('\nFLOW STEPS SUMMARY:');
    this.flowSteps.forEach((step, index) => {
      this.writeFlowLog(`  ${index + 1}. [+${step.time}ms] ${step.message}`);
    });
    this.writeFlowLog('\n' + '='.repeat(80));
    this.writeFlowLog(`Log files saved to: ${this.logDir}`);
    this.writeFlowLog('FLOW END');
    this.writeFlowLog('='.repeat(80) + '\n');

    // Final JSON log write
    if (this.enableFile) {
      this.logToJsonFile({
        event: 'SESSION_END',
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        ...summary
      });
      
      // Save flow summary
      this.saveFlowSummary(results);
    }

    return summary;
  }
  
  // Save a comprehensive flow summary
  saveFlowSummary(results) {
    try {
      const summaryPath = path.join(this.logDir, `FLOW_SUMMARY_${this.sessionId}.json`);
      const flowSummary = {
        sessionId: this.sessionId,
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        totalDuration: Date.now() - this.startTime,
        systemInfo: this.getSystemInfo(),
        flowSteps: this.flowSteps,
        testResults: results,
        detailedEventCount: this.detailedEvents.length,
        logFiles: this.getLogPaths()
      };
      
      fs.writeFileSync(summaryPath, JSON.stringify(flowSummary, null, 2));
      this.writeFlowLog(`Flow summary saved to: ${summaryPath}`);
    } catch (error) {
      console.error('Failed to save flow summary:', error);
    }
  }

  // Get log file paths for external access
  getLogPaths() {
    return {
      flowLog: this.flowLogFile,
      detailedLog: this.detailedLogFile,
      mainLog: this.logFile,
      jsonLog: this.jsonLogFile,
      debugLog: this.debugLogFile,
      logDir: this.logDir,
      userLogDir: this.userLogDir,
      reportsDir: this.reportsDir,
      sessionsDir: this.sessionsDir
    };
  }

  /**
   * Get environment-aware storage information
   * @returns {Object} Storage information
   */
  getStorageInfo() {
    const isDev = !require('electron').app.isPackaged;
    return {
      environment: isDev ? 'development' : 'production',
      paths: {
        compatibilityLogs: this.logDir,
        userLogs: this.userLogDir,
        reports: this.reportsDir,
        sessions: this.sessionsDir
      },
      description: isDev 
        ? 'Development: Logs in project directory, user data in %APPDATA%/electronapp'
        : 'Production: All data in %APPDATA%/CypherEdge directory structure'
    };
  }
  
  // Write to comprehensive flow log
  writeFlowLog(message) {
    try {
      if (this.flowLogFile) {
        const timestamp = new Date().toISOString();
        const sessionTime = Date.now() - this.startTime;
        const flowLine = `[${timestamp}] [+${sessionTime}ms] ${message}\n`;
        fs.appendFileSync(this.flowLogFile, flowLine);
      }
    } catch (error) {
      console.error('Failed to write flow log:', error);
    }
  }
  
  // Track flow events for comprehensive logging
  trackFlowEvent(logEntry) {
    const flowMessage = this.formatFlowMessage(logEntry);
    if (flowMessage) {
      this.writeFlowLog(flowMessage);
      this.flowSteps.push({
        time: Date.now() - this.startTime,
        category: logEntry.category,
        message: flowMessage
      });
    }
  }
  
  // Format messages for flow tracking
  formatFlowMessage(logEntry) {
    const { category, message, level, data } = logEntry;
    
    // Key events to track in flow
    const flowEvents = [
      'SESSION_START', 'SESSION_END', 'SESSION_ERROR',
      'WINDOW_CREATE', 'WINDOW_READY', 'USER_ACTION', 'USER_DECISION',
      'TESTS_START', 'SUITE_START', 'TEST_START', 'TEST_COMPLETE', 'TESTS_COMPLETE',
      'COMPONENT_FLOW', 'PORT_TEST', 'MEMORY_TEST', 'DISK_TEST', 'OS_TEST',
      'ADMIN_TEST', 'PYTHON_TEST', 'GATEWAY_TEST', 'DATABASE_TEST', 'PERMISSIONS_TEST',
      'FASTAPI_TEST', 'FASTAPI_DEPS_TEST', 'PDF_PROCESSING_TEST',
      'COMPATIBILITY_CALCULATION', 'COMPATIBILITY_BLOCKED', 'COMPATIBILITY_WARNING', 'COMPATIBILITY_PASSED',
      'REPORT_REQUEST', 'REPORT_GENERATED', 'AUTO_START'
    ];
    
    if (flowEvents.includes(category)) {
      let flowMsg = `[${level}] ${category}: ${message}`;
      
      // Add relevant data for specific events
      if (category === 'TEST_COMPLETE' && data?.result) {
        flowMsg += ` | Status: ${data.result.success ? 'PASSED' : 'FAILED'}`;
        if (data.timing) {
          flowMsg += ` | Duration: ${data.timing.duration}`;
        }
      } else if (category === 'SUITE_START' && data?.suiteName) {
        flowMsg += ` | Suite: ${data.suiteName} (${data.testCount} tests)`;
      } else if (category === 'USER_DECISION' && data?.decision) {
        flowMsg += ` | Decision: ${data.decision}`;
      } else if (category === 'COMPATIBILITY_CALCULATION' && data) {
        flowMsg += ` | Blocking: ${data.blockingIssues}, Critical: ${data.criticalIssues}, Warnings: ${data.warnings}`;
      }
      
      return flowMsg;
    }
    
    return null;
  }
  
  // Write detailed log entries
  writeDetailedLog(logEntry) {
    try {
      if (this.detailedLogFile) {
        const timestamp = new Date().toISOString();
        const sessionTime = Date.now() - this.startTime;
        
        let detailedLine = `\n${'='.repeat(60)}\n`;
        detailedLine += `Time: ${timestamp} (+${sessionTime}ms)\n`;
        detailedLine += `Level: ${logEntry.level} | Category: ${logEntry.category}\n`;
        detailedLine += `Message: ${logEntry.message}\n`;
        
        if (logEntry.data) {
          detailedLine += `Data:\n${JSON.stringify(logEntry.data, null, 2)}\n`;
        }
        
        if (logEntry.timing) {
          detailedLine += `Timing: ${JSON.stringify(logEntry.timing)}\n`;
        }
        
        fs.appendFileSync(this.detailedLogFile, detailedLine);
        
        // Track in memory for summary
        this.detailedEvents.push({
          time: sessionTime,
          level: logEntry.level,
          category: logEntry.category,
          message: logEntry.message
        });
      }
    } catch (error) {
      console.error('Failed to write detailed log:', error);
    }
  }

  // Create a summary report
  generateSummaryReport(results) {
    const report = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      systemInfo: this.getSystemInfo(),
      results,
      logFiles: this.getLogPaths()
    };

    try {
      const reportPath = path.join(this.logDir, `compatibility-report-${this.sessionId}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      this.info('REPORT_GENERATED', 'Compatibility report generated', {
        reportPath,
        resultsCount: {
          successes: results.successes?.length || 0,
          warnings: results.warnings?.length || 0,
          errors: results.issues?.length || 0
        }
      });

      return reportPath;
    } catch (error) {
      this.error('REPORT_ERROR', 'Failed to generate compatibility report', { error: error.message });
      return null;
    }
  }
}

module.exports = { CompatibilityLogger };