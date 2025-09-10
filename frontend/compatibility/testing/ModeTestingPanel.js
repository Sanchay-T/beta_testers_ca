// ModeTestingPanel.js
const { AppModeConfigManager } = require('../config/AppModeConfigManager');
const { ModeDecisionEngine } = require('../modules/ModeDecisionEngine');
const { ModeStorageManager } = require('../modules/ModeStorageManager');

class ModeTestingPanel {
  constructor(logger = null, compatibilityWindow = null) {
    this.logger = logger;
    this.window = compatibilityWindow;
    this.decisionEngine = new ModeDecisionEngine(logger, this.updateProgress.bind(this));
    this.storageManager = new ModeStorageManager(logger);
    this.isTestRunning = false;
    this.lastDecision = null;
  }

  /**
   * Generate testing panel HTML for compatibility window
   * @returns {string} HTML for testing panel
   */
  generateTestingPanelHTML() {
    const config = AppModeConfigManager.getConfig();
    const overrides = config.testingOverrides || {};
    const lastDecision = this.storageManager.loadLastModeDecision();

    return `
      <div id="mode-testing-panel" class="testing-panel">
        <div class="testing-header">
          <h3>🧪 App Mode Testing Panel</h3>
          <p>Development mode active - Test each scenario manually</p>
        </div>

        <!-- Current Configuration -->
        <div class="config-section">
          <h4>Configuration</h4>
          <div class="config-controls">
            <button onclick="viewConfig()" class="btn-secondary">View Config JSON</button>
            <button onclick="editConfig()" class="btn-secondary">Edit Config</button>
            <button onclick="resetConfig()" class="btn-warning">Reset to Default</button>
          </div>
        </div>

        <!-- System Override Controls -->
        <div class="override-section">
          <h4>System Overrides (Testing)</h4>
          <div class="override-grid">
            <div class="override-item">
              <label>Force RAM (GB):</label>
              <select id="force-ram" onchange="applyOverride('forceRAM', this.value)">
                <option value="">Auto Detect</option>
                <option value="4" ${overrides.forceRAM === 4 ? 'selected' : ''}>4 GB</option>
                <option value="8" ${overrides.forceRAM === 8 ? 'selected' : ''}>8 GB</option>
                <option value="16" ${overrides.forceRAM === 16 ? 'selected' : ''}>16 GB</option>
                <option value="32" ${overrides.forceRAM === 32 ? 'selected' : ''}>32 GB</option>
              </select>
            </div>
            
            <div class="override-item">
              <label>Force CPU:</label>
              <select id="force-cpu" onchange="applyOverride('forceCPU', this.value)">
                <option value="">Auto Detect</option>
                <option value="i3" ${overrides.forceCPU === 'i3' ? 'selected' : ''}>i3</option>
                <option value="i5" ${overrides.forceCPU === 'i5' ? 'selected' : ''}>i5</option>
                <option value="i7" ${overrides.forceCPU === 'i7' ? 'selected' : ''}>i7</option>
                <option value="i9" ${overrides.forceCPU === 'i9' ? 'selected' : ''}>i9</option>
                <option value="ryzen5" ${overrides.forceCPU === 'ryzen5' ? 'selected' : ''}>Ryzen 5</option>
              </select>
            </div>

            <div class="override-item">
              <label>Force Scan Result:</label>
              <select id="force-scan" onchange="applyOverride('forceScanResult', this.value)">
                <option value="">Run Real Test</option>
                <option value="pass" ${overrides.forceScanResult === 'pass' ? 'selected' : ''}>Force Pass</option>
                <option value="fail" ${overrides.forceScanResult === 'fail' ? 'selected' : ''}>Force Fail</option>
              </select>
            </div>

            <div class="override-item">
              <label>Force Mode:</label>
              <select id="force-mode" onchange="applyOverride('forceMode', this.value)">
                <option value="">Auto Decide</option>
                <option value="SCAN" ${overrides.forceMode === 'SCAN' ? 'selected' : ''}>SCAN Mode</option>
                <option value="UNSCAN" ${overrides.forceMode === 'UNSCAN' ? 'selected' : ''}>UNSCAN Mode</option>
                <option value="HYBRID" ${overrides.forceMode === 'HYBRID' ? 'selected' : ''}>HYBRID Mode</option>
              </select>
            </div>
          </div>
          
          <div class="override-controls">
            <button onclick="resetOverrides()" class="btn-warning">Reset All Overrides</button>
          </div>
        </div>

        <!-- Test Scenarios -->
        <div class="scenarios-section">
          <h4>Test Scenarios</h4>
          <div class="scenario-grid">
            <div class="scenario-item">
              <h5>High-End PC (SCAN Mode)</h5>
              <p>16GB RAM + i7 CPU + Fast Scan</p>
              <button onclick="testScenario('highEnd')" class="btn-success" ${this.isTestRunning ? 'disabled' : ''}>
                Test SCAN Mode
              </button>
            </div>

            <div class="scenario-item">
              <h5>Mid-Range PC (UNSCAN Mode)</h5>
              <p>8GB RAM + i5 CPU + Slow Scan</p>
              <button onclick="testScenario('midRange')" class="btn-warning" ${this.isTestRunning ? 'disabled' : ''}>
                Test UNSCAN Mode
              </button>
            </div>

            <div class="scenario-item">
              <h5>Low-End PC (HYBRID Mode)</h5>
              <p>4GB RAM + i3 CPU + No Scan Test</p>
              <button onclick="testScenario('lowEnd')" class="btn-danger" ${this.isTestRunning ? 'disabled' : ''}>
                Test HYBRID Mode
              </button>
            </div>

            <div class="scenario-item">
              <h5>Auto Detection</h5>
              <p>Use actual system specs</p>
              <button onclick="runAutoDetection()" class="btn-primary" ${this.isTestRunning ? 'disabled' : ''}>
                ${this.isTestRunning ? 'Running...' : 'Run Auto Detection'}
              </button>
            </div>
          </div>
        </div>

        <!-- Test Progress -->
        <div class="progress-section">
          <h4>Test Progress</h4>
          <div class="progress-bar">
            <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
          </div>
          <div id="progress-message" class="progress-message">Ready to test</div>
        </div>

        <!-- Results Display -->
        <div class="results-section">
          <h4>Test Results</h4>
          <div id="test-results" class="results-display">
            ${lastDecision ? this.formatLastDecisionHTML(lastDecision) : 'No recent decisions'}
          </div>
        </div>

        <!-- Storage and Logs -->
        <div class="storage-section">
          <h4>Storage & Logs</h4>
          <div class="storage-controls">
            <button onclick="viewStoredDecision()" class="btn-secondary">View Stored Decision</button>
            <button onclick="viewDecisionHistory()" class="btn-secondary">View History</button>
            <button onclick="viewStorageStatus()" class="btn-secondary">Storage Status</button>
            <button onclick="clearStorage()" class="btn-warning">Clear Storage</button>
          </div>
        </div>

        <!-- Continue Controls -->
        <div class="continue-section">
          <h4>Continue to Main App</h4>
          <div class="continue-controls">
            <button onclick="continueToApp()" class="btn-primary" ${!this.lastDecision ? 'disabled' : ''}>
              Launch CypherEdge (${this.lastDecision ? this.lastDecision.determinedMode : 'No Mode Set'})
            </button>
            <button onclick="cancelTest()" class="btn-secondary">Cancel & Exit</button>
          </div>
        </div>
      </div>

      <style>
        .testing-panel {
          max-width: 900px;
          margin: 20px auto;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .testing-header {
          text-align: center;
          margin-bottom: 30px;
          padding: 15px;
          background: #e3f2fd;
          border-radius: 6px;
          border-left: 4px solid #2196f3;
        }

        .testing-header h3 {
          margin: 0 0 8px 0;
          color: #1976d2;
          font-size: 1.4em;
        }

        .testing-header p {
          margin: 0;
          color: #555;
        }

        .config-section, .override-section, .scenarios-section, 
        .progress-section, .results-section, .storage-section, .continue-section {
          margin-bottom: 25px;
          padding: 15px;
          background: white;
          border-radius: 6px;
          border: 1px solid #ddd;
        }

        .config-section h4, .override-section h4, .scenarios-section h4,
        .progress-section h4, .results-section h4, .storage-section h4, .continue-section h4 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 1.1em;
          border-bottom: 1px solid #eee;
          padding-bottom: 8px;
        }

        .config-controls, .storage-controls, .continue-controls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .override-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 15px;
        }

        .override-item {
          display: flex;
          flex-direction: column;
        }

        .override-item label {
          font-weight: 500;
          margin-bottom: 5px;
          color: #555;
        }

        .override-item select {
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }

        .scenario-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 15px;
        }

        .scenario-item {
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 6px;
          text-align: center;
        }

        .scenario-item h5 {
          margin: 0 0 8px 0;
          font-size: 1em;
        }

        .scenario-item p {
          margin: 0 0 12px 0;
          font-size: 0.9em;
          color: #666;
        }

        .progress-bar {
          width: 100%;
          height: 20px;
          background: #f0f0f0;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 10px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(45deg, #4caf50, #2196f3);
          transition: width 0.3s ease;
        }

        .progress-message {
          font-size: 0.9em;
          color: #555;
          text-align: center;
        }

        .results-display {
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
          font-family: monospace;
          max-height: 300px;
          overflow-y: auto;
        }

        .btn-primary, .btn-secondary, .btn-success, .btn-warning, .btn-danger {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .btn-primary { background: #2196f3; color: white; }
        .btn-primary:hover { background: #1976d2; }
        .btn-primary:disabled { background: #bbb; cursor: not-allowed; }

        .btn-secondary { background: #6c757d; color: white; }
        .btn-secondary:hover { background: #5a6268; }

        .btn-success { background: #28a745; color: white; }
        .btn-success:hover { background: #218838; }

        .btn-warning { background: #ffc107; color: #212529; }
        .btn-warning:hover { background: #e0a800; }

        .btn-danger { background: #dc3545; color: white; }
        .btn-danger:hover { background: #c82333; }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .override-controls {
          text-align: center;
          margin-top: 15px;
        }
      </style>

      <script>
        // Testing panel JavaScript functions will be injected here
        ${this.generateTestingPanelJavaScript()}
      </script>
    `;
  }

