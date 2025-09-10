/**
 * CypherEdge UI Logger Helper Functions
 * Easy-to-use helper functions for integrating UI flow logging
 * throughout the React components and Electron main process
 * 
 * File: frontend/utils/UILoggerHelpers.js
 */

const uiFlowLogger = require('./UIFlowLogger');
const path = require('path');

/**
 * Helper to automatically extract component and file information
 * @param {Error} error - Error object to extract stack info
 * @returns {Object} Component and file information
 */
function extractComponentInfo(error = new Error()) {
  const stack = error.stack || '';
  const stackLines = stack.split('\n');
  
  // Try to find the calling file and function
  let componentName = 'Unknown';
  let filePath = 'Unknown';
  
  for (let i = 2; i < stackLines.length; i++) {
    const line = stackLines[i];
    if (line && !line.includes('UILoggerHelpers') && !line.includes('UIFlowLogger')) {
      // Extract file path
      const pathMatch = line.match(/\((.+):(\d+):(\d+)\)/) || line.match(/at (.+):(\d+):(\d+)/);
      if (pathMatch) {
        filePath = pathMatch[1];
        // Extract component name from file path
        const fileName = path.basename(filePath, '.js');
        componentName = fileName;
        break;
      }
    }
  }
  
  return { componentName, filePath };
}

/**
 * Easy page navigation logging
 * Usage: logPageNavigation('MainDashboard', { route: '/dashboard', trigger: 'menu-click' })
 */
function logPageNavigation(pageName, options = {}) {
  const { componentName, filePath } = extractComponentInfo();
  
  uiFlowLogger.logPageNavigation({
    page: pageName,
    filePath: options.filePath || filePath,
    component: options.component || componentName,
    route: options.route,
    trigger: options.trigger,
    method: options.method || 'click'
  });
}

/**
 * Easy button click logging with automatic context extraction
 * Usage: logButtonClick('submit-btn', 'Submit Report', 'handleSubmit', { reportId: 123 })
 */
function logButtonClick(buttonId, buttonText, action, context = {}, options = {}) {
  const { componentName, filePath } = extractComponentInfo();
  
  uiFlowLogger.logButtonClick({
    id: buttonId,
    text: buttonText,
    action: action,
    filePath: options.filePath || filePath,
    component: options.component || componentName,
    selector: options.selector || `#${buttonId}`,
    position: options.position,
    context: context
  });
}

/**
 * Easy backend interaction logging
 * Usage: logBackendCall('user:login', 'authHandlers.js', 'handleLogin', { email: 'user@example.com' })
 */
function logBackendCall(channel, handlerFile, handler, payload = {}, options = {}) {
  const { componentName, filePath } = extractComponentInfo();
  
  const startTime = Date.now();
  
  // Log the request
  uiFlowLogger.logBackendInteraction({
    channel: channel,
    method: options.method || 'invoke',
    direction: 'request',
    handler: handler,
    handlerFile: handlerFile,
    payload: payload,
    status: 'pending'
  });
  
  // Return a function to log the response
  return {
    logResponse: (response, status = 'success') => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      uiFlowLogger.logBackendInteraction({
        channel: channel,
        method: options.method || 'invoke',
        direction: 'response',
        handler: handler,
        handlerFile: handlerFile,
        response: response,
        duration: duration,
        status: status
      });
    },
    logError: (error) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      uiFlowLogger.logBackendInteraction({
        channel: channel,
        method: options.method || 'invoke',
        direction: 'response',
        handler: handler,
        handlerFile: handlerFile,
        response: { error: error.message },
        duration: duration,
        status: 'error'
      });
    }
  };
}

/**
 * Easy component lifecycle logging
 * Usage: logComponentMount('UserProfile', { userId: 123 })
 */
function logComponentMount(componentName, props = {}, options = {}) {
  const { componentName: autoName, filePath } = extractComponentInfo();
  
  uiFlowLogger.logComponentMount({
    name: componentName || autoName,
    filePath: options.filePath || filePath,
    props: props,
    parent: options.parent
  });
}

/**
 * Easy component unmount logging
 * Usage: logComponentUnmount('UserProfile')
 */
function logComponentUnmount(componentName) {
  const { componentName: autoName } = extractComponentInfo();
  uiFlowLogger.logComponentUnmount(componentName || autoName);
}

/**
 * Easy error logging
 * Usage: logError(error, 'Failed to load user data', { userId: 123 })
 */
function logError(error, description = '', context = {}) {
  const { componentName, filePath } = extractComponentInfo();
  
  uiFlowLogger.logError({
    component: componentName,
    filePath: filePath,
    error: description || error.message,
    stack: error.stack,
    context: context
  });
}

/**
 * Easy modal/dialog logging
 * Usage: logModalAction('ConfirmDialog', 'open', { title: 'Delete Report' })
 */
