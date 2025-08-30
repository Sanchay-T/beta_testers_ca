const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class CyphersolLogger {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.buildId = this.getBuildId();
    this.systemInfo = null;
    this.setupLoggers();
    this.initializeSystemInfo();
  }

  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getBuildId() {
    try {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return `${packageJson.version}-${Date.now()}`;
    } catch (error) {
      return `unknown-${Date.now()}`;
    }
  }

  setupLoggers() {
    try {
      const userDataDir = app ? app.getPath('userData') : './logs';
      const logsDir = path.join(userDataDir, 'logs');
      
      // Ensure logs directory exists
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Configure main logger
      log.transports.file.level = 'debug';
      log.transports.console.level = 'debug';
      log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
      log.transports.file.archiveLog = true;
      log.transports.file.fileName = 'cyphersol-main.log';
      log.transports.file.resolvePathFn = () => path.join(logsDir, 'cyphersol-main.log');

      // Create specialized loggers
      this.createSpecializedLoggers(logsDir);
      
      // Setup log rotation
      this.setupLogRotation(logsDir);
    } catch (error) {
      // Fallback to console logging if file logging fails
      console.error('Failed to setup file logging:', error);
      log.transports.file.level = false;
      log.transports.console.level = 'debug';
    }
  }

  createSpecializedLoggers(logsDir) {
    try {
      // Build Process Logger
      this.buildLogger = log.create('build');
      this.buildLogger.transports.file.fileName = 'build.log';
      this.buildLogger.transports.file.resolvePathFn = () => path.join(logsDir, 'build.log');
      this.buildLogger.transports.console.level = 'info';

      // Update Process Logger
      this.updateLogger = log.create('update');
      this.updateLogger.transports.file.fileName = 'update.log';
      this.updateLogger.transports.file.resolvePathFn = () => path.join(logsDir, 'update.log');
      this.updateLogger.transports.console.level = 'info';

      // Database Logger
      this.dbLogger = log.create('database');
      this.dbLogger.transports.file.fileName = 'database.log';
      this.dbLogger.transports.file.resolvePathFn = () => path.join(logsDir, 'database.log');
      this.dbLogger.transports.console.level = 'warn';

      // Network Logger
      this.networkLogger = log.create('network');
      this.networkLogger.transports.file.fileName = 'network.log';
      this.networkLogger.transports.file.resolvePathFn = () => path.join(logsDir, 'network.log');
      this.networkLogger.transports.console.level = 'warn';

      // Performance Logger
      this.perfLogger = log.create('performance');
      this.perfLogger.transports.file.fileName = 'performance.log';
      this.perfLogger.transports.file.resolvePathFn = () => path.join(logsDir, 'performance.log');
      this.perfLogger.transports.console.level = 'info';

      // Error Logger (Critical issues only)
      this.errorLogger = log.create('error');
      this.errorLogger.transports.file.fileName = 'errors.log';
      this.errorLogger.transports.file.resolvePathFn = () => path.join(logsDir, 'errors.log');
      this.errorLogger.transports.console.level = 'error';

      // User Actions Logger
      this.userLogger = log.create('user');
      this.userLogger.transports.file.fileName = 'user-actions.log';
      this.userLogger.transports.file.resolvePathFn = () => path.join(logsDir, 'user-actions.log');
      this.userLogger.transports.console.level = false; // Don't spam console with user actions
    } catch (error) {
      console.error('Failed to create specialized loggers:', error);
      // Create fallback loggers that just use the main logger
      this.buildLogger = log;
      this.updateLogger = log;
      this.dbLogger = log;
      this.networkLogger = log;
      this.perfLogger = log;
      this.errorLogger = log;
      this.userLogger = log;
    }
  }

  setupLogRotation(logsDir) {
    // Clean up old logs (keep last 30 days)
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    
    try {
      const files = fs.readdirSync(logsDir);
      const now = Date.now();
      
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          this.info('SYSTEM', 'Cleaned up old log file', { file });
        }
      });
    } catch (error) {
      this.error('SYSTEM', 'Failed to clean up old logs', { error: error.message });
    }
  }

  async initializeSystemInfo() {
    try {
      const si = require('systeminformation');
      this.systemInfo = {
        os: await si.osInfo(),
        cpu: await si.cpu(),
        mem: await si.mem(),
        disk: await si.diskLayout(),
        network: await si.networkInterfaces(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.systemInfo = {
        error: 'Failed to gather system info',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Enhanced logging methods with context
  formatMessage(component, message, context = {}) {
    const timestamp = new Date().toISOString();
    const baseContext = {
      sessionId: this.sessionId,
      buildId: this.buildId,
      component,
      timestamp,
      pid: process.pid,
      platform: process.platform,
      version: app ? app.getVersion() : 'unknown'
    };

    return {
      message,
      context: { ...baseContext, ...context }
    };
  }

  // Main logging methods
  trace(component, message, context = {}) {
    const formatted = this.formatMessage(component, message, context);
    log.silly(`[${component}] ${message}`, formatted.context);
  }

  debug(component, message, context = {}) {
    const formatted = this.formatMessage(component, message, context);
    log.debug(`[${component}] ${message}`, formatted.context);
  }

  info(component, message, context = {}) {
    const formatted = this.formatMessage(component, message, context);
    log.info(`[${component}] ${message}`, formatted.context);
  }

  warn(component, message, context = {}) {
    const formatted = this.formatMessage(component, message, context);
    log.warn(`[${component}] ⚠️  ${message}`, formatted.context);
  }

  error(component, message, context = {}) {
    const formatted = this.formatMessage(component, message, context);
    log.error(`[${component}] ❌ ${message}`, formatted.context);
    
    // Also log to error logger
    this.errorLogger.error(`[${component}] ${message}`, formatted.context);
  }

  fatal(component, message, context = {}) {
    const formatted = this.formatMessage(component, message, context);
    log.error(`[${component}] 💀 FATAL: ${message}`, formatted.context);
    
    // Log to error logger with FATAL prefix
    this.errorLogger.error(`FATAL [${component}] ${message}`, formatted.context);
  }

  // Specialized logging methods
  
  // Build Process Logging
  buildStart(version, platform) {
    const context = { version, platform, stage: 'start' };
    this.buildLogger.info('🏗️  BUILD STARTED', context);
    this.info('BUILD', 'Build process initiated', context);
  }

  buildStep(step, details = {}) {
    const context = { step, stage: 'progress', ...details };
    this.buildLogger.info(`📦 ${step}`, context);
    this.info('BUILD', step, context);
  }

  buildError(step, error, details = {}) {
    const context = { step, error: error.message, stack: error.stack, stage: 'error', ...details };
    this.buildLogger.error(`❌ BUILD FAILED: ${step}`, context);
    this.error('BUILD', `Build failed at ${step}`, context);
  }

  buildSuccess(outputPath, size, duration) {
    const context = { outputPath, size, duration, stage: 'complete' };
    this.buildLogger.info('✅ BUILD COMPLETED', context);
    this.info('BUILD', 'Build completed successfully', context);
  }

  // Update Process Logging
  updateStart(currentVersion, targetVersion) {
    const context = { currentVersion, targetVersion, stage: 'start' };
    this.updateLogger.info('🔄 UPDATE STARTED', context);
    this.info('UPDATE', 'Update process initiated', context);
  }

  updateProgress(stage, progress, details = {}) {
    const context = { stage, progress, ...details };
    this.updateLogger.info(`📥 ${stage}: ${progress}%`, context);
    this.debug('UPDATE', `${stage} progress: ${progress}%`, context);
  }

  updateCleanup(action, success, details = {}) {
    const context = { action, success, stage: 'cleanup', ...details };
    const status = success ? '✅' : '❌';
    this.updateLogger.info(`${status} CLEANUP: ${action}`, context);
    this.info('UPDATE', `Cleanup ${action}: ${success ? 'success' : 'failed'}`, context);
  }

  updateError(stage, error, details = {}) {
    const context = { stage, error: error.message, stack: error.stack, ...details };
    this.updateLogger.error(`❌ UPDATE FAILED: ${stage}`, context);
    this.error('UPDATE', `Update failed at ${stage}`, context);
  }

  updateSuccess(newVersion, duration) {
    const context = { newVersion, duration, stage: 'complete' };
    this.updateLogger.info('✅ UPDATE COMPLETED', context);
    this.info('UPDATE', 'Update completed successfully', context);
  }

  // Database Logging
  dbQuery(query, duration, rowCount, params = {}) {
    const context = { query, duration, rowCount, params };
    this.dbLogger.debug('🗄️  DB QUERY', context);
    
    if (duration > 1000) { // Log slow queries
      this.warn('DATABASE', 'Slow query detected', context);
    }
  }

  dbError(operation, error, query = null) {
    const context = { operation, error: error.message, query, stack: error.stack };
    this.dbLogger.error('❌ DB ERROR', context);
    this.error('DATABASE', `Database error in ${operation}`, context);
  }

  dbConnection(action, success, details = {}) {
    const context = { action, success, ...details };
    const status = success ? '✅' : '❌';
    this.dbLogger.info(`${status} DB ${action.toUpperCase()}`, context);
    this.info('DATABASE', `Database ${action}: ${success ? 'success' : 'failed'}`, context);
  }

  // Network Logging
  networkRequest(method, url, duration, status, size = null) {
    const context = { method, url, duration, status, size };
    this.networkLogger.debug(`🌐 ${method} ${url}`, context);
    
    if (status >= 400) {
      this.warn('NETWORK', `HTTP ${status} error`, context);
    }
    
    if (duration > 5000) { // Log slow requests
      this.warn('NETWORK', 'Slow network request', context);
    }
  }

  networkError(operation, error, url = null) {
    const context = { operation, error: error.message, url, stack: error.stack };
    this.networkLogger.error('❌ NETWORK ERROR', context);
    this.error('NETWORK', `Network error in ${operation}`, context);
  }

  // Performance Logging
  perfStart(operation) {
    const startTime = Date.now();
    return {
      operation,
      startTime,
      end: (details = {}) => {
        const duration = Date.now() - startTime;
        const context = { operation, duration, ...details };
        this.perfLogger.info(`⏱️  ${operation}: ${duration}ms`, context);
        
        if (duration > 10000) { // Log operations taking more than 10 seconds
          this.warn('PERFORMANCE', 'Slow operation detected', context);
        }
        
        return duration;
      }
    };
  }

  perfMemory(operation, details = {}) {
    const memUsage = process.memoryUsage();
    const context = { 
      operation, 
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
      },
      ...details 
    };
    this.perfLogger.info(`💾 MEMORY: ${operation}`, context);
  }

  // User Action Logging
  userAction(action, details = {}) {
    const context = { action, ...details };
    this.userLogger.info(`👤 ${action}`, context);
  }

  userError(action, error, details = {}) {
    const context = { action, error: error.message, ...details };
    this.userLogger.error(`👤 ERROR: ${action}`, context);
    this.error('USER', `User action failed: ${action}`, context);
  }

  // System State Logging
  systemState(component, state, details = {}) {
    const context = { 
      component, 
      state, 
      systemInfo: this.systemInfo,
      ...details 
    };
    this.info('SYSTEM', `${component} state: ${state}`, context);
  }

  // Process Logging
  processStart(processName, command, args = []) {
    const context = { processName, command, args };
    this.info('PROCESS', `Starting ${processName}`, context);
  }

  processExit(processName, exitCode, signal = null) {
    const context = { processName, exitCode, signal };
    if (exitCode === 0) {
      this.info('PROCESS', `${processName} exited normally`, context);
    } else {
      this.error('PROCESS', `${processName} exited with error`, context);
    }
  }

  processOutput(processName, output, isError = false) {
    const context = { processName, output };
    if (isError) {
      this.warn('PROCESS', `${processName} stderr`, context);
    } else {
      this.debug('PROCESS', `${processName} stdout`, context);
    }
  }

  // File Operation Logging
  fileOperation(operation, filePath, success, details = {}) {
    const context = { operation, filePath, success, ...details };
    const status = success ? '✅' : '❌';
    this.debug('FILE', `${status} ${operation}: ${filePath}`, context);
    
    if (!success) {
      this.warn('FILE', `File operation failed: ${operation}`, context);
    }
  }

  // Startup Logging
  startupPhase(phase, duration = null, details = {}) {
    const context = { phase, duration, ...details };
    this.info('STARTUP', `Phase: ${phase}${duration ? ` (${duration}ms)` : ''}`, context);
  }

  // Session Logging
  sessionEvent(event, userId = null, details = {}) {
    const context = { event, userId, ...details };
    this.userAction(`SESSION_${event.toUpperCase()}`, context);
  }

  // License Logging
  licenseEvent(event, details = {}) {
    const context = { event, ...details };
    this.info('LICENSE', event, context);
  }

  // Generate diagnostic report
  generateDiagnosticReport() {
    const report = {
      sessionId: this.sessionId,
      buildId: this.buildId,
      timestamp: new Date().toISOString(),
      systemInfo: this.systemInfo,
      appVersion: app ? app.getVersion() : 'unknown',
      platform: process.platform,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    this.info('DIAGNOSTIC', 'Generated diagnostic report', report);
    return report;
  }
}

// Create singleton instance
const logger = new CyphersolLogger();

module.exports = logger; 