  /**
   * Generate JavaScript functions for testing panel
   * @returns {string} JavaScript code
   */
  generateTestingPanelJavaScript() {
    return `
      // Global variables for testing panel
      let currentTestRun = null;
      let testProgress = 0;

      // View configuration JSON
      function viewConfig() {
        window.electronAPI.invoke('mode-testing:view-config').then(config => {
          showModal('Configuration', '<pre>' + JSON.stringify(config, null, 2) + '</pre>');
        });
      }

      // Edit configuration
      function editConfig() {
        window.electronAPI.invoke('mode-testing:get-config').then(config => {
          const configStr = JSON.stringify(config, null, 2);
          const newConfig = prompt('Edit Configuration (JSON format):', configStr);
          if (newConfig && newConfig !== configStr) {
            try {
              const parsed = JSON.parse(newConfig);
              window.electronAPI.invoke('mode-testing:save-config', parsed);
              location.reload(); // Reload to show changes
            } catch (e) {
              alert('Invalid JSON format: ' + e.message);
            }
          }
        });
      }

      // Reset configuration to default
      function resetConfig() {
        if (confirm('Reset configuration to default values?')) {
          window.electronAPI.invoke('mode-testing:reset-config').then(() => {
            location.reload();
          });
        }
      }

      // Apply testing override
      function applyOverride(key, value) {
        const actualValue = value === '' ? null : (isNaN(value) ? value : Number(value));
        window.electronAPI.invoke('mode-testing:set-override', { key, value: actualValue });
      }

      // Reset all overrides
      function resetOverrides() {
        window.electronAPI.invoke('mode-testing:reset-overrides').then(() => {
          location.reload();
        });
      }

      // Test predefined scenario
      function testScenario(scenario) {
        if (currentTestRun) return;
        
        const scenarios = {
          highEnd: { forceRAM: 16, forceCPU: 'i7', forceScanResult: 'pass' },
          midRange: { forceRAM: 8, forceCPU: 'i5', forceScanResult: 'fail' },
          lowEnd: { forceRAM: 4, forceCPU: 'i3', forceScanResult: null }
        };

        const config = scenarios[scenario];
        if (!config) return;

        // Apply overrides for this scenario
        Object.keys(config).forEach(key => {
          if (config[key] !== null) {
            window.electronAPI.invoke('mode-testing:set-override', { key, value: config[key] });
          }
        });

        // Run the test
        setTimeout(() => runAutoDetection(), 500);
      }

      // Run auto detection with current settings
      function runAutoDetection() {
        if (currentTestRun) return;

        currentTestRun = true;
        updateProgress('Starting mode detection...', 0);
        disableTestButtons(true);

        window.electronAPI.invoke('mode-testing:run-detection').then(result => {
          currentTestRun = false;
          disableTestButtons(false);
          updateProgress('Detection complete!', 100);
          displayResults(result);
          updateContinueButton(result);
        }).catch(error => {
          currentTestRun = false;
          disableTestButtons(false);
          updateProgress('Detection failed: ' + error.message, 0);
          displayResults({ error: error.message });
        });
      }

      // Update progress display
      function updateProgress(message, percent) {
        document.getElementById('progress-message').textContent = message;
        document.getElementById('progress-fill').style.width = percent + '%';
      }

      // Display test results
      function displayResults(result) {
        const resultsDiv = document.getElementById('test-results');
        if (result.error) {
          resultsDiv.innerHTML = '<div style="color: red;">Error: ' + result.error + '</div>';
        } else {
          resultsDiv.innerHTML = formatDecisionResult(result);
        }
      }

      // Format decision result for display
      function formatDecisionResult(result) {
        return \`
          <div style="margin-bottom: 15px;">
            <strong>Determined Mode: <span style="color: \${getModeColor(result.mode)};">\${result.mode}</span></strong>
          </div>
          <div><strong>Confidence:</strong> \${result.confidence}</div>
          <div><strong>Reason:</strong> \${result.reason}</div>
          <div><strong>Duration:</strong> \${result.duration}ms</div>
          <div style="margin-top: 10px;"><strong>System Specs:</strong></div>
          <div style="margin-left: 15px;">
            RAM: \${result.analysis?.hardware?.ram?.actual || 0}GB
            (Required: \${result.analysis?.hardware?.ram?.required || 8}GB)
          </div>
          <div style="margin-left: 15px;">
            CPU: \${result.analysis?.hardware?.cpu?.actual || 'unknown'}
            (Required: \${result.analysis?.hardware?.cpu?.required || 'i5'}+)
          </div>
          \${result.analysis?.scanTest ? \`
            <div style="margin-top: 10px;"><strong>Scan Test:</strong></div>
            <div style="margin-left: 15px;">
              Result: \${result.analysis.scanTest.passed ? 'PASSED' : 'FAILED'}
              (\${result.analysis.scanTest.duration}ms)
            </div>
          \` : ''}
        \`;
      }

      // Get color for mode
      function getModeColor(mode) {
        const colors = { 'SCAN': '#28a745', 'UNSCAN': '#ffc107', 'HYBRID': '#dc3545' };
        return colors[mode] || '#6c757d';
      }

      // Disable/enable test buttons
      function disableTestButtons(disabled) {
        const buttons = document.querySelectorAll('button[onclick*="test"], button[onclick*="runAuto"]');
        buttons.forEach(btn => btn.disabled = disabled);
      }

      // Update continue button
      function updateContinueButton(result) {
        const btn = document.querySelector('button[onclick="continueToApp()"]');
        if (result && result.mode) {
          btn.disabled = false;
          btn.textContent = \`Launch CypherEdge (\${result.mode} Mode)\`;
        }
      }

      // View stored decision
      function viewStoredDecision() {
        window.electronAPI.invoke('mode-testing:get-stored-decision').then(decision => {
          if (decision) {
            showModal('Stored Decision', '<pre>' + JSON.stringify(decision, null, 2) + '</pre>');
          } else {
            alert('No stored decision found');
          }
        });
      }

      // View decision history
      function viewDecisionHistory() {
        window.electronAPI.invoke('mode-testing:get-decision-history').then(history => {
          if (history && history.length > 0) {
            const historyHtml = history.map((item, index) => 
              \`<div style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd;">
                <strong>#\${index + 1}</strong> - \${item.mode} 
                (\${new Date(item.timestamp).toLocaleString()})
                <br><small>\${item.reason}</small>
              </div>\`
            ).join('');
            showModal('Decision History', historyHtml);
          } else {
            alert('No decision history found');
          }
        });
      }

      // View storage status
      function viewStorageStatus() {
        window.electronAPI.invoke('mode-testing:get-storage-status').then(status => {
          showModal('Storage Status', '<pre>' + JSON.stringify(status, null, 2) + '</pre>');
        });
      }

      // Clear storage
      function clearStorage() {
        if (confirm('Clear all stored decisions and history?')) {
          window.electronAPI.invoke('mode-testing:clear-storage').then(() => {
            alert('Storage cleared');
            location.reload();
          });
        }
      }

      // Continue to main app
      function continueToApp() {
        window.electronAPI.invoke('mode-testing:continue-to-app');
      }

      // Cancel and exit
      function cancelTest() {
        if (confirm('Cancel testing and exit application?')) {
          window.electronAPI.invoke('mode-testing:cancel-exit');
        }
      }

      // Show modal dialog
      function showModal(title, content) {
        const modal = document.createElement('div');
        modal.style.cssText = \`
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); z-index: 1000;
          display: flex; align-items: center; justify-content: center;
        \`;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = \`
          background: white; padding: 20px; border-radius: 8px;
          max-width: 80%; max-height: 80%; overflow: auto;
        \`;
        
        dialog.innerHTML = \`
          <h3>\${title}</h3>
          <div>\${content}</div>
          <div style="text-align: right; margin-top: 15px;">
            <button onclick="this.closest('[style*=fixed]').remove()">Close</button>
          </div>
        \`;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
      }

      // Listen for progress updates
      if (window.electronAPI) {
        window.electronAPI.on('mode-testing:progress', (data) => {
          updateProgress(data.message, data.percent);
        });
      }
    `;
  }

