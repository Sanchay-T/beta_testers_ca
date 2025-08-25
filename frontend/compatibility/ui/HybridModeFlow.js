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
      <div class="modal-overlay">
        <div class="modal-container">
          <div class="modal-header">
            <div class="header-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#007bff" stroke-width="2" stroke-linejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="#007bff" stroke-width="2" stroke-linejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="#007bff" stroke-width="2" stroke-linejoin="round"/>
              </svg>
            </div>
            <h1>System Compatibility Assessment</h1>
            <p class="subtitle">Your system specifications require optimization for the best CypherEdge experience</p>
          </div>

          <div class="specs-card">
            <h3>Current System Specifications</h3>
            <div class="specs-list">
              <div class="spec-row ${ramTotal < 8 ? 'spec-below' : 'spec-good'}">
                <div class="spec-info">
                  <span class="spec-label">Memory (RAM)</span>
                  <span class="spec-value">${ramTotal} GB</span>
                </div>
                <span class="spec-status">${ramTotal < 8 ? 'Below recommended (8GB+)' : 'Good'}</span>
              </div>
              <div class="spec-row ${!this.isCPUSufficient(cpuClass) ? 'spec-below' : 'spec-good'}">
                <div class="spec-info">
                  <span class="spec-label">Processor (CPU)</span>
                  <span class="spec-value">${cpuClass.toUpperCase()}</span>
                </div>
                <span class="spec-status">${!this.isCPUSufficient(cpuClass) ? 'Below recommended (Intel i5+)' : 'Good'}</span>
              </div>
            </div>
          </div>

          <div class="decision-section">
            <h3>Choose Your Next Step</h3>
            <p class="decision-subtitle">We recommend using a more powerful system for optimal performance, or enable HYBRID mode for this device.</p>
            
            <div class="choice-grid">
              <button onclick="selectAlternativeChoice(true)" class="choice-card choice-recommended">
                <div class="choice-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                    <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2"/>
                    <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <div class="choice-content">
                  <h4>Use Another PC</h4>
                  <p>Switch to a more powerful system for the best experience</p>
                  <span class="choice-badge">Recommended</span>
                </div>
              </button>
              
              <button onclick="selectAlternativeChoice(false)" class="choice-card choice-hybrid">
                <div class="choice-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <div class="choice-content">
                  <h4>Enable HYBRID Mode</h4>
                  <p>Continue with cloud-assisted processing on this device</p>
                  <span class="choice-badge hybrid">Cloud Enhanced</span>
                </div>
              </button>
            </div>
          </div>

          ${this.getTestModeIndicator()}
        </div>
      </div>

      <style>
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          box-sizing: border-box;
        }

        .modal-container {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
          width: 100%;
          max-width: 700px;
          max-height: 90vh;
          overflow-y: auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .modal-header {
          text-align: center;
          padding: 40px 40px 30px;
          border-bottom: 1px solid #f1f5f9;
        }

        .header-icon {
          margin-bottom: 20px;
        }

        .modal-header h1 {
          margin: 0 0 12px 0;
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.2;
        }

        .subtitle {
          margin: 0;
          font-size: 16px;
          color: #64748b;
          line-height: 1.5;
        }

        .specs-card {
          margin: 0;
          padding: 30px 40px;
          border-bottom: 1px solid #f1f5f9;
        }

        .specs-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #334155;
        }

        .specs-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .spec-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .spec-row.spec-below {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .spec-row.spec-good {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .spec-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .spec-label {
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
        }

        .spec-value {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .spec-status {
          font-size: 14px;
          font-weight: 500;
        }

        .spec-below .spec-status {
          color: #dc2626;
        }

        .spec-good .spec-status {
          color: #16a34a;
        }

        .decision-section {
          padding: 30px 40px 40px;
        }

        .decision-section h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          text-align: center;
        }

        .decision-subtitle {
          margin: 0 0 30px 0;
          font-size: 16px;
          color: #64748b;
          text-align: center;
          line-height: 1.5;
        }

        .choice-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .choice-card {
          background: #ffffff;
          border: 2px solid #e2e8f0;
          border-radius: 16px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .choice-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
        }

        .choice-recommended {
          border-color: #22c55e;
        }

        .choice-recommended:hover {
          border-color: #16a34a;
          background: #f0fdf4;
        }

        .choice-hybrid {
          border-color: #007bff;
        }

        .choice-hybrid:hover {
          border-color: #0056b3;
          background: #eff6ff;
        }

        .choice-icon {
          margin-bottom: 16px;
          color: inherit;
        }

        .choice-recommended .choice-icon {
          color: #22c55e;
        }

        .choice-hybrid .choice-icon {
          color: #007bff;
        }

        .choice-content h4 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
        }

        .choice-content p {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: #64748b;
          line-height: 1.4;
        }

        .choice-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .choice-badge {
          background: #dcfce7;
          color: #166534;
        }

        .choice-badge.hybrid {
          background: #dbeafe;
          color: #1e40af;
        }

        .test-mode-indicator {
          position: absolute;
          top: 20px;
          right: 20px;
          background: #e3f2fd;
          color: #1976d2;
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid #2196f3;
          z-index: 1001;
        }

        @media (max-width: 768px) {
          .modal-container {
            margin: 10px;
          }
          
          .modal-header,
          .specs-card,
          .decision-section {
            padding-left: 24px;
            padding-right: 24px;
          }
          
          .choice-grid {
            grid-template-columns: 1fr;
          }
          
          .modal-header h1 {
            font-size: 24px;
          }
        }

        @media (max-width: 480px) {
          .modal-overlay {
            padding: 10px;
          }
          
          .modal-header,
          .specs-card,
          .decision-section {
            padding-left: 20px;
            padding-right: 20px;
          }
          
          .modal-header {
            padding-top: 30px;
            padding-bottom: 24px;
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
   * Show payment confirmation screen
   * @returns {Promise<boolean>} User choice (true = confirmed, false = cancelled)
   */
  async showPaymentConfirmation() {
    this.currentStep = 'payment_confirmation';
    
    const config = AppModeConfigManager.getConfig();
    const qrConfig = config.userExperience?.hybridModeFlow?.qrCode || {};

    const html = this.generatePaymentConfirmationHTML(qrConfig);

    return new Promise((resolve) => {
      // Send HTML to window
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('hybrid-flow:show-screen', {
          type: 'payment_confirmation',
          html: html
        });

        // Set up confirmation handlers
        this.setupPaymentConfirmationHandlers(resolve);
      } else {
        resolve(true);
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
      <div class="modal-overlay">
        <div class="modal-container payment-modal">
          <div class="modal-header">
            <div class="header-icon">
              <svg width=\"48\" height=\"48\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">
                <path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" stroke=\"#007bff\" stroke-width=\"2\"/>
              </svg>
            </div>
            <h1>HYBRID Mode Setup</h1>
            <p class=\"subtitle\">Enable cloud-assisted processing for optimal performance on your system</p>
          </div>

          <div class=\"features-section\">
            <h3>What You Get with HYBRID Mode</h3>
            <div class=\"features-grid\">
              <div class=\"feature-card\">
                <div class=\"feature-icon\">
                  <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">
                    <path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" stroke=\"#007bff\" stroke-width=\"2\"/>
                  </svg>
                </div>
                <h4>Cloud Processing</h4>
                <p>Heavy ML tasks processed in the cloud for faster results</p>
              </div>
              <div class=\"feature-card\">
                <div class=\"feature-icon\">
                  <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">
                    <path d=\"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"none\"/>
                  </svg>
                </div>
                <h4>Optimal Performance</h4>
                <p>Fast processing without straining your local system</p>
              </div>
              <div class=\"feature-card\">
                <div class=\"feature-icon\">
                  <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">
                    <rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" ry=\"2\" stroke=\"#f59e0b\" stroke-width=\"2\"/>
                    <circle cx=\"12\" cy=\"16\" r=\"1\" fill=\"#f59e0b\"/>
                    <path d=\"M7 11V7a5 5 0 0 1 10 0v4\" stroke=\"#f59e0b\" stroke-width=\"2\"/>
                  </svg>
                </div>
                <h4>Secure & Private</h4>
                <p>Enterprise-grade encryption for all cloud processing</p>
              </div>
            </div>
          </div>

          <div class=\"pricing-section\">
            <div class=\"price-card\">
              <div class=\"price-header\">
                <h3>HYBRID Mode License</h3>
                <div class=\"price-amount\">
                  <span class=\"currency\">₹</span>
                  <span class=\"amount\">2,499</span>
                  <span class=\"period\">one-time</span>
                </div>
              </div>
              <div class=\"price-features\">
                <div class=\"price-feature\">
                  <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">
                    <path d=\"m9 12 2 2 4-4\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>
                    <circle cx=\"12\" cy=\"12\" r=\"9\" stroke=\"#22c55e\" stroke-width=\"2\"/>
                  </svg>
                  <span>Lifetime HYBRID mode access</span>
                </div>
                <div class=\"price-feature\">
                  <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">
                    <path d=\"m9 12 2 2 4-4\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>
                    <circle cx=\"12\" cy=\"12\" r=\"9\" stroke=\"#22c55e\" stroke-width=\"2\"/>
                  </svg>
                  <span>Cloud-assisted ML processing</span>
                </div>
                <div class=\"price-feature\">
                  <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">
                    <path d=\"m9 12 2 2 4-4\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>
                    <circle cx=\"12\" cy=\"12\" r=\"9\" stroke=\"#22c55e\" stroke-width=\"2\"/>
                  </svg>
                  <span>Priority support & setup assistance</span>
                </div>
              </div>
            </div>
          </div>

          <div class=\"payment-section\">
            <h3>Complete Your Setup</h3>
            
            <div class=\"payment-steps\">
              <div class=\"step-card active\">
                <div class=\"step-number\">1</div>
                <div class=\"step-content\">
                  <h4>Scan QR Code to Pay</h4>
                  <div class=\"qr-container\">
                    <div class=\"qr-code-display\">
                      <div class=\"qr-code\">
                        <svg width=\"120\" height=\"120\" viewBox=\"0 0 120 120\" xmlns=\"http://www.w3.org/2000/svg\">
                          <rect width=\"120\" height=\"120\" fill=\"white\" stroke=\"#e2e8f0\" stroke-width=\"2\"/>
                          <!-- QR Code pattern simulation -->
                          <g fill=\"#1e293b\">
                            <rect x=\"8\" y=\"8\" width=\"4\" height=\"4\"/>
                            <rect x=\"12\" y=\"8\" width=\"4\" height=\"4\"/>
                            <rect x=\"20\" y=\"8\" width=\"4\" height=\"4\"/>
                            <rect x=\"8\" y=\"12\" width=\"4\" height=\"4\"/>
                            <rect x=\"20\" y=\"12\" width=\"4\" height=\"4\"/>
                            <rect x=\"8\" y=\"16\" width=\"4\" height=\"4\"/>
                            <rect x=\"12\" y=\"16\" width=\"4\" height=\"4\"/>
                            <rect x=\"16\" y=\"16\" width=\"4\" height=\"4\"/>
                            <rect x=\"20\" y=\"16\" width=\"4\" height=\"4\"/>
                            <!-- Pattern continues... simplified for display -->
                            <rect x=\"88\" y=\"8\" width=\"4\" height=\"4\"/>
                            <rect x=\"92\" y=\"8\" width=\"4\" height=\"4\"/>
                            <rect x=\"100\" y=\"8\" width=\"4\" height=\"4\"/>
                            <rect x=\"88\" y=\"12\" width=\"4\" height=\"4\"/>
                            <rect x=\"100\" y=\"12\" width=\"4\" height=\"4\"/>
                          </g>
                          <text x=\"60\" y=\"65\" text-anchor=\"middle\" font-size=\"8\" fill=\"#64748b\">Payment QR</text>
                        </svg>
                      </div>
                    </div>
                    <p class=\"payment-amount\">₹2,499</p>
                  </div>
                </div>
              </div>

              <div class=\"step-card\">
                <div class=\"step-number\">2</div>
                <div class=\"step-content\">
                  <h4>Mark Payment Complete</h4>
                  <p>After successful payment, click the button below to notify our team</p>
                </div>
              </div>

              <div class=\"step-card\">
                <div class=\"step-number\">3</div>
                <div class=\"step-content\">
                  <h4>Team Verification</h4>
                  <p>Our team will verify your payment and activate HYBRID mode within 2-4 hours</p>
                </div>
              </div>
            </div>

            <div class=\"system-info-card\">
              <h4>System Information</h4>
              <div class=\"system-details\">
                <div class=\"system-detail\">
                  <span class=\"detail-label\">System ID:</span>
                  <code class=\"system-id-code\">${this.generateSystemId()}</code>
                </div>
                <div class=\"system-detail\">
                  <span class=\"detail-label\">Support Contact:</span>
                  <span class=\"detail-value\">${qrConfig.supportContact || 'support@cyphersol.co.in'}</span>
                </div>
              </div>
              <p class=\"support-note\">Please save your System ID for support reference</p>
            </div>
          </div>

          <div class=\"modal-actions\">
            <button onclick=\"markAsPaid()\" class=\"btn-primary\">
              <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">
                <path d=\"m9 12 2 2 4-4\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>
                <circle cx=\"12\" cy=\"12\" r=\"9\" stroke=\"currentColor\" stroke-width=\"2\"/>
              </svg>
              <span>Mark Payment as Complete</span>
            </button>
            <button onclick=\"declinePayment()\" class=\"btn-secondary\">
              <span>Cancel & Exit</span>
            </button>
          </div>

          ${this.getTestModeIndicator()}
        </div>
      </div>

      <style>
        .payment-modal {
          max-width: 900px;
        }

        .features-section {
          padding: 0 40px 30px;
          border-bottom: 1px solid #f1f5f9;
        }

        .features-section h3 {
          margin: 0 0 24px 0;
          font-size: 18px;
          font-weight: 600;
          color: #334155;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .feature-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .feature-icon {
          margin-bottom: 16px;
        }

        .feature-card h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .feature-card p {
          margin: 0;
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
        }

        .pricing-section {
          padding: 30px 40px;
          border-bottom: 1px solid #f1f5f9;
        }

        .price-card {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 2px solid #007bff;
          border-radius: 16px;
          padding: 32px;
          text-align: center;
          max-width: 400px;
          margin: 0 auto;
        }

        .price-header h3 {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
        }

        .price-amount {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 4px;
          margin-bottom: 24px;
        }

        .currency {
          font-size: 24px;
          font-weight: 600;
          color: #007bff;
        }

        .amount {
          font-size: 48px;
          font-weight: 700;
          color: #007bff;
        }

        .period {
          font-size: 16px;
          color: #64748b;
        }

        .price-features {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .price-feature {
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
        }

        .price-feature span {
          font-size: 14px;
          color: #334155;
        }

        .payment-section {
          padding: 30px 40px 40px;
        }

        .payment-section h3 {
          margin: 0 0 24px 0;
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          text-align: center;
        }

        .payment-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .step-card {
          background: #ffffff;
          border: 2px solid #e2e8f0;
          border-radius: 16px;
          padding: 24px;
          position: relative;
          transition: all 0.3s ease;
        }

        .step-card.active {
          border-color: #007bff;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        }

        .step-number {
          position: absolute;
          top: -12px;
          left: 20px;
          width: 32px;
          height: 32px;
          background: #007bff;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
        }

        .step-content {
          padding-top: 12px;
        }

        .step-content h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .step-content p {
          margin: 0;
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
        }

        .qr-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin-top: 16px;
        }

        .qr-code-display {
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .payment-amount {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #007bff;
        }

        .system-info-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
        }

        .system-info-card h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #334155;
        }

        .system-details {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .system-detail {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .detail-label {
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
        }

        .system-id-code {
          background: #e2e8f0;
          color: #1e293b;
          padding: 4px 8px;
          border-radius: 6px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 14px;
          font-weight: 600;
        }

        .detail-value {
          font-size: 14px;
          color: #334155;
        }

        .support-note {
          margin: 0;
          font-size: 12px;
          color: #64748b;
          font-style: italic;
        }

        .modal-actions {
          padding: 0 40px 40px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }

        .btn-primary {
          background: #007bff;
          color: white;
          border: none;
          padding: 16px 32px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 280px;
          justify-content: center;
        }

        .btn-primary:hover {
          background: #0056b3;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 123, 255, 0.3);
        }

        .btn-secondary {
          background: transparent;
          color: #64748b;
          border: 2px solid #e2e8f0;
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-secondary:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
          color: #475569;
        }

        @media (max-width: 768px) {
          .features-section,
          .pricing-section,
          .payment-section,
          .modal-actions {
            padding-left: 24px;
            padding-right: 24px;
          }
          
          .features-grid {
            grid-template-columns: 1fr;
          }
          
          .payment-steps {
            grid-template-columns: 1fr;
          }
          
          .system-detail {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }

        @media (max-width: 480px) {
          .features-section,
          .pricing-section,
          .payment-section,
          .modal-actions {
            padding-left: 20px;
            padding-right: 20px;
          }
          
          .price-card {
            padding: 24px;
          }
          
          .amount {
            font-size: 40px;
          }
        }
      </style>

      <script>
        function markAsPaid() {
          window.electronAPI.invoke('hybrid-flow:payment-completed');
        }

        function declinePayment() {
          window.electronAPI.invoke('hybrid-flow:payment-choice', false);
        }
      </script>
    `;
  }

  /**
   * Generate payment confirmation HTML
   * @param {Object} qrConfig - QR code configuration
   * @returns {string} HTML content
   */
  generatePaymentConfirmationHTML(qrConfig) {
    return `
      <div class="modal-overlay">
        <div class="modal-container confirmation-modal">
          <div class="confirmation-header">
            <div class="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="m9 12 2 2 4-4" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="9" stroke="#22c55e" stroke-width="2"/>
              </svg>
            </div>
            <h1>Payment Notification Sent</h1>
            <p class="confirmation-subtitle">Thank you! Our team has been notified of your payment completion.</p>
          </div>

          <div class="confirmation-content">
            <div class="next-steps-card">
              <h3>What Happens Next?</h3>
              <div class="steps-timeline">
                <div class="timeline-step completed">
                  <div class="step-indicator">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </div>
                  <div class="step-details">
                    <h4>Payment Completed</h4>
                    <p>You have successfully completed the payment process</p>
                  </div>
                </div>

                <div class="timeline-step current">
                  <div class="step-indicator">
                    <div class="step-number">2</div>
                  </div>
                  <div class="step-details">
                    <h4>Team Verification</h4>
                    <p>Our team will verify your payment and transaction details</p>
                    <span class="eta">ETA: 2-4 hours</span>
                  </div>
                </div>

                <div class="timeline-step">
                  <div class="step-indicator">
                    <div class="step-number">3</div>
                  </div>
                  <div class="step-details">
                    <h4>HYBRID Mode Activation</h4>
                    <p>We'll activate HYBRID mode for your system and send confirmation</p>
                    <span class="eta">Within 24 hours</span>
                  </div>
                </div>

                <div class="timeline-step">
                  <div class="step-indicator">
                    <div class="step-number">4</div>
                  </div>
                  <div class="step-details">
                    <h4>Setup Complete</h4>
                    <p>You'll receive access credentials and can start using CypherEdge</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="contact-support-card">
              <h3>Need Assistance?</h3>
              <p>If you have any questions or concerns, our support team is here to help.</p>
              
              <div class="contact-methods">
                <div class="contact-method">
                  <div class="contact-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#007bff" stroke-width="2"/>
                      <polyline points="22,6 12,13 2,6" stroke="#007bff" stroke-width="2"/>
                    </svg>
                  </div>
                  <div class="contact-details">
                    <span class="contact-label">Email Support</span>
                    <span class="contact-value">${qrConfig.supportContact || 'support@cyphersol.co.in'}</span>
                  </div>
                </div>

                <div class="contact-method">
                  <div class="contact-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="#22c55e" stroke-width="2"/>
                    </svg>
                  </div>
                  <div class="contact-details">
                    <span class="contact-label">Phone Support</span>
                    <span class="contact-value">${qrConfig.supportPhone || '+91-9876-543-210'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="system-reference-card">
              <h3>Your Reference Information</h3>
              <div class="reference-details">
                <div class="reference-item">
                  <span class="ref-label">System ID:</span>
                  <code class="ref-value">${this.generateSystemId()}</code>
                </div>
                <div class="reference-item">
                  <span class="ref-label">Request Time:</span>
                  <span class="ref-value">${new Date().toLocaleString()}</span>
                </div>
              </div>
              <p class="reference-note">Please save this information for future reference and support communications.</p>
            </div>
          </div>

          <div class="confirmation-actions">
            <button onclick="proceedToApp()" class="btn-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Continue to CypherEdge</span>
            </button>
            <button onclick="closeApplication()" class="btn-secondary">
              <span>Close Application</span>
            </button>
          </div>

          ${this.getTestModeIndicator()}
        </div>
      </div>

      <style>
        .confirmation-modal {
          max-width: 700px;
        }

        .confirmation-header {
          text-align: center;
          padding: 40px 40px 30px;
          border-bottom: 1px solid #f1f5f9;
        }

        .success-icon {
          margin-bottom: 20px;
        }

        .confirmation-header h1 {
          margin: 0 0 12px 0;
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
        }

        .confirmation-subtitle {
          margin: 0;
          font-size: 16px;
          color: #64748b;
          line-height: 1.5;
        }

        .confirmation-content {
          padding: 30px 40px 40px;
        }

        .next-steps-card,
        .contact-support-card,
        .system-reference-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .next-steps-card h3,
        .contact-support-card h3,
        .system-reference-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
        }

        .steps-timeline {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .timeline-step {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          opacity: 0.6;
        }

        .timeline-step.completed,
        .timeline-step.current {
          opacity: 1;
        }

        .step-indicator {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .timeline-step.completed .step-indicator {
          background: #22c55e;
          color: white;
        }

        .timeline-step.current .step-indicator {
          background: #007bff;
          color: white;
        }

        .timeline-step .step-indicator {
          background: #f1f5f9;
          border: 2px solid #e2e8f0;
          color: #64748b;
        }

        .step-number {
          font-weight: 600;
          font-size: 14px;
        }

        .step-details h4 {
          margin: 0 0 6px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .step-details p {
          margin: 0 0 4px 0;
          font-size: 14px;
          color: #64748b;
          line-height: 1.4;
        }

        .eta {
          font-size: 12px;
          color: #007bff;
          font-weight: 500;
        }

        .contact-methods {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 16px;
        }

        .contact-method {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 12px;
        }

        .contact-icon {
          flex-shrink: 0;
        }

        .contact-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .contact-label {
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
        }

        .contact-value {
          font-size: 14px;
          color: #1e293b;
          font-weight: 500;
        }

        .reference-details {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .reference-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ref-label {
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
        }

        .ref-value {
          font-size: 14px;
          color: #1e293b;
        }

        .ref-value code {
          background: #e2e8f0;
          color: #1e293b;
          padding: 4px 8px;
          border-radius: 6px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-weight: 600;
        }

        .reference-note {
          margin: 0;
          font-size: 12px;
          color: #64748b;
          font-style: italic;
        }

        .confirmation-actions {
          padding: 0 40px 40px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }

        @media (max-width: 768px) {
          .confirmation-header,
          .confirmation-content,
          .confirmation-actions {
            padding-left: 24px;
            padding-right: 24px;
          }
          
          .reference-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }

        @media (max-width: 480px) {
          .confirmation-header,
          .confirmation-content,
          .confirmation-actions {
            padding-left: 20px;
            padding-right: 20px;
          }
        }
      </style>

      <script>
        function proceedToApp() {
          window.electronAPI.invoke('hybrid-flow:proceed-to-app');
        }

        function closeApplication() {
          window.electronAPI.invoke('hybrid-flow:close-app');
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

    const paymentHandler = (event, agreedToPay) => {
      ipcMain.removeHandler('hybrid-flow:payment-choice');
      ipcMain.removeHandler('hybrid-flow:payment-completed');
      this.logger?.info('HYBRID_FLOW', 'Payment choice received', { agreedToPay });
      resolve(agreedToPay);
    };

    const completedHandler = async (event) => {
      ipcMain.removeHandler('hybrid-flow:payment-choice');
      ipcMain.removeHandler('hybrid-flow:payment-completed');
      this.logger?.info('HYBRID_FLOW', 'Payment marked as completed, showing confirmation');
      
      // Show payment confirmation screen
      try {
        const confirmed = await this.showPaymentConfirmation();
        resolve(confirmed);
      } catch (error) {
        this.logger?.error('HYBRID_FLOW', 'Payment confirmation failed', { error: error.message });
        resolve(true); // Default to proceeding
      }
    };

    ipcMain.handle('hybrid-flow:payment-choice', paymentHandler);
    ipcMain.handle('hybrid-flow:payment-completed', completedHandler);

    // Also handle app close
    ipcMain.handle('hybrid-flow:close-app', () => {
      const { app } = require('electron');
      app.quit();
    });
  }

  /**
   * Setup IPC handlers for payment confirmation screen
   * @param {Function} resolve - Promise resolve function
   */
  setupPaymentConfirmationHandlers(resolve) {
    const { ipcMain } = require('electron');

    const proceedHandler = (event) => {
      ipcMain.removeHandler('hybrid-flow:proceed-to-app');
      ipcMain.removeHandler('hybrid-flow:close-app');
      this.logger?.info('HYBRID_FLOW', 'User chose to proceed to app');
      resolve(true);
    };

    const closeHandler = (event) => {
      ipcMain.removeHandler('hybrid-flow:proceed-to-app');
      ipcMain.removeHandler('hybrid-flow:close-app');
      this.logger?.info('HYBRID_FLOW', 'User chose to close application');
      
      // Close application
      const { app } = require('electron');
      app.quit();
    };

    ipcMain.handle('hybrid-flow:proceed-to-app', proceedHandler);
    ipcMain.handle('hybrid-flow:close-app', closeHandler);
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
      ipcMain.removeHandler('hybrid-flow:payment-completed');
      ipcMain.removeHandler('hybrid-flow:proceed-to-app');
      ipcMain.removeHandler('hybrid-flow:close-app');
    } catch (error) {
      // Handlers may not exist
    }

    this.logger?.info('HYBRID_FLOW', 'Hybrid flow cleanup completed');
  }
}

module.exports = { HybridModeFlow };