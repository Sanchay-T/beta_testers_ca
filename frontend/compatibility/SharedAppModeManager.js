// SharedAppModeManager.js
// Shared singleton instance of AppModeManager to persist scenario state across different callers
const { AppModeManager } = require('./AppModeManager');

let sharedInstance = null;

/**
 * Get or create shared AppModeManager instance
 * @param {Object} logger - Logger instance
 * @param {Object} compatibilityWindow - Compatibility window
 * @returns {AppModeManager} Shared instance
 */
function getSharedAppModeManager(logger = null, compatibilityWindow = null) {
  if (!sharedInstance) {
    sharedInstance = new AppModeManager(logger, compatibilityWindow);
    logger?.info('SHARED_APP_MODE_MANAGER', 'Created shared AppModeManager instance');
  } else if (logger) {
    // Update logger if provided
    sharedInstance.logger = logger;
    logger?.info('SHARED_APP_MODE_MANAGER', 'Reusing existing shared AppModeManager instance');
  }
  
  return sharedInstance;
}

/**
 * Reset the shared instance (for cleanup)
 */
function resetSharedAppModeManager() {
  if (sharedInstance) {
    sharedInstance.cleanup();
    sharedInstance = null;
  }
}

/**
 * Check if shared instance exists
 * @returns {boolean} Whether shared instance exists
 */
function hasSharedInstance() {
  return !!sharedInstance;
}

module.exports = {
  getSharedAppModeManager,
  resetSharedAppModeManager,
  hasSharedInstance
};