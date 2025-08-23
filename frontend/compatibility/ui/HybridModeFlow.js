// HybridModeFlow.js
const { AppModeConfigManager } = require('../config/AppModeConfigManager');

class HybridModeFlow {
  constructor(logger = null, compatibilityWindow = null) {
    this.logger = logger;
    this.window = compatibilityWindow;
    this.currentStep = 'warning';
    this.userChoices = {
      hasAlternativePC: null,
      proceedWithPayment: null,
      hybridModeEnabled: false
    };
    this.countdownTimer = null;
  }

  /**
   * Start the hybrid mode flow
   * @param {Object} decisionResult - Mode decision result that determined HYBRID
   * @returns {Promise<Object>} Flow completion result
   */
  async startHybridFlow(decisionResult) {
    this.logger?.info('HYBRID_FLOW', 'Starting hybrid mode flow', {
      reason: decisionResult.reason,
      specs: decisionResult.analysis?.hardware?.specs
    });

    try {
      // Step 1: Show low spec warning and ask about alternative PC
      const alternativeChoice = await this.showAlternativePCQuestion(decisionResult);
      this.userChoices.hasAlternativePC = alternativeChoice;

      if (alternativeChoice) {
        // User has alternative PC - show countdown and exit
        await this.showAlternativePCCountdown();
        return this.createFlowResult('alternative_pc', false);
      } else {
        // User doesn't have alternative PC - show payment screen
        const paymentChoice = await this.showPaymentScreen();
        this.userChoices.proceedWithPayment = paymentChoice;

        if (paymentChoice) {
          // User agreed to payment - mark hybrid mode as enabled (for testing)
          this.userChoices.hybridModeEnabled = true;
          return this.createFlowResult('payment_agreed', true);
        } else {
          // User declined payment - exit
          return this.createFlowResult('payment_declined', false);
        }
      }

    } catch (error) {
      this.logger?.error('HYBRID_FLOW', 'Hybrid flow failed', {
        error: error.message,
        currentStep: this.currentStep
      });

      return this.createFlowResult('error', false, error.message);
    }
  }

