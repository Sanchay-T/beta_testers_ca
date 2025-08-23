// ModeNotificationUI.js
const { AppModeConfigManager } = require('../config/AppModeConfigManager');
const { HybridModeFlow } = require('./HybridModeFlow');

class ModeNotificationUI {
  constructor(logger = null, compatibilityWindow = null) {
    this.logger = logger;
    this.window = compatibilityWindow;
    this.hybridFlow = new HybridModeFlow(logger, compatibilityWindow);
    this.currentNotification = null;
    this.userChoices = {
      unscanAcknowledged: false,
      hybridFlowResult: null
    };
  }

  /**
   * Handle mode-specific notification flow based on determined mode
   * @param {Object} modeDetectionResult - Mode detection result
   * @returns {Promise<Object>} Flow result with canProceed status
   */
  async handleModeNotificationFlow(modeDetectionResult) {
    const mode = modeDetectionResult.determinedMode;
    
    this.logger?.info('MODE_NOTIFICATION', 'Starting mode notification flow', {
      mode: mode,
      confidence: modeDetectionResult.confidence
    });

    try {
      switch (mode) {
        case 'SCAN':
          return await this.handleScanMode(modeDetectionResult);
        
        case 'UNSCAN':
          return await this.handleUnscanMode(modeDetectionResult);
        
        case 'HYBRID':
          return await this.handleHybridMode(modeDetectionResult);
        
        default:
          this.logger?.warn('MODE_NOTIFICATION', 'Unknown mode detected', { mode });
          return this.createFlowResult('unknown_mode', true, 'Unknown mode, proceeding with default flow');
      }
    } catch (error) {
      this.logger?.error('MODE_NOTIFICATION', 'Mode notification flow failed', {
        mode: mode,
        error: error.message,
        stack: error.stack
      });
      
      return this.createFlowResult('error', true, `Flow error: ${error.message}`);
    }
  }

  /**
   * Handle SCAN mode (High-End) - Direct Launch
   * @param {Object} modeDetectionResult - Mode detection result
   * @returns {Promise<Object>} Flow result
   */
  async handleScanMode(modeDetectionResult) {
    this.logger?.info('MODE_NOTIFICATION', 'SCAN mode detected - direct launch');
    
    // No popup/notification needed for SCAN mode
    // Just proceed directly to app launch
    return this.createFlowResult('scan_direct_launch', true, 'High-performance mode enabled - proceeding to launch');
  }

  /**
   * Handle UNSCAN mode (Mid-Range) - Informative Popup
   * @param {Object} modeDetectionResult - Mode detection result
   * @returns {Promise<Object>} Flow result
   */
  async handleUnscanMode(modeDetectionResult) {
    this.logger?.info('MODE_NOTIFICATION', 'UNSCAN mode detected - showing informative popup');
    
    try {
      const acknowledged = await this.showUnscanNotification(modeDetectionResult);
      this.userChoices.unscanAcknowledged = acknowledged;
      
      return this.createFlowResult('unscan_acknowledged', true, 'Optimized mode acknowledged - proceeding to launch');
    } catch (error) {
      this.logger?.error('MODE_NOTIFICATION', 'UNSCAN notification failed', { error: error.message });
      return this.createFlowResult('unscan_error', true, 'Notification failed but proceeding to launch');
    }
  }

  /**
   * Handle HYBRID mode (Low-End) - Multi-Step Flow
   * @param {Object} modeDetectionResult - Mode detection result
   * @returns {Promise<Object>} Flow result
   */
  async handleHybridMode(modeDetectionResult) {
    this.logger?.info('MODE_NOTIFICATION', 'HYBRID mode detected - starting multi-step flow');
    
    try {
      const hybridResult = await this.hybridFlow.startHybridFlow(modeDetectionResult);
      this.userChoices.hybridFlowResult = hybridResult;
      
      return this.createFlowResult('hybrid_completed', hybridResult.canProceed, hybridResult.error || 'Hybrid flow completed');
    } catch (error) {
      this.logger?.error('MODE_NOTIFICATION', 'HYBRID flow failed', { error: error.message });
      return this.createFlowResult('hybrid_error', false, `Hybrid flow error: ${error.message}`);
    }
  }

