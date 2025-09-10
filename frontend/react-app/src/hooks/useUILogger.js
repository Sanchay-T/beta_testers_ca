/**
 * CypherEdge UI Logger React Hook
 * Easy-to-use React hook for integrating UI flow logging
 * 
 * File: frontend/react-app/src/hooks/useUILogger.js
 */

import { useEffect, useRef } from 'react';

// Define the logger functions that will communicate with Electron main process
const logToMain = (eventType, data) => {
  if (window.electron && window.electron.invoke) {
    window.electron.invoke('ui-logger:log-event', {
      page: window.location.pathname || 'unknown',
      eventType: eventType,
      data: data,
      timestamp: new Date().toISOString(),
      url: window.location.href
    }).catch(error => {
      console.warn('[UI_LOGGER] Failed to send log to main process:', error);
    });
  } else {
    // Fallback to console logging if Electron API not available
    console.log(`🔍 [UI_REACT] ${eventType}:`, data);
  }
};

/**
 * Main UI Logger React Hook
 * @param {string} componentName - Name of the component using the hook
 * @param {object} initialProps - Initial props to log
 * @returns {object} Logger functions
 */
export const useUILogger = (componentName, initialProps = {}) => {
  const mountTimeRef = useRef(null);
  const actionCountRef = useRef(0);

  // Auto-log component mount
  useEffect(() => {
    mountTimeRef.current = Date.now();
    
    logToMain('COMPONENT_MOUNT', {
      componentName: componentName,
      props: initialProps,
      mountTime: mountTimeRef.current,
      path: window.location.pathname
    });

    // Auto-log component unmount
    return () => {
      const unmountTime = Date.now();
      const lifespan = mountTimeRef.current ? unmountTime - mountTimeRef.current : 0;
      
      logToMain('COMPONENT_UNMOUNT', {
        componentName: componentName,
        unmountTime: unmountTime,
        lifespan: lifespan,
        totalActions: actionCountRef.current
      });
    };
  }, [componentName]);

  // Logger functions
  const logger = {
    // Log page navigation
    logNavigation: (targetPage, trigger = 'component', route = null) => {
      logToMain('PAGE_NAVIGATION', {
        componentName: componentName,
        targetPage: targetPage,
        trigger: trigger,
        route: route || window.location.pathname,
        fromComponent: componentName
      });
    },

    // Log button clicks with context
    logClick: (buttonId, buttonText, action, context = {}) => {
      actionCountRef.current += 1;
      
      logToMain('BUTTON_CLICK', {
        componentName: componentName,
        buttonId: buttonId,
        buttonText: buttonText,
        action: action,
        context: {
          ...context,
          actionNumber: actionCountRef.current,
          timestamp: Date.now()
        }
      });
    },

    // Log form submissions
    logFormSubmit: (formId, formData, status = 'submitted') => {
      actionCountRef.current += 1;
      
      logToMain('FORM_SUBMIT', {
        componentName: componentName,
        formId: formId,
        fieldCount: Object.keys(formData || {}).length,
        status: status,
        actionNumber: actionCountRef.current
      });
    },

    // Log backend interactions
    logBackendCall: (channel, handler, payload = {}) => {
      const startTime = Date.now();
      
      logToMain('BACKEND_CALL_START', {
        componentName: componentName,
        channel: channel,
        handler: handler,
        payload: payload,
        startTime: startTime
      });

      // Return a function to log the response
      return {
        logResponse: (response, status = 'success') => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          logToMain('BACKEND_CALL_END', {
            componentName: componentName,
            channel: channel,
            handler: handler,
            response: response,
            status: status,
            duration: duration,
            endTime: endTime
          });
        },
        logError: (error) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          logToMain('BACKEND_CALL_ERROR', {
            componentName: componentName,
            channel: channel,
            handler: handler,
            error: error.message || error,
            duration: duration,
            endTime: endTime
          });
        }
      };
    },

    // Log file operations
    logFileOperation: (operation, fileName, status, metadata = {}) => {
      logToMain('FILE_OPERATION', {
        componentName: componentName,
        operation: operation, // upload, download, delete, etc.
        fileName: fileName,
        status: status,
        metadata: metadata
      });
    },

    // Log modal/dialog actions
    logModal: (modalName, action, data = {}) => {
      logToMain('MODAL_ACTION', {
        componentName: componentName,
        modalName: modalName,
        action: action, // open, close, confirm, cancel
        data: data
      });
    },

    // Log user errors or issues
    logError: (error, context = {}) => {
      logToMain('ERROR', {
        componentName: componentName,
        error: error.message || error,
        stack: error.stack,
        context: context
      });
    },

    // Log custom events
    logCustomEvent: (eventName, eventData = {}) => {
      logToMain('CUSTOM_EVENT', {
        componentName: componentName,
        eventName: eventName,
        eventData: eventData
      });
    },

    // Log state changes (useful for debugging)
    logStateChange: (stateName, oldValue, newValue) => {
      logToMain('STATE_CHANGE', {
        componentName: componentName,
        stateName: stateName,
        oldValue: oldValue,
        newValue: newValue,
        timestamp: Date.now()
      });
    },

    // Log performance metrics
    logPerformance: (metricName, value, unit = 'ms') => {
      logToMain('PERFORMANCE_METRIC', {
        componentName: componentName,
        metricName: metricName,
        value: value,
        unit: unit,
        timestamp: Date.now()
      });
    }
  };

  return logger;
};