  /**
   * Show alternative PC question screen
   * @param {Object} decisionResult - Decision result
   * @returns {Promise<boolean>} User choice (true = has alternative, false = no alternative)
   */
  async showAlternativePCQuestion(decisionResult) {
    this.currentStep = 'alternative_question';
    
    const config = AppModeConfigManager.getConfig();
    const messages = config.userExperience?.hybridModeFlow?.messages || {};

    const html = this.generateAlternativeQuestionHTML(decisionResult, messages);
    
    return new Promise((resolve) => {
      // Send HTML to compatibility window
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('hybrid-flow:show-screen', {
          type: 'alternative_question',
          html: html
        });

        // Set up IPC handlers for user response
        this.setupAlternativeQuestionHandlers(resolve);
      } else {
        resolve(false);
      }
    });
  }

  /**
   * Generate HTML for alternative PC question
   * @param {Object} decisionResult - Decision result
   * @param {Object} messages - Configuration messages
   * @returns {string} HTML content
   */
  generateAlternativeQuestionHTML(decisionResult, messages) {
    const specs = decisionResult.analysis?.hardware?.specs || {};
    const ramTotal = specs.ram?.total || specs.memory?.total || 0;
    const cpuClass = specs.cpu?.class || 'unknown';

    return `
      <div class="hybrid-flow-container">
        <div class="hybrid-warning-section">
          <div class="warning-icon">⚠️</div>
          <h2>System Performance Notice</h2>
          <p class="warning-message">${messages.lowSpecWarning || 'This PC requires hybrid mode upgrade for optimal CypherEdge performance'}</p>
        </div>

        <div class="specs-section">
          <h3>Detected System Specifications</h3>
          <div class="specs-grid">
            <div class="spec-item ${ramTotal < 8 ? 'spec-warning' : 'spec-ok'}">
              <span class="spec-label">RAM:</span>
              <span class="spec-value">${ramTotal}GB</span>
              <span class="spec-requirement">(Recommended: 8GB+)</span>
            </div>
            <div class="spec-item ${!this.isCPUSufficient(cpuClass) ? 'spec-warning' : 'spec-ok'}">
              <span class="spec-label">CPU:</span>
              <span class="spec-value">${cpuClass.toUpperCase()}</span>
              <span class="spec-requirement">(Recommended: i5+)</span>
            </div>
          </div>
        </div>

        <div class="explanation-section">
          <h3>Why Hybrid Mode is Recommended</h3>
          <ul class="explanation-list">
            <li>Your current hardware may experience slow performance with intensive ML processing</li>
            <li>Hybrid mode uses cloud-assisted processing for optimal speed</li>
            <li>Local processing remains available for basic operations</li>
            <li>Ensures smooth operation without system slowdowns</li>
          </ul>
        </div>

        <div class="question-section">
          <h3 class="question-title">${messages.alternativePCQuestion || 'Do you have another PC or system available?'}</h3>
          <p class="question-subtitle">If you have a more powerful system available, we recommend running CypherEdge there for the best experience.</p>
          
                    <div class="choice-buttons">
            <button onclick="selectAlternativeChoice(true)" class="btn-alternative-yes">
              <span class="btn-icon">💻</span>
              <div class="btn-content">
                <span class="btn-text">Yes, I'll use another PC</span>
                <span class="btn-subtitle">Recommended for best performance</span>
              </div>
            </button>
            
            <button onclick="selectAlternativeChoice(false)" class="btn-alternative-no">
              <span class="btn-icon">🔄</span>
              <div class="btn-content">
                <span class="btn-text">No, continue with this PC</span>
                <span class="btn-subtitle">Enable hybrid mode here</span>
              </div>
            </button>
          </div>
        </div>

        ${this.getTestModeIndicator()}
      </div>

      <style>
        .hybrid-flow-container {
          max-width: 700px;
          margin: 20px auto;
          padding: 30px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .hybrid-warning-section {
          text-align: center;
          padding: 25px;
          background: linear-gradient(135deg, #fff3cd, #ffeaa7);
          border-radius: 10px;
          margin-bottom: 25px;
          border-left: 5px solid #ffc107;
        }

        .warning-icon {
          font-size: 3em;
          margin-bottom: 15px;
        }

        .hybrid-warning-section h2 {
          color: #856404;
          margin: 0 0 10px 0;
          font-size: 1.5em;
        }

        .warning-message {
          color: #856404;
          font-size: 1.1em;
          margin: 0;
          line-height: 1.4;
        }

        .specs-section, .explanation-section, .question-section {
          margin-bottom: 25px;
        }

        .specs-section h3, .explanation-section h3 {
          color: #333;
          margin-bottom: 15px;
          font-size: 1.2em;
          border-bottom: 2px solid #f0f0f0;
          padding-bottom: 8px;
        }

        .specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
        }

        .spec-item {
          padding: 15px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .spec-item.spec-warning {
          background: #fff5f5;
          border: 1px solid #fed7d7;
        }

        .spec-item.spec-ok {
          background: #f0fff4;
          border: 1px solid #c6f6d5;
        }

        .spec-label {
          font-weight: 600;
          color: #333;
        }

        .spec-value {
          font-weight: 700;
          color: #2d3748;
        }

        .spec-requirement {
          font-size: 0.85em;
          color: #666;
        }

        .explanation-list {
          list-style: none;
          padding: 0;
        }

        .explanation-list li {
          padding: 8px 0;
          padding-left: 25px;
          position: relative;
          line-height: 1.5;
        }

        .explanation-list li::before {
          content: "▶";
          position: absolute;
          left: 0;
          color: #0056b3;
          font-weight: bold;
        }

        .question-section {
          background: #f8f9fa;
          padding: 25px;
          border-radius: 10px;
          text-align: center;
        }

        .question-title {
          color: #0056b3;
          margin: 0 0 10px 0;
          font-size: 1.3em;
        }

        .question-subtitle {
          color: #666;
          margin: 0 0 25px 0;
          line-height: 1.4;
        }

        .choice-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 20px;
        }

        .btn-alternative-yes, .btn-alternative-no {
          padding: 20px 15px;
          border: 2px solid transparent;
          border-radius: 10px;
          cursor: pointer;
          text-align: center;
          transition: all 0.3s ease;
          background: white;
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        }

        .btn-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          flex: 1;
        }

        .btn-alternative-yes {
          border-color: #28a745;
          color: #28a745;
        }

        .btn-alternative-yes:hover {
          background: #28a745;
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        }

        .btn-alternative-no {
          border-color: #0056b3;
          color: #0056b3;
        }

        .btn-alternative-no:hover {
          background: #0056b3;
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 86, 179, 0.3);
        }

        .btn-icon {
          font-size: 2.5em;
          min-width: 60px;
          text-align: center;
        }

        .btn-text {
          font-weight: 600;
          font-size: 1.1em;
          text-align: left;
        }

        .btn-subtitle {
          font-size: 0.85em;
          opacity: 0.8;
          text-align: left;
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
        }

        @media (max-width: 600px) {
          .choice-buttons {
            grid-template-columns: 1fr;
          }
          
          .hybrid-flow-container {
            margin: 10px;
            padding: 20px;
          }
        }
      </style>

      <script>
        function selectAlternativeChoice(hasAlternative) {
          window.electronAPI.invoke('hybrid-flow:alternative-choice', hasAlternative);
        }
      </script>
    `;
  }

  /**
   * Show alternative PC countdown screen
   * @returns {Promise<void>}
   */
  async showAlternativePCCountdown() {
    this.currentStep = 'countdown';
    
    const config = AppModeConfigManager.getConfig();
    const timeout = config.userExperience?.hybridModeFlow?.timeouts?.alternativePCPrompt || 15000;
    const messages = config.userExperience?.hybridModeFlow?.messages || {};

    const html = this.generateCountdownHTML(messages, timeout);

    return new Promise((resolve) => {
      // Send HTML to window
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('hybrid-flow:show-screen', {
          type: 'countdown',
          html: html
        });

        // Start countdown
        this.startCountdown(timeout / 1000, resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * Generate countdown HTML
   * @param {Object} messages - Configuration messages
   * @param {number} timeout - Timeout in milliseconds
   * @returns {string} HTML content
   */
  generateCountdownHTML(messages, timeout) {
    const seconds = Math.floor(timeout / 1000);

    return `
      <div class="countdown-container">
        <div class="countdown-content">
          <div class="countdown-icon">💻</div>
          <h2>Great Choice!</h2>
          <p class="countdown-message">${messages.alternativePCAdvice || 'Please try running CypherEdge on your other system for better performance'}</p>
          
          <div class="countdown-display">
            <div class="countdown-number" id="countdown-number">${seconds}</div>
            <div class="countdown-label">seconds remaining</div>
          </div>

          <div class="countdown-actions">
            <button onclick="closeNow()" class="btn-close-now">Close Now</button>
          </div>

          <div class="countdown-note">
            <p>CypherEdge will close automatically. Please install and run on your more powerful system.</p>
          </div>
        </div>

        ${this.getTestModeIndicator()}
      </div>

      <style>
        .countdown-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .countdown-content {
          background: white;
          padding: 40px;
          border-radius: 20px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          max-width: 500px;
          width: 100%;
        }

        .countdown-icon {
          font-size: 4em;
          margin-bottom: 20px;
        }

        .countdown-content h2 {
          color: #333;
          margin: 0 0 15px 0;
          font-size: 2em;
        }

        .countdown-message {
          color: #666;
          font-size: 1.1em;
          line-height: 1.5;
          margin-bottom: 30px;
        }

        .countdown-display {
          margin: 30px 0;
        }

        .countdown-number {
          font-size: 4em;
          font-weight: bold;
          color: #0056b3;
          margin-bottom: 5px;
        }

        .countdown-label {
          font-size: 1.1em;
          color: #666;
        }

        .countdown-actions {
          margin: 30px 0;
        }

        .btn-close-now {
          padding: 12px 24px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 25px;
          font-size: 1em;
          cursor: pointer;
          transition: background 0.3s ease;
        }

        .btn-close-now:hover {
          background: #c82333;
        }

        .countdown-note {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 10px;
          border-left: 4px solid #0056b3;
        }

        .countdown-note p {
          margin: 0;
          color: #666;
          font-size: 0.9em;
        }
      </style>

      <script>
        let countdownInterval;

        function closeNow() {
          if (countdownInterval) clearInterval(countdownInterval);
          window.electronAPI.invoke('hybrid-flow:close-app');
        }

        function updateCountdown(seconds) {
          document.getElementById('countdown-number').textContent = seconds;
        }

        // Countdown will be controlled by the main process
        window.electronAPI.on('hybrid-flow:countdown-update', (seconds) => {
          updateCountdown(seconds);
        });
      </script>
    `;
  }

  /**
   * Show payment screen
   * @returns {Promise<boolean>} User choice (true = agreed to pay, false = declined)
   */
  async showPaymentScreen() {
    this.currentStep = 'payment';
    
    const config = AppModeConfigManager.getConfig();
    const messages = config.userExperience?.hybridModeFlow?.messages || {};
    const qrConfig = config.userExperience?.hybridModeFlow?.qrCode || {};

    const html = this.generatePaymentScreenHTML(messages, qrConfig);

    return new Promise((resolve) => {
      // Send HTML to window
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('hybrid-flow:show-screen', {
          type: 'payment',
          html: html
        });

        // Set up payment handlers
        this.setupPaymentHandlers(resolve);
      } else {
        resolve(false);
      }
    });
  }

  /**
   * Generate payment screen HTML
   * @param {Object} messages - Configuration messages
   * @param {Object} qrConfig - QR code configuration
   * @returns {string} HTML content
   */
  generatePaymentScreenHTML(messages, qrConfig) {
    return `
      <div class="payment-container">
        <div class="payment-content">
          <div class="payment-header">
            <div class="payment-icon">🔄</div>
            <h2>Hybrid Mode Subscription Required</h2>
            <p class="payment-subtitle">${messages.paymentRequired || 'Hybrid mode requires a subscription. Scan the QR code to connect with our support team.'}</p>
          </div>

          <div class="payment-explanation">
            <h3>What is Hybrid Mode?</h3>
            <div class="explanation-grid">
              <div class="explanation-item">
                <div class="item-icon">💻</div>
                <div class="item-content">
                  <h4>Local Processing</h4>
                  <p>Basic operations run on your PC</p>
                </div>
              </div>
              <div class="explanation-item">
                <div class="item-icon">☁️</div>
                <div class="item-content">
                  <h4>Cloud Processing</h4>
                  <p>Heavy ML tasks processed in the cloud</p>
                </div>
              </div>
              <div class="explanation-item">
                <div class="item-icon">⚡</div>
                <div class="item-content">
                  <h4>Optimal Performance</h4>
                  <p>Fast results without system slowdown</p>
                </div>
              </div>
              <div class="explanation-item">
                <div class="item-icon">🔒</div>
                <div class="item-content">
                  <h4>Secure</h4>
                  <p>Data encrypted during cloud processing</p>
                </div>
              </div>
            </div>
          </div>

          <div class="payment-section">
            <h3>Setup Hybrid Mode</h3>
            <div class="payment-steps">
              <div class="payment-step">
                <div class="step-number">1</div>
                <div class="step-content">
                  <h4>Scan QR Code</h4>
                  <div class="qr-code-section">
                    <div class="qr-placeholder">
                      <div class="qr-code">
                        <!-- QR Code would be generated here -->
                        <div style="width: 150px; height: 150px; background: #f0f0f0; border: 2px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 0.8em; color: #666;">
                          QR Code<br>Generated Here
                        </div>
                      </div>
                      <p class="qr-info">Payment: ₹999 (One-time setup)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="payment-step">
                <div class="step-number">2</div>
                <div class="step-content">
                  <h4>Contact Support</h4>
                  <div class="contact-info">
                    <p><strong>Email:</strong> ${qrConfig.supportContact || 'support@cyphersol.co.in'}</p>
                    <p><strong>Phone:</strong> ${qrConfig.supportPhone || '+91-XXXX-XXXX-XX'}</p>
                    <p>Mention your system ID for quick setup</p>
                  </div>
                </div>
              </div>

              <div class="payment-step">
                <div class="step-number">3</div>
                <div class="step-content">
                  <h4>Enable Hybrid Mode</h4>
                  <p>Support team will enable hybrid mode for this system</p>
                </div>
              </div>
            </div>
          </div>

          <div class="payment-actions">
            <button onclick="markAsPaid()" class="btn-paid">
              ✅ I've Completed Payment & Setup
            </button>
            <button onclick="declinePayment()" class="btn-decline">
              ❌ Not Now, Exit Application
            </button>
          </div>

          <div class="system-id-section">
            <p class="system-id"><strong>System ID:</strong> <code>${this.generateSystemId()}</code></p>
            <p class="system-id-note">Provide this ID to support for quick setup</p>
          </div>
        </div>

        ${this.getTestModeIndicator()}
      </div>

      <style>
        .payment-container {
          max-width: 800px;
          margin: 20px auto;
          padding: 30px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .payment-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .payment-icon {
          font-size: 3em;
          margin-bottom: 15px;
        }

        .payment-header h2 {
          color: #0056b3;
          margin: 0 0 10px 0;
          font-size: 1.8em;
        }

        .payment-subtitle {
          color: #666;
          font-size: 1.1em;
          line-height: 1.4;
        }

        .payment-explanation, .payment-section {
          margin-bottom: 30px;
        }

        .payment-explanation h3, .payment-section h3 {
          color: #333;
          margin-bottom: 20px;
          font-size: 1.3em;
          border-bottom: 2px solid #f0f0f0;
          padding-bottom: 10px;
        }

        .explanation-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
        }

        .explanation-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .item-icon {
          font-size: 2em;
        }

        .item-content h4 {
          margin: 0 0 5px 0;
          color: #333;
          font-size: 1em;
        }

        .item-content p {
          margin: 0;
          color: #666;
          font-size: 0.85em;
        }

        .payment-steps {
          display: flex;
          flex-direction: column;
          gap: 25px;
        }

        .payment-step {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }

        .step-number {
          width: 40px;
          height: 40px;
          background: #0056b3;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.2em;
          flex-shrink: 0;
        }

        .step-content {
          flex: 1;
        }

        .step-content h4 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 1.2em;
        }

        .qr-code-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .qr-placeholder {
          text-align: center;
        }

        .qr-info {
          margin: 10px 0 0 0;
          font-weight: 600;
          color: #0056b3;
        }

        .contact-info {
          background: #e3f2fd;
          padding: 15px;
          border-radius: 8px;
        }

        .contact-info p {
          margin: 5px 0;
          color: #1976d2;
        }

        .payment-actions {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin: 30px 0;
        }

        .btn-paid, .btn-decline {
          padding: 15px 25px;
          border: none;
          border-radius: 8px;
          font-size: 1em;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-paid {
          background: #28a745;
          color: white;
        }

        .btn-paid:hover {
          background: #218838;
          transform: translateY(-2px);
        }

        .btn-decline {
          background: #6c757d;
          color: white;
        }

        .btn-decline:hover {
          background: #5a6268;
          transform: translateY(-2px);
        }

        .system-id-section {
          text-align: center;
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }

        .system-id {
          margin: 0 0 5px 0;
          font-size: 1em;
        }

        .system-id code {
          background: #e9ecef;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
        }

        .system-id-note {
          margin: 0;
          font-size: 0.85em;
          color: #666;
        }

        @media (max-width: 600px) {
          .payment-actions {
            flex-direction: column;
          }
          
          .payment-container {
            margin: 10px;
            padding: 20px;
          }
        }
      </style>

      <script>
        function markAsPaid() {
          window.electronAPI.invoke('hybrid-flow:payment-choice', true);
        }

        function declinePayment() {
          window.electronAPI.invoke('hybrid-flow:payment-choice', false);
        }
      </script>
    `;
  }

  /**
   * Setup IPC handlers for alternative question
   * @param {Function} resolve - Promise resolve function
   */
  setupAlternativeQuestionHandlers(resolve) {
    const { ipcMain } = require('electron');

    const handler = (event, hasAlternative) => {
      ipcMain.removeHandler('hybrid-flow:alternative-choice');
      this.logger?.info('HYBRID_FLOW', 'Alternative PC choice received', { hasAlternative });
      resolve(hasAlternative);
    };

    ipcMain.handle('hybrid-flow:alternative-choice', handler);
  }

  /**
   * Setup IPC handlers for payment screen
   * @param {Function} resolve - Promise resolve function
   */
  setupPaymentHandlers(resolve) {
    const { ipcMain } = require('electron');

    const handler = (event, agreedToPay) => {
      ipcMain.removeHandler('hybrid-flow:payment-choice');
      this.logger?.info('HYBRID_FLOW', 'Payment choice received', { agreedToPay });
      resolve(agreedToPay);
    };

    ipcMain.handle('hybrid-flow:payment-choice', handler);

    // Also handle app close
    ipcMain.handle('hybrid-flow:close-app', () => {
      const { app } = require('electron');
      app.quit();
    });
  }

  /**
   * Start countdown timer
   * @param {number} seconds - Countdown duration in seconds
   * @param {Function} resolve - Promise resolve function
   */
  startCountdown(seconds, resolve) {
    let remaining = seconds;

    this.countdownTimer = setInterval(() => {
      remaining--;
      
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('hybrid-flow:countdown-update', remaining);
      }

      if (remaining <= 0) {
        clearInterval(this.countdownTimer);
        this.logger?.info('HYBRID_FLOW', 'Countdown completed - closing application');
        
        // Close application
        const { app } = require('electron');
        app.quit();
        
        resolve();
      }
    }, 1000);
  }

  /**
   * Check if CPU is sufficient for full mode
   * @param {string} cpuClass - CPU class
   * @returns {boolean} Whether CPU is sufficient
   */
  isCPUSufficient(cpuClass) {
    const sufficientCPUs = ['i5', 'i7', 'i9', 'ryzen5', 'ryzen7', 'ryzen9'];
    return sufficientCPUs.includes(cpuClass.toLowerCase());
  }

  /**
   * Generate test mode indicator if in development
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
   * Generate system ID for support
   * @returns {string} System ID
   */
  generateSystemId() {
    const { app } = require('electron');
    const os = require('os');
    
    const hostname = os.hostname();
    const platform = os.platform();
    const timestamp = Date.now().toString(36);
    
    return `${platform}-${hostname}-${timestamp}`.toUpperCase();
  }

  /**
   * Create flow completion result
   * @param {string} outcome - Flow outcome
   * @param {boolean} canProceed - Whether app can proceed
   * @param {string} error - Error message if any
   * @returns {Object} Flow result
   */
  createFlowResult(outcome, canProceed, error = null) {
    return {
      outcome: outcome,
      canProceed: canProceed,
      userChoices: this.userChoices,
      error: error,
      timestamp: new Date().toISOString(),
      duration: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Cleanup timers and handlers
   */
  cleanup() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    // Remove any remaining IPC handlers
    const { ipcMain } = require('electron');
    try {
      ipcMain.removeHandler('hybrid-flow:alternative-choice');
      ipcMain.removeHandler('hybrid-flow:payment-choice');
      ipcMain.removeHandler('hybrid-flow:close-app');
    } catch (error) {
      // Handlers may not exist
    }

    this.logger?.info('HYBRID_FLOW', 'Hybrid flow cleanup completed');
  }
}

module.exports = { HybridModeFlow };