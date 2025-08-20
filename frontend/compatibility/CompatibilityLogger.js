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
      // Create logs directory in user data
      const userDataPath = app.getPath('userData');
      this.logDir = path.join(userDataPath, 'logs', 'compatibility');
      
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Create log files with timestamps
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const timeString = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Clean timestamp
      
      this.logFile = path.join(this.logDir, `compatibility-${timestamp}.log`);
      this.jsonLogFile = path.join(this.logDir, `compatibility-${timeString}.json`);
      this.debugLogFile = path.join(this.logDir, `compatibility-debug-${timeString}.log`);

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
      
      fs.appendFileSync(this.logFile, logLineWithData);
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

    // Final JSON log write
    if (this.enableFile) {
      this.logToJsonFile({
        event: 'SESSION_END',
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        ...summary
      });
    }

    return summary;
  }

  // Get log file paths for external access
  getLogPaths() {
    return {
      mainLog: this.logFile,
      jsonLog: this.jsonLogFile,
      debugLog: this.debugLogFile,
      logDir: this.logDir
    };
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