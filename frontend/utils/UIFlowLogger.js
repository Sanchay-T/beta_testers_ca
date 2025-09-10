/**
 * CypherEdge UI Flow Logger
 * Comprehensive logging system to track page navigation, button clicks, 
 * file paths, backend interactions, and complete user flow
 * 
 * File: frontend/utils/UIFlowLogger.js
 */

const log = require("electron-log");
const path = require("path");
const fs = require("fs");

class UIFlowLogger {
  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development' || process.env.UI_FLOW_LOGGING === 'true';
    this.sessionId = this.generateSessionId();
    this.currentPage = null;
    this.navigationHistory = [];
    this.userActions = [];
    this.backendInteractions = [];
    this.componentStack = [];
    
    if (this.isEnabled) {
      this.initializeLogger();
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  initializeLogger() {
    log.info("🚀 [UI_FLOW_LOGGER] Initializing comprehensive UI flow logging");
    log.info(`📊 [UI_FLOW_LOGGER] Session ID: ${this.sessionId}`);
    
    // Create dedicated log file for UI flow
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    this.logFilePath = path.join(logDir, `ui_flow_${Date.now()}.log`);
    this.writeToLogFile(`=== CypherEdge UI Flow Session Started ===`);
    this.writeToLogFile(`Session ID: ${this.sessionId}`);
    this.writeToLogFile(`Timestamp: ${new Date().toISOString()}`);
    this.writeToLogFile(`Node Environment: ${process.env.NODE_ENV}`);
    this.writeToLogFile(`========================================`);
  }

  writeToLogFile(message) {
    if (!this.isEnabled) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} ${message}\n`;
    
    try {
      fs.appendFileSync(this.logFilePath, logEntry);
    } catch (error) {
      log.error("❌ [UI_FLOW_LOGGER] Failed to write to log file:", error);
    }
  }

  // ===========================================
  // PAGE NAVIGATION TRACKING
  // ===========================================
  
  logPageNavigation(pageInfo) {
    if (!this.isEnabled) return;

    const navigationData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      type: 'PAGE_NAVIGATION',
      previousPage: this.currentPage,
      currentPage: pageInfo.page,
      filePath: pageInfo.filePath,
      component: pageInfo.component,
      route: pageInfo.route,
      trigger: pageInfo.trigger || 'unknown',
      navigationMethod: pageInfo.method || 'unknown' // click, programmatic, back/forward
    };

    this.currentPage = pageInfo.page;
    this.navigationHistory.push(navigationData);

    const logMessage = `📄 [PAGE_NAVIGATION] ${navigationData.previousPage || 'null'} → ${navigationData.currentPage}`;
    const detailMessage = `   📁 File: ${navigationData.filePath}`;
    const componentMessage = `   🧩 Component: ${navigationData.component}`;
    const triggerMessage = `   🎯 Trigger: ${navigationData.trigger}`;
    
    log.info(logMessage);
    log.info(detailMessage);
    log.info(componentMessage);
    log.info(triggerMessage);

    this.writeToLogFile(`${logMessage}`);
    this.writeToLogFile(`${detailMessage}`);
    this.writeToLogFile(`${componentMessage}`);
    this.writeToLogFile(`${triggerMessage}`);
  }

  // ===========================================
  // BUTTON CLICK TRACKING
  // ===========================================
  
  logButtonClick(buttonInfo) {
    if (!this.isEnabled) return;

    const clickData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      type: 'BUTTON_CLICK',
      page: this.currentPage,
      buttonId: buttonInfo.id,
      buttonText: buttonInfo.text,
      buttonType: buttonInfo.type || 'button',
      filePath: buttonInfo.filePath,
      component: buttonInfo.component,
      elementSelector: buttonInfo.selector,
      position: buttonInfo.position,
      action: buttonInfo.action,
      context: buttonInfo.context || {}
    };

    this.userActions.push(clickData);

    const logMessage = `🔘 [BUTTON_CLICK] "${clickData.buttonText}" (ID: ${clickData.buttonId})`;
    const locationMessage = `   📍 Location: ${clickData.filePath} → ${clickData.component}`;
    const actionMessage = `   ⚡ Action: ${clickData.action}`;
    const contextMessage = `   📋 Context: ${JSON.stringify(clickData.context)}`;
    
    log.info(logMessage);
    log.info(locationMessage);
    log.info(actionMessage);
    if (Object.keys(clickData.context).length > 0) {
      log.info(contextMessage);
    }

    this.writeToLogFile(`${logMessage}`);
    this.writeToLogFile(`${locationMessage}`);
    this.writeToLogFile(`${actionMessage}`);
    if (Object.keys(clickData.context).length > 0) {
      this.writeToLogFile(`${contextMessage}`);
    }
  }

  // ===========================================
  // BACKEND INTERACTION TRACKING
  // ===========================================
  
  logBackendInteraction(interactionInfo) {
    if (!this.isEnabled) return;

    const interactionData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      type: 'BACKEND_INTERACTION',
      page: this.currentPage,
      ipcChannel: interactionInfo.channel,
      method: interactionInfo.method || 'invoke', // invoke, send, on
      direction: interactionInfo.direction || 'request', // request, response
      handler: interactionInfo.handler,
      handlerFile: interactionInfo.handlerFile,
      payload: interactionInfo.payload,
      response: interactionInfo.response,
      duration: interactionInfo.duration,
      status: interactionInfo.status || 'unknown' // success, error, pending
    };

    this.backendInteractions.push(interactionData);

    const logMessage = `🔗 [BACKEND_INTERACTION] ${interactionData.direction.toUpperCase()}: ${interactionData.ipcChannel}`;
    const handlerMessage = `   🔧 Handler: ${interactionData.handler} (${interactionData.handlerFile})`;
    const statusMessage = `   📊 Status: ${interactionData.status}`;
    const durationMessage = interactionData.duration ? `   ⏱️ Duration: ${interactionData.duration}ms` : '';
    
    log.info(logMessage);
    log.info(handlerMessage);
    log.info(statusMessage);
    if (durationMessage) {
      log.info(durationMessage);
    }

    // Log payload/response only in development to avoid cluttering
    if (process.env.NODE_ENV === 'development') {
      if (interactionData.payload && Object.keys(interactionData.payload).length > 0) {
        log.debug(`   📤 Payload:`, interactionData.payload);
      }
      if (interactionData.response && Object.keys(interactionData.response).length > 0) {
        log.debug(`   📥 Response:`, interactionData.response);
      }
    }

    this.writeToLogFile(`${logMessage}`);
    this.writeToLogFile(`${handlerMessage}`);
    this.writeToLogFile(`${statusMessage}`);
    if (durationMessage) {
      this.writeToLogFile(`${durationMessage}`);
    }
  }

  // ===========================================
  // COMPONENT LIFECYCLE TRACKING
  // ===========================================
  
  logComponentMount(componentInfo) {
    if (!this.isEnabled) return;

    const mountData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      type: 'COMPONENT_MOUNT',
      page: this.currentPage,
      component: componentInfo.name,
      filePath: componentInfo.filePath,
      props: componentInfo.props || {},
      parent: componentInfo.parent
    };

    this.componentStack.push(mountData);

    const logMessage = `🧩 [COMPONENT_MOUNT] ${mountData.component}`;
    const fileMessage = `   📁 File: ${mountData.filePath}`;
    const parentMessage = mountData.parent ? `   👆 Parent: ${mountData.parent}` : '';
    
    log.info(logMessage);
    log.info(fileMessage);
    if (parentMessage) {
      log.info(parentMessage);
    }

    this.writeToLogFile(`${logMessage}`);
    this.writeToLogFile(`${fileMessage}`);
    if (parentMessage) {
      this.writeToLogFile(`${parentMessage}`);
    }
  }

  logComponentUnmount(componentName) {
    if (!this.isEnabled) return;

    const unmountData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      type: 'COMPONENT_UNMOUNT',
      component: componentName
    };

    // Remove from component stack
    this.componentStack = this.componentStack.filter(c => c.component !== componentName);

    const logMessage = `🔽 [COMPONENT_UNMOUNT] ${componentName}`;
    log.info(logMessage);
    this.writeToLogFile(logMessage);
  }

  // ===========================================
  // ERROR TRACKING
  // ===========================================
  
  logError(errorInfo) {
    if (!this.isEnabled) return;

    const errorData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      type: 'ERROR',
      page: this.currentPage,
      component: errorInfo.component,
      filePath: errorInfo.filePath,
      error: errorInfo.error,
      stack: errorInfo.stack,
      context: errorInfo.context || {}
    };

    const logMessage = `❌ [ERROR] ${errorData.error}`;
    const locationMessage = `   📍 Location: ${errorData.filePath} → ${errorData.component}`;
    const stackMessage = `   📚 Stack: ${errorData.stack}`;
    
    log.error(logMessage);
    log.error(locationMessage);
    log.error(stackMessage);

    this.writeToLogFile(`${logMessage}`);
    this.writeToLogFile(`${locationMessage}`);
    this.writeToLogFile(`${stackMessage}`);
  }

  // ===========================================
  // MODAL/DIALOG TRACKING
  // ===========================================
  
  logModalAction(modalInfo) {
    if (!this.isEnabled) return;

    const modalData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      type: 'MODAL_ACTION',
      page: this.currentPage,
      modalName: modalInfo.name,
      action: modalInfo.action, // open, close, confirm, cancel
      filePath: modalInfo.filePath,
      component: modalInfo.component,
      data: modalInfo.data || {}
    };

    const logMessage = `🪟 [MODAL_ACTION] ${modalData.modalName} - ${modalData.action.toUpperCase()}`;
    const locationMessage = `   📍 Location: ${modalData.filePath} → ${modalData.component}`;
    
    log.info(logMessage);
    log.info(locationMessage);

    this.writeToLogFile(`${logMessage}`);
    this.writeToLogFile(`${locationMessage}`);
  }

  // ===========================================
  // FILE OPERATIONS TRACKING
  // ===========================================
  
  logFileOperation(fileInfo) {
    if (!this.isEnabled) return;

    const fileData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      type: 'FILE_OPERATION',
      page: this.currentPage,
      operation: fileInfo.operation, // upload, download, delete, read, write
      fileName: fileInfo.fileName,
      filePath: fileInfo.filePath,
      fileSize: fileInfo.fileSize,
      mimeType: fileInfo.mimeType,
      status: fileInfo.status,
      component: fileInfo.component
    };

    const logMessage = `📁 [FILE_OPERATION] ${fileData.operation.toUpperCase()}: ${fileData.fileName}`;
    const pathMessage = `   📂 Path: ${fileData.filePath}`;
    const sizeMessage = fileData.fileSize ? `   📏 Size: ${fileData.fileSize} bytes` : '';
    const statusMessage = `   📊 Status: ${fileData.status}`;
    
    log.info(logMessage);
    log.info(pathMessage);
    if (sizeMessage) {
      log.info(sizeMessage);
    }
    log.info(statusMessage);

    this.writeToLogFile(`${logMessage}`);
    this.writeToLogFile(`${pathMessage}`);
    if (sizeMessage) {
      this.writeToLogFile(`${sizeMessage}`);
    }
    this.writeToLogFile(`${statusMessage}`);
  }

  // ===========================================
  // SESSION SUMMARY
  // ===========================================
  
  generateSessionSummary() {
    if (!this.isEnabled) return {};

    const summary = {
      sessionId: this.sessionId,
      totalPageNavigations: this.navigationHistory.length,
      totalButtonClicks: this.userActions.filter(a => a.type === 'BUTTON_CLICK').length,
      totalBackendInteractions: this.backendInteractions.length,
      uniquePagesVisited: [...new Set(this.navigationHistory.map(n => n.currentPage))],
      componentsUsed: [...new Set(this.componentStack.map(c => c.component))],
      sessionDuration: new Date() - new Date(this.navigationHistory[0]?.timestamp || Date.now()),
      lastActivity: new Date().toISOString()
    };

    const summaryMessage = `📊 [SESSION_SUMMARY]`;
    const pagesMessage = `   📄 Pages: ${summary.totalPageNavigations} navigations, ${summary.uniquePagesVisited.length} unique pages`;
    const actionsMessage = `   🔘 Actions: ${summary.totalButtonClicks} button clicks`;
    const backendMessage = `   🔗 Backend: ${summary.totalBackendInteractions} interactions`;
    const componentsMessage = `   🧩 Components: ${summary.componentsUsed.length} unique components used`;
    
    log.info(summaryMessage);
    log.info(pagesMessage);
    log.info(actionsMessage);
    log.info(backendMessage);
    log.info(componentsMessage);

    this.writeToLogFile(`${summaryMessage}`);
    this.writeToLogFile(`${pagesMessage}`);
    this.writeToLogFile(`${actionsMessage}`);
    this.writeToLogFile(`${backendMessage}`);
    this.writeToLogFile(`${componentsMessage}`);

    return summary;
  }

  // ===========================================
  // PUBLIC API METHODS
  // ===========================================
  
  enable() {
    this.isEnabled = true;
    if (!this.logFilePath) {
      this.initializeLogger();
    }
    log.info("✅ [UI_FLOW_LOGGER] Logging enabled");
  }

  disable() {
    this.isEnabled = false;
    log.info("🚫 [UI_FLOW_LOGGER] Logging disabled");
  }

  getSessionData() {
    return {
      sessionId: this.sessionId,
      navigationHistory: this.navigationHistory,
      userActions: this.userActions,
      backendInteractions: this.backendInteractions,
      componentStack: this.componentStack,
      currentPage: this.currentPage
    };
  }

  exportSessionData(format = 'json') {
    const sessionData = this.getSessionData();
    const summary = this.generateSessionSummary();
    
    const exportData = {
      ...sessionData,
      summary
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      // Convert to CSV format for easy analysis
      // Implementation would depend on specific needs
      return this.convertToCSV(exportData);
    }
    
    return exportData;
  }

  convertToCSV(data) {
    // Simple CSV conversion for navigation history
    const csvHeader = 'Timestamp,Type,Page,Component,File,Action,Details\n';
    const csvRows = [];
    
    // Add navigation data
    data.navigationHistory.forEach(nav => {
      csvRows.push([
        nav.timestamp,
        nav.type,
        nav.currentPage,
        nav.component,
        nav.filePath,
        'navigate',
        `from: ${nav.previousPage || 'none'}`
      ].join(','));
    });
    
    // Add button clicks
    data.userActions.forEach(action => {
      csvRows.push([
        action.timestamp,
        action.type,
        action.page,
        action.component,
        action.filePath,
        action.action,
        `button: ${action.buttonText}`
      ].join(','));
    });
    
    return csvHeader + csvRows.join('\n');
  }
}

// Create singleton instance
const uiFlowLogger = new UIFlowLogger();

module.exports = uiFlowLogger;