function logModalAction(modalName, action, data = {}, options = {}) {
  const { componentName, filePath } = extractComponentInfo();
  
  uiFlowLogger.logModalAction({
    name: modalName,
    action: action, // open, close, confirm, cancel
    filePath: options.filePath || filePath,
    component: options.component || componentName,
    data: data
  });
}

/**
 * Easy file operation logging
 * Usage: logFileOperation('upload', 'report.pdf', 'success', { size: 1024, type: 'application/pdf' })
 */
function logFileOperation(operation, fileName, status, options = {}) {
  const { componentName, filePath } = extractComponentInfo();
  
  uiFlowLogger.logFileOperation({
    operation: operation, // upload, download, delete, read, write
    fileName: fileName,
    filePath: options.filePath || filePath,
    fileSize: options.size,
    mimeType: options.type,
    status: status,
    component: options.component || componentName
  });
}

/**
 * Enhanced wrapper for IPC calls with automatic logging
 * Usage: const result = await loggedIPCInvoke('user:login', { email, password }, 'authHandlers.js', 'handleLogin')
 */
async function loggedIPCInvoke(channel, payload = {}, handlerFile = 'unknown', handler = 'unknown') {
  const logger = logBackendCall(channel, handlerFile, handler, payload);
  
  try {
    const { ipcRenderer } = require('electron');
    const result = await ipcRenderer.invoke(channel, payload);
    logger.logResponse(result, 'success');
    return result;
  } catch (error) {
    logger.logError(error);
    throw error;
  }
}

/**
 * Create a React Hook for easy component logging
 * Usage: const { logMount, logUnmount, logAction } = useUILogger('MyComponent')
 */
function createReactLoggerHook() {
  return function useUILogger(componentName, props = {}) {
    const { componentName: autoName, filePath } = extractComponentInfo();
    const finalComponentName = componentName || autoName;
    
    return {
      logMount: (additionalProps = {}) => {
        logComponentMount(finalComponentName, { ...props, ...additionalProps });
      },
      logUnmount: () => {
        logComponentUnmount(finalComponentName);
      },
      logAction: (actionName, context = {}) => {
        logButtonClick(
          `${finalComponentName}-${actionName}`,
          actionName,
          actionName,
          context,
          { component: finalComponentName }
        );
      },
      logNavigation: (targetPage, trigger = 'component') => {
        logPageNavigation(targetPage, { 
          component: finalComponentName,
          trigger: trigger 
        });
      },
      logError: (error, description = '', context = {}) => {
        logError(error, description, { ...context, component: finalComponentName });
      }
    };
  };
}

/**
 * Wrapper for button click handlers with automatic logging
 * Usage: const handleClick = createLoggedClickHandler('submit-btn', 'Submit', originalHandler, { formId: 123 })
 */
function createLoggedClickHandler(buttonId, buttonText, originalHandler, context = {}) {
  return function loggedClickHandler(...args) {
    logButtonClick(buttonId, buttonText, originalHandler.name || 'onClick', context);
    
    // Call the original handler
    if (typeof originalHandler === 'function') {
      return originalHandler.apply(this, args);
    }
  };
}

/**
 * Automatic form submission logging
 * Usage: logFormSubmission('loginForm', { email: 'user@example.com' }, 'success')
 */
function logFormSubmission(formId, formData, status, options = {}) {
  const { componentName, filePath } = extractComponentInfo();
  
  logButtonClick(
    `${formId}-submit`,
    'Form Submit',
    'onSubmit',
    {
      formId: formId,
      fieldCount: Object.keys(formData).length,
      status: status,
      ...options.context
    },
    { component: options.component || componentName }
  );
}

/**
 * Route change logging helper for React Router
 * Usage: logRouteChange('/dashboard', '/reports', 'navigation')
 */
function logRouteChange(from, to, trigger = 'navigation') {
  const pageName = to.split('/').pop() || 'home';
  
  logPageNavigation(pageName, {
    route: to,
    trigger: trigger,
    method: 'route-change'
  });
}

/**
 * Bulk action logging for operations on multiple items
 * Usage: logBulkAction('delete', 'reports', [1, 2, 3], 'success')
 */
function logBulkAction(action, itemType, itemIds, status, context = {}) {
  const { componentName, filePath } = extractComponentInfo();
  
  logButtonClick(
    `bulk-${action}`,
    `Bulk ${action}`,
    `bulk${action.charAt(0).toUpperCase() + action.slice(1)}`,
    {
      itemType: itemType,
      itemCount: itemIds.length,
      itemIds: itemIds,
      status: status,
      ...context
    },
    { component: componentName }
  );
}

// Export all helper functions
module.exports = {
  logPageNavigation,
  logButtonClick,
  logBackendCall,
  logComponentMount,
  logComponentUnmount,
  logError,
  logModalAction,
  logFileOperation,
  loggedIPCInvoke,
  createReactLoggerHook,
  createLoggedClickHandler,
  logFormSubmission,
  logRouteChange,
  logBulkAction,
  
  // Direct access to the main logger
  logger: uiFlowLogger
};