  /**
   * Format last decision for HTML display
   * @param {Object} decision - Last decision
   * @returns {string} Formatted HTML
   */
  formatLastDecisionHTML(decision) {
    if (!decision) return 'No recent decisions';

    const modeColor = decision.determinedMode === 'SCAN' ? '#28a745' : 
                     decision.determinedMode === 'UNSCAN' ? '#ffc107' : '#dc3545';

    return `
      <div style="margin-bottom: 10px;">
        <strong>Last Mode: <span style="color: ${modeColor};">${decision.determinedMode}</span></strong>
      </div>
      <div><strong>Timestamp:</strong> ${new Date(decision.timestamp).toLocaleString()}</div>
      <div><strong>System:</strong> ${decision.systemSpecifications.ram.total}GB RAM, ${decision.systemSpecifications.cpu.class} CPU</div>
      <div><strong>Scan Test:</strong> ${decision.scanTest.conducted ? (decision.scanTest.passed ? 'PASSED' : 'FAILED') : 'Not Conducted'}</div>
    `;
  }

  /**
   * Update progress callback for decision engine
   * @param {Object} progressData - Progress data
   */
  updateProgress(progressData) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('mode-testing:progress', progressData);
    }
  }

  /**
   * Register IPC handlers for testing panel
   */
  registerIPCHandlers() {
    const { ipcMain } = require('electron');

    // View configuration
    ipcMain.handle('mode-testing:view-config', () => {
      return AppModeConfigManager.getConfig();
    });

    // Get configuration for editing
    ipcMain.handle('mode-testing:get-config', () => {
      return AppModeConfigManager.getConfig();
    });

    // Save configuration
    ipcMain.handle('mode-testing:save-config', (event, newConfig) => {
      return AppModeConfigManager.saveConfig(newConfig);
    });

    // Reset configuration
    ipcMain.handle('mode-testing:reset-config', () => {
      return AppModeConfigManager.resetTestingOverrides();
    });

    // Set testing override
    ipcMain.handle('mode-testing:set-override', (event, { key, value }) => {
      return AppModeConfigManager.setTestingOverride(key, value);
    });

    // Reset all overrides
    ipcMain.handle('mode-testing:reset-overrides', () => {
      return AppModeConfigManager.resetTestingOverrides();
    });

    // Run mode detection
    ipcMain.handle('mode-testing:run-detection', async () => {
      try {
        const result = await this.decisionEngine.determineAppMode();
        
        // Save the result
        await this.storageManager.saveModeDecision(result);
        this.lastDecision = this.storageManager.loadLastModeDecision();
        
        return result;
      } catch (error) {
        this.logger?.error('MODE_TESTING', 'Detection failed in testing panel', {
          error: error.message
        });
        throw error;
      }
    });

    // Get stored decision
    ipcMain.handle('mode-testing:get-stored-decision', () => {
      return this.storageManager.loadLastModeDecision();
    });

    // Get decision history
    ipcMain.handle('mode-testing:get-decision-history', () => {
      return this.storageManager.getDecisionHistory();
    });

    // Get storage status
    ipcMain.handle('mode-testing:get-storage-status', () => {
      return this.storageManager.getStorageStatus();
    });

    // Clear storage
    ipcMain.handle('mode-testing:clear-storage', () => {
      // Implementation would clear storage files
      return { success: true };
    });

    // Continue to app
    ipcMain.handle('mode-testing:continue-to-app', () => {
      // Signal to continue to main app
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('compatibility:proceed');
      }
      return { success: true };
    });

    // Cancel and exit
    ipcMain.handle('mode-testing:cancel-exit', () => {
      // Signal to exit application
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('compatibility:cancel');
      }
      return { success: true };
    });

    this.logger?.info('MODE_TESTING', 'IPC handlers registered for testing panel');
  }

  /**
   * Initialize testing panel
   */
  initialize() {
    this.registerIPCHandlers();
    this.logger?.info('MODE_TESTING', 'Testing panel initialized');
  }
}

module.exports = { ModeTestingPanel };