  /**
   * Show UNSCAN mode informative notification
   * @param {Object} modeDetectionResult - Mode detection result
   * @returns {Promise<boolean>} Whether user acknowledged
   */
  async showUnscanNotification(modeDetectionResult) {
    this.currentNotification = 'unscan';
    
    const config = AppModeConfigManager.getConfig();
    const messages = config.userExperience?.unscanModeFlow?.messages || {};
    
    const html = this.generateUnscanNotificationHTML(modeDetectionResult, messages);
    
    return new Promise((resolve) => {
      // Send HTML to compatibility window
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('mode-notification:show-unscan', {
          type: 'unscan_notification',
          html: html
        });

        // Set up IPC handlers for user response
        this.setupUnscanNotificationHandlers(resolve);
      } else {
        resolve(true); // Default to acknowledged if no window
      }
    });
  }

  /**
   * Generate HTML for UNSCAN mode notification
   * @param {Object} modeDetectionResult - Mode detection result
   * @param {Object} messages - Configuration messages
   * @returns {string} HTML content
   */
  generateUnscanNotificationHTML(modeDetectionResult, messages) {
    const specs = modeDetectionResult.analysis?.hardware?.specs || {};
    const ramTotal = specs.ram?.total || specs.memory?.total || 0;
    const cpuClass = specs.cpu?.class || 'unknown';

    return `
      <div class="mode-notification-overlay" id="unscan-notification-overlay">
        <div class="mode-notification-container">
          <div class="notification-content">
            
            <!-- Header -->
            <div class="notification-header">
              <div class="notification-icon">⚡</div>
              <h2>Optimized Mode Enabled</h2>
              <p class="notification-subtitle">${messages.optimizedModeMessage || 'Your system has been configured for lightweight processing mode.'}</p>
            </div>

            <!-- System Info -->
            <div class="system-info-section">
              <h3>Detected System Specifications</h3>
              <div class="specs-grid">
                <div class="spec-item">
                  <span class="spec-label">RAM:</span>
                  <span class="spec-value">${ramTotal}GB</span>
                  <span class="spec-note">(Optimized for efficient memory usage)</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">CPU:</span>
                  <span class="spec-value">${cpuClass.toUpperCase()}</span>
                  <span class="spec-note">(Lightweight processing enabled)</span>
                </div>
              </div>
            </div>

            <!-- Features -->
            <div class="features-section">
              <div class="features-grid">
                <div class="feature-item feature-positive">
                  <div class="feature-icon">✓</div>
                  <div class="feature-content">
                    <h4>Faster Processing</h4>
                    <p>Optimized algorithms for quicker results</p>
                  </div>
                </div>
                <div class="feature-item feature-positive">
                  <div class="feature-icon">✓</div>
                  <div class="feature-content">
                    <h4>Lower Memory Usage</h4>
                    <p>Efficient resource management</p>
                  </div>
                </div>
                <div class="feature-item feature-warning">
                  <div class="feature-icon">⚠</div>
                  <div class="feature-content">
                    <h4>ML Scanning Disabled</h4>
                    <p>Advanced scanning features unavailable</p>
                  </div>
                </div>
                <div class="feature-item feature-warning">
                  <div class="feature-icon">⚠</div>
                  <div class="feature-content">
                    <h4>Manual Categorization Required</h4>
                    <p>Some processes require manual input</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Action Button -->
            <div class="notification-actions">
              <button onclick="acknowledgeUnscanMode()" class="btn-continue">
                <span class="btn-icon">→</span>
                <span class="btn-text">Continue with Optimized Mode</span>
              </button>
            </div>

            <!-- Auto-dismiss info -->
            <div class="auto-dismiss-info">
              <p>This notification will auto-dismiss in <span id="unscan-countdown">5</span> seconds</p>
            </div>

            ${this.getTestModeIndicator()}
          </div>
        </div>
      </div>

      <style>
        .mode-notification-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease-out;
        }

        .mode-notification-container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideIn 0.3s ease-out;
        }

        .notification-content {
          padding: 32px;
        }

        .notification-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .notification-icon {
          font-size: 3em;
          margin-bottom: 16px;
        }

        .notification-header h2 {
          color: #f59e0b;
          margin: 0 0 8px 0;
          font-size: 1.5em;
        }

        .notification-subtitle {
          color: #6b7280;
          font-size: 1em;
          line-height: 1.5;
        }

        .system-info-section, .features-section {
          margin-bottom: 24px;
        }

        .system-info-section h3, .features-section h3 {
          color: #374151;
          margin-bottom: 16px;
          font-size: 1.1em;
          border-bottom: 2px solid #f3f4f6;
          padding-bottom: 8px;
        }

        .specs-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .spec-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 6px;
          border-left: 4px solid #f59e0b;
        }

        .spec-label {
          font-weight: 600;
          color: #374151;
        }

        .spec-value {
          font-weight: 700;
          color: #f59e0b;
        }

        .spec-note {
          font-size: 0.85em;
          color: #6b7280;
          font-style: italic;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .feature-item.feature-positive {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .feature-item.feature-warning {
          background: #fffbeb;
          border-color: #fed7aa;
        }

        .feature-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.8em;
        }

        .feature-positive .feature-icon {
          background: #22c55e;
          color: white;
        }

        .feature-warning .feature-icon {
          background: #f59e0b;
          color: white;
        }

        .feature-content h4 {
          margin: 0 0 4px 0;
          font-size: 0.9em;
          color: #374151;
        }

        .feature-content p {
          margin: 0;
          font-size: 0.8em;
          color: #6b7280;
          line-height: 1.4;
        }

        .notification-actions {
          text-align: center;
          margin-bottom: 16px;
        }

        .btn-continue {
          background: #f59e0b;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 1em;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 auto;
        }

        .btn-continue:hover {
          background: #d97706;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .btn-icon {
          font-size: 1.2em;
        }

        .auto-dismiss-info {
          text-align: center;
          color: #9ca3af;
          font-size: 0.8em;
        }

        .test-mode-indicator {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #e3f2fd;
          color: #1976d2;
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 0.8em;
          font-weight: 600;
          border: 1px solid #2196f3;
          z-index: 10001;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-50px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 600px) {
          .mode-notification-container {
            width: 95%;
            margin: 20px;
          }
          
          .notification-content {
            padding: 24px;
          }
          
          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <script>
        let unscanCountdown = 5;
        let countdownInterval;

        function acknowledgeUnscanMode() {
          clearInterval(countdownInterval);
          window.electronAPI.invoke('mode-notification:unscan-acknowledged');
        }

        function startUnscanCountdown() {
          countdownInterval = setInterval(() => {
            unscanCountdown--;
            const countdownElement = document.getElementById('unscan-countdown');
            if (countdownElement) {
              countdownElement.textContent = unscanCountdown;
            }

            if (unscanCountdown <= 0) {
              clearInterval(countdownInterval);
              acknowledgeUnscanMode();
            }
          }, 1000);
        }

        // Start countdown when loaded
        startUnscanCountdown();
      </script>
    `;
  }

  /**
   * Setup IPC handlers for UNSCAN notification
   * @param {Function} resolve - Promise resolve function
   */
  setupUnscanNotificationHandlers(resolve) {
    const { ipcMain } = require('electron');

    const handler = (event) => {
      ipcMain.removeHandler('mode-notification:unscan-acknowledged');
      this.logger?.info('MODE_NOTIFICATION', 'UNSCAN mode acknowledged by user');
      resolve(true);
    };

    ipcMain.handle('mode-notification:unscan-acknowledged', handler);
  }

  /**
   * Get test mode indicator if in development
   * @returns {string} HTML for test mode indicator
   */
  getTestModeIndicator() {
    const config = AppModeConfigManager.getConfig();
    if (config.developmentMode?.enabled) {
      return '<div class="test-mode-indicator">🧪 TEST MODE</div>';
    }
    return '';
  }

  /**
   * Create flow completion result
   * @param {string} outcome - Flow outcome
   * @param {boolean} canProceed - Whether app can proceed
   * @param {string} message - Result message
   * @returns {Object} Flow result
   */
  createFlowResult(outcome, canProceed, message = '') {
    return {
      outcome: outcome,
      canProceed: canProceed,
      message: message,
      userChoices: this.userChoices,
      timestamp: new Date().toISOString(),
      duration: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Cleanup handlers and timers
   */
  cleanup() {
    // Remove any remaining IPC handlers
    const { ipcMain } = require('electron');
    try {
      ipcMain.removeHandler('mode-notification:unscan-acknowledged');
    } catch (error) {
      // Handlers may not exist
    }

    // Cleanup hybrid flow
    if (this.hybridFlow) {
      this.hybridFlow.cleanup();
    }

    this.logger?.info('MODE_NOTIFICATION', 'Mode notification UI cleanup completed');
  }
}

module.exports = { ModeNotificationUI };