/**
 * Higher-Order Component for automatic UI logging
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {string} componentName - Override component name
 */
export const withUILogging = (WrappedComponent, componentName) => {
  return function LoggedComponent(props) {
    const logger = useUILogger(componentName || WrappedComponent.name || 'UnknownComponent', props);

    // Pass logger as prop to the wrapped component
    return <WrappedComponent {...props} uiLogger={logger} />;
  };
};

/**
 * Hook for automatic click tracking on elements
 * @param {React.RefObject} ref - Ref to the element to track
 * @param {string} componentName - Name of the component
 * @param {object} options - Tracking options
 */
export const useClickTracking = (ref, componentName, options = {}) => {
  const logger = useUILogger(componentName);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleClick = (event) => {
      const target = event.target;
      const buttonId = target.id || target.className || 'unnamed-element';
      const buttonText = target.textContent || target.value || target.alt || 'No Text';
      const action = target.onclick ? target.onclick.name : 'click';

      logger.logClick(buttonId, buttonText, action, {
        tagName: target.tagName,
        type: target.type,
        className: target.className,
        ...options.context
      });
    };

    element.addEventListener('click', handleClick);

    return () => {
      element.removeEventListener('click', handleClick);
    };
  }, [ref, componentName, logger, options]);

  return logger;
};

/**
 * Hook for tracking form submissions
 * @param {React.RefObject} formRef - Ref to the form element
 * @param {string} componentName - Name of the component
 */
export const useFormTracking = (formRef, componentName) => {
  const logger = useUILogger(componentName);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const handleSubmit = (event) => {
      const formData = new FormData(form);
      const formDataObj = Object.fromEntries(formData);
      
      logger.logFormSubmit(
        form.id || 'unnamed-form',
        formDataObj,
        'submitted'
      );
    };

    form.addEventListener('submit', handleSubmit);

    return () => {
      form.removeEventListener('submit', handleSubmit);
    };
  }, [formRef, componentName, logger]);

  return logger;
};

/**
 * Hook for automatic backend call logging with Electron IPC
 * @param {string} componentName - Name of the component
 */
export const useBackendLogger = (componentName) => {
  const logger = useUILogger(componentName);

  const loggedInvoke = async (channel, payload = {}) => {
    const backendLogger = logger.logBackendCall(channel, 'unknown', payload);

    try {
      const result = await window.electron.invoke(channel, payload);
      backendLogger.logResponse(result, 'success');
      return result;
    } catch (error) {
      backendLogger.logError(error);
      throw error;
    }
  };

  return {
    ...logger,
    invoke: loggedInvoke
  };
};

// Export default hook
export default useUILogger;