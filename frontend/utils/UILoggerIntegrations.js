/**
 * CypherEdge UI Logger Integration Scripts
 * Ready-to-use integrations for different parts of the application
 * 
 * File: frontend/utils/UILoggerIntegrations.js
 */

const { 
  logPageNavigation, 
  logButtonClick, 
  logBackendCall, 
  logModalAction,
  logFileOperation,
  logger 
} = require('./UILoggerHelpers');

/**
 * =============================================
 * ELECTRON MAIN PROCESS INTEGRATION
 * =============================================
 */

/**
 * Integrate logging into Electron main process IPC handlers
 * Call this in main.js after setting up IPC handlers
 */
function integrateMainProcessLogging(ipcMain) {
  const originalHandle = ipcMain.handle;
  const originalOn = ipcMain.on;
  
  // Wrap ipcMain.handle to log all IPC calls
  ipcMain.handle = function(channel, handler) {
    return originalHandle.call(this, channel, async (event, ...args) => {
      const startTime = Date.now();
      
      // Log the incoming request
      logger.logBackendInteraction({
        channel: channel,
        method: 'handle',
        direction: 'request',
        handler: handler.name || 'anonymous',
        handlerFile: 'main.js',
        payload: args[0] || {},
        status: 'pending'
      });
      
      try {
        const result = await handler(event, ...args);
        const duration = Date.now() - startTime;
        
        // Log successful response
        logger.logBackendInteraction({
          channel: channel,
          method: 'handle',
          direction: 'response',
          handler: handler.name || 'anonymous',
          handlerFile: 'main.js',
          response: typeof result === 'object' ? result : { result },
          duration: duration,
          status: 'success'
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log error response
        logger.logBackendInteraction({
          channel: channel,
          method: 'handle',
          direction: 'response',
          handler: handler.name || 'anonymous',
          handlerFile: 'main.js',
          response: { error: error.message, stack: error.stack },
          duration: duration,
          status: 'error'
        });
        
        throw error;
      }
    });
  };
  
  // Wrap ipcMain.on for event listeners
  ipcMain.on = function(channel, handler) {
    return originalOn.call(this, channel, (event, ...args) => {
      logger.logBackendInteraction({
        channel: channel,
        method: 'on',
        direction: 'event',
        handler: handler.name || 'anonymous',
        handlerFile: 'main.js',
        payload: args[0] || {},
        status: 'received'
      });
      
      return handler(event, ...args);
    });
  };
  
  console.log("✅ [UI_FLOW_LOGGER] Main process IPC logging integrated");
}

/**
 * =============================================
 * COMPATIBILITY SYSTEM INTEGRATION
 * =============================================
 */

/**
 * Add logging to the compatibility.html page
 * Inject this script into compatibility.html
 */
function getCompatibilityLoggingScript() {
  return `
    <script>
    // UI Flow Logger for Compatibility Page
    window.CypherEdgeLogger = {
      logPageEvent: function(eventType, data) {
        console.log('🔍 [COMPATIBILITY_UI]', eventType, data);
        
        // Send to main process for centralized logging
        if (window.electronAPI && window.electronAPI.invoke) {
          window.electronAPI.invoke('ui-logger:log-event', {
            page: 'compatibility.html',
            eventType: eventType,
            data: data,
            timestamp: new Date().toISOString(),
            url: window.location.href
          });
        }
      },
      
      logButtonClick: function(buttonId, buttonText, action, context) {
        this.logPageEvent('BUTTON_CLICK', {
          buttonId: buttonId,
          buttonText: buttonText,
          action: action,
          context: context || {}
        });
      },
      
      logFlowStep: function(step, mode, data) {
        this.logPageEvent('FLOW_STEP', {
          step: step,
          mode: mode,
          data: data || {}
        });
      },
      
      logModalAction: function(modalName, action, data) {
        this.logPageEvent('MODAL_ACTION', {
          modalName: modalName,
          action: action,
          data: data || {}
        });
      }
    };
    
    // Auto-log page load
    document.addEventListener('DOMContentLoaded', function() {
      window.CypherEdgeLogger.logPageEvent('PAGE_LOAD', {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      });
    });
    
    // Auto-log all button clicks
    document.addEventListener('click', function(e) {
      if (e.target.tagName === 'BUTTON' || e.target.type === 'button') {
        window.CypherEdgeLogger.logButtonClick(
          e.target.id || 'unnamed-button',
          e.target.textContent || e.target.value || 'No Text',
          e.target.onclick ? e.target.onclick.name : 'unknown',
          {
            className: e.target.className,
            dataset: e.target.dataset
          }
        );
      }
    });
    
    // Log form submissions
    document.addEventListener('submit', function(e) {
      window.CypherEdgeLogger.logPageEvent('FORM_SUBMIT', {
        formId: e.target.id || 'unnamed-form',
        action: e.target.action,
        method: e.target.method
      });
    });
    </script>
  `;
}

/**
 * =============================================
 * REACT COMPONENTS INTEGRATION
 * =============================================
 */

/**
 * Higher-Order Component (HOC) to add automatic logging to React components
 */
function createLoggedComponent() {
  return `
    import React, { useEffect } from 'react';
    import { logComponentMount, logComponentUnmount } from '../utils/UILoggerHelpers';
    
    function withUILogging(WrappedComponent, componentName) {
      return function LoggedComponent(props) {
        useEffect(() => {
          logComponentMount(componentName || WrappedComponent.name, props);
          
          return () => {
            logComponentUnmount(componentName || WrappedComponent.name);
          };
        }, []);
        
        return React.createElement(WrappedComponent, props);
      };
    }
    
    export default withUILogging;
  `;
}

/**
 * =============================================
 * IPC HANDLERS INTEGRATION
 * =============================================
 */

/**
 * Wrapper function to add logging to existing IPC handlers
 * Usage: const loggedHandler = wrapIPCHandler(originalHandler, 'authHandlers.js', 'handleLogin')
 */
function wrapIPCHandler(originalHandler, fileName, handlerName) {
  return async function loggedHandler(event, ...args) {
    const startTime = Date.now();
    
    // Log incoming request
    logger.logBackendInteraction({
      channel: 'unknown', // Will be filled by the calling context
      method: 'handle',
      direction: 'request',
      handler: handlerName,
      handlerFile: fileName,
      payload: args[0] || {},
      status: 'processing'
    });
    
    try {
      const result = await originalHandler(event, ...args);
      const duration = Date.now() - startTime;
      
      // Log success
      logger.logBackendInteraction({
        channel: 'unknown',
        method: 'handle', 
        direction: 'response',
        handler: handlerName,
        handlerFile: fileName,
        response: result,
        duration: duration,
        status: 'success'
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log error
      logger.logBackendInteraction({
        channel: 'unknown',
        method: 'handle',
        direction: 'response', 
        handler: handlerName,
        handlerFile: fileName,
        response: { error: error.message },
        duration: duration,
        status: 'error'
      });
      
      throw error;
    }
  };
}

/**
 * =============================================
 * DASHBOARD INTEGRATION
 * =============================================
 */

/**
 * Generate integration code for dashboard components
 */
function getDashboardIntegrationCode() {
  return `
    // Add this to the top of your dashboard components
    import { 
      logPageNavigation, 
      logButtonClick, 
      logFileOperation,
      createReactLoggerHook 
    } from '../utils/UILoggerHelpers';
    
    // In your component:
    const { logMount, logUnmount, logAction } = createReactLoggerHook('MainDashboard');
    
    useEffect(() => {
      logMount({ userId: currentUser?.id });
      logPageNavigation('MainDashboard', { 
        route: '/dashboard',
        trigger: 'navigation'
      });
      
      return () => {
        logUnmount();
      };
    }, []);
    
    // For button clicks:
    const handleUploadClick = () => {
      logButtonClick('upload-btn', 'Upload PDF', 'handleUploadClick', {
        allowedTypes: '.pdf,.xlsx'
      });
      
      // Your existing logic here
    };
    
    // For file operations:
    const handleFileUpload = (file) => {
      logFileOperation('upload', file.name, 'started', {
        size: file.size,
        type: file.type
      });
      
      // Your existing upload logic here
      
      // Log completion
      logFileOperation('upload', file.name, 'success');
    };
  `;
}

/**
 * =============================================
 * TESTING SCENARIOS INTEGRATION
 * =============================================
 */

/**
 * Add logging to mode detection testing scenarios
 */
function getModeTestingLoggingCode() {
  return `
    // Add to AppModeManager.js or testing components
    const { logButtonClick, logModalAction } = require('../utils/UILoggerHelpers');
    
    // Log scenario selection
    function logTestScenario(scenario) {
      logButtonClick(
        \`test-scenario-\${scenario}\`,
        \`Test \${scenario} Mode\`,
        'selectTestScenario',
        {
          scenario: scenario,
          testingMode: true,
          hardwareOverride: true
        }
      );
    }
    
    // Log mode detection results
    function logModeResult(detectedMode, forced, scenario) {
      logModalAction('ModeDetectionResult', 'show', {
        detectedMode: detectedMode,
        forced: forced,
        scenario: scenario,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log HYBRID payment flow steps
    function logHybridStep(step, action, data) {
      logButtonClick(
        \`hybrid-\${step}-\${action}\`,
        \`HYBRID \${step} - \${action}\`,
        \`handleHybrid\${step}\`,
        {
          step: step,
          action: action,
          hybridFlow: true,
          ...data
        }
      );
    }
  `;
}

/**
 * =============================================
 * INITIALIZATION HELPER
 * =============================================
 */

/**
 * Main initialization function to set up logging throughout the app
 */
function initializeUIFlowLogging(options = {}) {
  const config = {
    enableMainProcess: true,
    enableReactComponents: true,
    enableCompatibility: true,
    enableIpcLogging: true,
    logLevel: options.logLevel || 'info',
    ...options
  };
  
  console.log("🚀 [UI_FLOW_LOGGER] Initializing comprehensive UI flow logging");
  console.log("📊 [UI_FLOW_LOGGER] Configuration:", config);
  
  // Enable the logger
  logger.enable();
  
  // Add IPC handler for web page events
  if (config.enableIpcLogging && typeof require !== 'undefined') {
    try {
      const { ipcMain } = require('electron');
      
      ipcMain.handle('ui-logger:log-event', async (event, data) => {
        // Process web page events
        switch (data.eventType) {
          case 'PAGE_LOAD':
            logger.logPageNavigation({
              page: data.page,
              filePath: data.page,
              component: 'WebPage',
              trigger: 'page-load'
            });
            break;
            
          case 'BUTTON_CLICK':
            logger.logButtonClick({
              id: data.data.buttonId,
              text: data.data.buttonText,
              action: data.data.action,
              filePath: data.page,
              component: 'WebPage',
              context: data.data.context
            });
            break;
            
          case 'MODAL_ACTION':
            logger.logModalAction({
              name: data.data.modalName,
              action: data.data.action,
              filePath: data.page,
              component: 'WebPage',
              data: data.data.data
            });
            break;
            
          default:
            console.log(`🔍 [UI_FLOW_LOGGER] Web Event: ${data.eventType}`, data.data);
        }
        
        return { success: true };
      });
      
      console.log("✅ [UI_FLOW_LOGGER] IPC logging handlers registered");
    } catch (error) {
      console.warn("⚠️ [UI_FLOW_LOGGER] Could not register IPC handlers:", error.message);
    }
  }
  
  return {
    logger,
    config,
    integrateMainProcess: integrateMainProcessLogging,
    getCompatibilityScript: getCompatibilityLoggingScript,
    wrapIPCHandler
  };
}

module.exports = {
  initializeUIFlowLogging,
  integrateMainProcessLogging,
  getCompatibilityLoggingScript,
  createLoggedComponent,
  wrapIPCHandler,
  getDashboardIntegrationCode,
  getModeTestingLoggingCode
};