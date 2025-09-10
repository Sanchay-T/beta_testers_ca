// EmailAuditService.js
// Comprehensive email audit service using Resend API
// Sends detailed compatibility reports after system checks complete

const { Resend } = require('resend');
const os = require('os');
const { app } = require('electron');

class EmailAuditService {
  constructor(logger = null) {
    this.logger = logger;
    this.resend = new Resend('re_5dNYsJy1_7fw9DaDPMWcdFHNCNxyB31od');
    this.fromEmail = 'Cyphersol <help@help.cyphersol.in>';
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Send comprehensive compatibility audit email
   * @param {Object} auditData - Complete audit data
   * @returns {Promise<Object>} Send result
   */
  async sendCompatibilityAudit(auditData) {
    console.log('📧 === EMAIL AUDIT SERVICE TRIGGERED ===');
    console.log('📧 Timestamp:', new Date().toISOString());
    console.log('📧 Primary recipient:', auditData.userEmail);
    console.log('📧 CC recipient: thalnerkarsanchay17@gmail.com');
    
    // 🔍 DETAILED AUDIT DATA VERIFICATION IN EMAIL SERVICE
    console.log('📧 🔍 === EMAIL SERVICE DATA VERIFICATION ===');
    console.log('📧 🔍 Audit data keys received:', Object.keys(auditData));
    console.log('📧 🔍 Mode Detection Data:', auditData.modeDetection);
    console.log('📧 🔍 Performance Metrics Data:', auditData.performanceMetrics);
    console.log('📧 🔍 Compatibility Results Data:', !!auditData.compatibilityResults);
    console.log('📧 🔍 System Info Data:', !!auditData.systemInfo);
    console.log('📧 🔍 Enhanced Report Data:', !!auditData.enhancedReportData);
    
    if (auditData.modeDetection) {
      console.log('📧 🎯 Mode Detection Details in Email Service:');
      console.log('📧 🎯 - Determined Mode:', auditData.modeDetection.determinedMode);
      console.log('📧 🎯 - Confidence:', auditData.modeDetection.confidence);
      console.log('📧 🎯 - Can Proceed:', auditData.modeDetection.canProceed);
      console.log('📧 🎯 - User Message:', auditData.modeDetection.userMessage);
    } else {
      console.log('📧 🎯 ❌ NO MODE DETECTION DATA in Email Service');
    }
    
    if (auditData.performanceMetrics) {
      console.log('📧 ⚡ Performance Metrics Details in Email Service:');
      console.log('📧 ⚡ - Session Duration:', auditData.performanceMetrics.session?.totalDuration);
      console.log('📧 ⚡ - Success Rate:', auditData.performanceMetrics.testing?.successRate);
      console.log('📧 ⚡ - Memory Usage:', auditData.performanceMetrics.system?.memoryUsage);
    } else {
      console.log('📧 ⚡ ❌ NO PERFORMANCE METRICS DATA in Email Service');
    }
    
    this.logger?.info('EMAIL_AUDIT', '=== STARTING EMAIL AUDIT SEND ===');
    this.logger?.info('EMAIL_AUDIT', 'Recipients:', [auditData.userEmail, 'thalnerkarsanchay17@gmail.com']);
    this.logger?.info('EMAIL_AUDIT', 'Mode detected:', auditData.modeDetection?.determinedMode);

    try {
      console.log('📧 [1/4] Validating audit data...');
      // Validate required data
      this.validateAuditData(auditData);

      console.log('📧 [2/4] Generating email content...');
      // Generate email content
      const emailContent = this.generateEmailContent(auditData);
      
      console.log('📧 [3/4] Sending email via Resend API...');
      console.log('📧 Email subject:', emailContent.subject);
      console.log('📧 Recipients:', emailContent.to);
      
      // Send email with retry logic
      const result = await this.sendWithRetry(emailContent);
      
      console.log('📧 [4/4] Email sent successfully!');
      console.log('📧 ✅ Resend Email ID:', result.data?.id);
      console.log('📧 ✅ Response:', JSON.stringify(result.data, null, 2));
      
      this.logger?.info('EMAIL_AUDIT', '✅ Email sent successfully');
      this.logger?.info('EMAIL_AUDIT', 'Email ID:', result.data?.id);
      this.logger?.info('EMAIL_AUDIT', 'Recipients confirmed:', emailContent.to);
      
      return {
        success: true,
        emailId: result.data?.id,
        recipients: emailContent.to,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('📧 ❌ EMAIL SEND FAILED:', error.message);
      console.error('📧 ❌ Error details:', error);
      
      this.logger?.error('EMAIL_AUDIT', '❌ Email send failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate audit data completeness
   * @param {Object} auditData - Audit data to validate
   */
  validateAuditData(auditData) {
    if (!auditData.userEmail) {
      throw new Error('User email is required');
    }

    if (!auditData.systemInfo) {
      throw new Error('System information is required');
    }

    if (!auditData.compatibilityResults) {
      throw new Error('Compatibility results are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(auditData.userEmail)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Generate complete email content
   * @param {Object} auditData - Audit data
   * @returns {Object} Email content structure
   */
  generateEmailContent(auditData) {
    const timestamp = new Date().toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'medium'
    });

    const subject = `CypherEdge Compatibility Report - ${auditData.userEmail} - ${new Date().toLocaleDateString('en-IN')}`;
    
    const htmlContent = this.generateHTMLReport(auditData, timestamp);
    
    return {
      from: this.fromEmail,
      to: [auditData.userEmail, 'thalnerkarsanchay17@gmail.com'],
      subject: subject,
      html: htmlContent
    };
  }

  /**
   * Generate professional HTML email report
   * @param {Object} auditData - Complete audit data
   * @param {string} timestamp - Formatted timestamp
   * @returns {string} HTML email content
   */
  generateHTMLReport(auditData, timestamp) {
    const {
      userEmail,
      systemInfo,
      compatibilityResults,
      modeDetection,
      appVersion,
      electronVersion,
      userJourney,
      performanceMetrics
    } = auditData;

    // Determine mode color and icon
    const modeConfig = this.getModeDisplayConfig(modeDetection?.determinedMode);
    
    // Calculate compatibility score
    const compatScore = this.calculateCompatibilityScore(compatibilityResults);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CypherEdge Compatibility Report</title>
    <style>
        ${this.getEmailCSS()}
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <div class="logo-section">
                <div class="logo">
                    <div class="logo-circle">C</div>
                    <div class="logo-text">
                        <h1>CypherEdge</h1>
                        <p>System Compatibility Report</p>
                    </div>
                </div>
            </div>
            <div class="report-meta">
                <p><strong>Generated:</strong> ${timestamp}</p>
                <p><strong>User:</strong> ${userEmail}</p>
                <p><strong>Report ID:</strong> ${this.generateReportId()}</p>
            </div>
        </div>

        <!-- Executive Summary -->
        <div class="section summary-section">
            <h2>📋 Executive Summary</h2>
            <div class="summary-grid">
                <div class="summary-card ${modeConfig.className}">
                    <div class="summary-icon">${modeConfig.icon}</div>
                    <div class="summary-content">
                        <h3>Detected Mode</h3>
                        <p class="summary-value">${modeDetection?.determinedMode || 'Unknown'}</p>
                        <p class="summary-desc">${modeConfig.description}</p>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="summary-icon">📊</div>
                    <div class="summary-content">
                        <h3>Compatibility Score</h3>
                        <p class="summary-value">${compatScore}%</p>
                        <p class="summary-desc">${this.getScoreDescription(compatScore)}</p>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="summary-icon">⚡</div>
                    <div class="summary-content">
                        <h3>Performance</h3>
                        <p class="summary-value">${performanceMetrics?.session?.totalDuration || performanceMetrics?.totalDuration || 'N/A'}</p>
                        <p class="summary-desc">Total check time</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- System Information -->
        <div class="section">
            <h2>💻 System Information</h2>
            <div class="info-grid">
                <div class="info-row">
                    <span class="info-label">Operating System:</span>
                    <span class="info-value">${systemInfo?.platform || os.platform()} ${systemInfo?.release || os.release()}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Memory (RAM):</span>
                    <span class="info-value">${systemInfo?.totalMemory || Math.round(os.totalmem() / (1024**3))} GB</span>
                </div>
                <div class="info-row">
                    <span class="info-label">CPU:</span>
                    <span class="info-value">${systemInfo?.cpu || os.cpus()[0]?.model || 'Unknown'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">CPU Cores:</span>
                    <span class="info-value">${systemInfo?.cpuCores || os.cpus().length}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Architecture:</span>
                    <span class="info-value">${systemInfo?.arch || os.arch()}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Hostname:</span>
                    <span class="info-value">${systemInfo?.hostname || os.hostname()}</span>
                </div>
            </div>
        </div>

        <!-- Application Information -->
        <div class="section">
            <h2>🚀 Application Information</h2>
            <div class="info-grid">
                <div class="info-row">
                    <span class="info-label">CypherEdge Version:</span>
                    <span class="info-value">${appVersion || '2.0.100'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Electron Version:</span>
                    <span class="info-value">${electronVersion || app?.getVersion() || 'Unknown'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Node.js Version:</span>
                    <span class="info-value">${process.version}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Environment:</span>
                    <span class="info-value">${process.env.NODE_ENV || 'production'}</span>
                </div>
            </div>
        </div>

        <!-- Compatibility Test Results -->
        <div class="section">
            <h2>🔧 Compatibility Test Results</h2>
            ${this.generateCompatibilityResultsHTML(compatibilityResults)}
        </div>

        <!-- Mode Detection Analysis -->
        <div class="section">
            <h2>🎯 Mode Detection Analysis</h2>
            <div class="analysis-content">
                <div class="mode-result ${modeConfig.className}">
                    <div class="mode-header">
                        <span class="mode-icon">${modeConfig.icon}</span>
                        <div>
                            <h3>${modeDetection?.determinedMode || 'Unknown'} Mode</h3>
                            <p>Confidence: ${modeDetection?.confidence || 'Unknown'}</p>
                        </div>
                    </div>
                    <div class="mode-reason">
                        <strong>Reason:</strong> ${modeDetection?.reason || 'No reason provided'}
                    </div>
                </div>
                
                ${this.generateHardwareAnalysisHTML(modeDetection?.analysis)}
            </div>
        </div>

        <!-- User Journey -->
        ${userJourney ? this.generateUserJourneyHTML(userJourney) : ''}

        <!-- JSON Report Data -->
        <div class="section json-section">
            <h2>📄 Complete JSON Report</h2>
            <div class="json-container">
                <pre><code>${JSON.stringify(auditData, null, 2)}</code></pre>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-content">
                <p><strong>CypherEdge Support</strong></p>
                <p>📧 Email: support@cyphersol.co.in</p>
                <p>🌐 Website: https://cyphersol.co.in</p>
                <p class="footer-note">This automated report was generated by CypherEdge Compatibility Checker v2.0</p>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get email CSS styles
   * @returns {string} CSS styles
   */
  getEmailCSS() {
    return `
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8fafc;
        }

        .email-container {
            max-width: 800px;
            margin: 20px auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #0056b3 0%, #007bff 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .logo {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
        }

        .logo-circle {
            width: 60px;
            height: 60px;
            background: white;
            color: #0056b3;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            margin-right: 15px;
        }

        .logo-text h1 {
            font-size: 28px;
            margin: 0;
        }

        .logo-text p {
            font-size: 14px;
            opacity: 0.9;
            margin: 0;
        }

        .report-meta {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 15px;
            font-size: 14px;
        }

        .section {
            padding: 30px;
            border-bottom: 1px solid #e5e7eb;
        }

        .section:last-child {
            border-bottom: none;
        }

        .section h2 {
            color: #1f2937;
            margin-bottom: 20px;
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .summary-section {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }

        .summary-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .summary-card.scan {
            border-left: 4px solid #22c55e;
        }

        .summary-card.unscan {
            border-left: 4px solid #f59e0b;
        }

        .summary-card.hybrid {
            border-left: 4px solid #dc2626;
        }

        .summary-icon {
            font-size: 24px;
            margin-bottom: 10px;
        }

        .summary-content h3 {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 5px;
        }

        .summary-value {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin: 0 0 8px 0;
        }

        .summary-desc {
            font-size: 12px;
            color: #6b7280;
            margin: 0;
        }

        .info-grid {
            display: grid;
            gap: 12px;
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #f3f4f6;
        }

        .info-label {
            font-weight: 500;
            color: #374151;
        }

        .info-value {
            color: #1f2937;
            font-weight: 600;
        }

        .test-results {
            display: grid;
            gap: 15px;
        }

        .test-suite {
            background: #f9fafb;
            border-radius: 8px;
            padding: 20px;
        }

        .test-suite h3 {
            color: #374151;
            margin-bottom: 15px;
            font-size: 16px;
        }

        .test-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 10px;
        }

        .test-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: white;
            border-radius: 6px;
            font-size: 14px;
        }

        .test-status {
            font-size: 12px;
        }

        .test-status.pass {
            color: #22c55e;
        }

        .test-status.fail {
            color: #dc2626;
        }

        .test-status.warn {
            color: #f59e0b;
        }

        .mode-result {
            background: #f9fafb;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .mode-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
        }

        .mode-icon {
            font-size: 32px;
        }

        .mode-reason {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.5;
        }

        .json-section {
            background: #f9fafb;
        }

        .json-container {
            background: #1f2937;
            border-radius: 8px;
            padding: 20px;
            overflow-x: auto;
            max-height: 400px;
            overflow-y: auto;
        }

        .json-container pre {
            color: #e5e7eb;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
        }

        .footer {
            background: #1f2937;
            color: white;
            text-align: center;
            padding: 30px;
        }

        .footer-content {
            max-width: 400px;
            margin: 0 auto;
        }

        .footer-note {
            font-size: 12px;
            opacity: 0.7;
            margin-top: 15px;
        }

        @media (max-width: 600px) {
            .email-container {
                margin: 10px;
                border-radius: 8px;
            }

            .section {
                padding: 20px;
            }

            .summary-grid {
                grid-template-columns: 1fr;
            }

            .info-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
            }
        }
    `;
  }

  /**
   * Get mode display configuration
   * @param {string} mode - Detected mode
   * @returns {Object} Mode display config
   */
  getModeDisplayConfig(mode) {
    const configs = {
      'SCAN': {
        icon: '🚀',
        className: 'scan',
        description: 'High-performance system with full capabilities'
      },
      'UNSCAN': {
        icon: '⚡',
        className: 'unscan', 
        description: 'Mid-range system with limited scanning'
      },
      'HYBRID': {
        icon: '☁️',
        className: 'hybrid',
        description: 'Low-spec system requiring cloud processing'
      }
    };

    return configs[mode] || {
      icon: '❓',
      className: 'unknown',
      description: 'Unknown system configuration'
    };
  }

  /**
   * Calculate compatibility score
   * @param {Object} results - Compatibility results
   * @returns {number} Score percentage
   */
  calculateCompatibilityScore(results) {
    if (!results || !results.testSuites) return 0;
    
    let totalTests = 0;
    let passedTests = 0;
    
    results.testSuites.forEach(suite => {
      if (suite.tests) {
        suite.tests.forEach(test => {
          totalTests++;
          if (test.result === 'success' || test.result === 'pass') {
            passedTests++;
          }
        });
      }
    });
    
    return totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  }

  /**
   * Get score description
   * @param {number} score - Compatibility score
   * @returns {string} Description
   */
  getScoreDescription(score) {
    if (score >= 90) return 'Excellent compatibility';
    if (score >= 75) return 'Good compatibility';
    if (score >= 60) return 'Acceptable compatibility';
    return 'Compatibility issues detected';
  }

  /**
   * Generate compatibility results HTML
   * @param {Object} results - Compatibility results
   * @returns {string} HTML content
   */
  generateCompatibilityResultsHTML(results) {
    if (!results || !results.testSuites) {
      return '<p>No compatibility results available.</p>';
    }

    let html = '<div class="test-results">';
    
    results.testSuites.forEach(suite => {
      html += `
        <div class="test-suite">
          <h3>${suite.name} (${suite.tests?.length || 0} tests)</h3>
          <div class="test-grid">
      `;
      
      if (suite.tests) {
        suite.tests.forEach(test => {
          const statusClass = test.result === 'success' || test.result === 'pass' ? 'pass' : 
                             test.result === 'warning' ? 'warn' : 'fail';
          const statusIcon = statusClass === 'pass' ? '✅' : 
                           statusClass === 'warn' ? '⚠️' : '❌';
          
          html += `
            <div class="test-item">
              <span class="test-status ${statusClass}">${statusIcon}</span>
              <span>${test.name}</span>
            </div>
          `;
        });
      }
      
      html += '</div></div>';
    });
    
    html += '</div>';
    return html;
  }

  /**
   * Generate hardware analysis HTML
   * @param {Object} analysis - Hardware analysis data
   * @returns {string} HTML content
   */
  generateHardwareAnalysisHTML(analysis) {
    if (!analysis || !analysis.hardware) {
      return '';
    }

    const hardware = analysis.hardware;
    
    return `
      <div class="hardware-analysis">
        <h4>Hardware Analysis</h4>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Meets Requirements:</span>
            <span class="info-value ${hardware.meetsFullModeRequirements ? 'pass' : 'fail'}">
              ${hardware.meetsFullModeRequirements ? '✅ Yes' : '❌ No'}
            </span>
          </div>
          ${hardware.ram ? `
            <div class="info-row">
              <span class="info-label">RAM Check:</span>
              <span class="info-value">${hardware.ram.actual}GB (Required: ${hardware.ram.required}GB)</span>
            </div>
          ` : ''}
          ${hardware.cpu ? `
            <div class="info-row">
              <span class="info-label">CPU Check:</span>
              <span class="info-value">${hardware.cpu.actual} (Required: ${hardware.cpu.required}+)</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Generate user journey HTML
   * @param {Array} journey - User journey data
   * @returns {string} HTML content
   */
  generateUserJourneyHTML(journey) {
    if (!journey || !Array.isArray(journey) || journey.length === 0) {
      return '';
    }

    let html = `
      <div class="section">
        <h2>👤 User Journey</h2>
        <div class="journey-timeline">
    `;

    journey.forEach((event, index) => {
      html += `
        <div class="journey-event">
          <div class="journey-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
          <div class="journey-action">${event.action}</div>
          ${event.details ? `<div class="journey-details">${event.details}</div>` : ''}
        </div>
      `;
    });

    html += '</div></div>';
    return html;
  }

  /**
   * Send email with retry logic
   * @param {Object} emailContent - Email content
   * @returns {Promise<Object>} Send result
   */
  async sendWithRetry(emailContent) {
    let lastError;
    
    console.log('📧 🔄 Starting retry logic with', this.retryAttempts, 'attempts');
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`📧 🔄 Attempt ${attempt}/${this.retryAttempts} - Calling Resend API...`);
        this.logger?.info('EMAIL_AUDIT', `Send attempt ${attempt}/${this.retryAttempts}`);
        
        const result = await this.resend.emails.send(emailContent);
        
        console.log('📧 📡 Resend API response received:', {
          hasData: !!result.data,
          hasError: !!result.error,
          dataKeys: result.data ? Object.keys(result.data) : [],
          errorMessage: result.error?.message
        });
        
        if (result.error) {
          throw new Error(result.error.message || 'Email send failed');
        }
        
        console.log(`📧 ✅ Attempt ${attempt} successful! Email ID:`, result.data?.id);
        return result;
        
      } catch (error) {
        lastError = error;
        console.error(`📧 ❌ Attempt ${attempt} failed:`, error.message);
        this.logger?.error('EMAIL_AUDIT', `Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.retryAttempts) {
          const delayMs = this.retryDelay * attempt;
          console.log(`📧 ⏳ Waiting ${delayMs}ms before retry...`);
          await this.delay(delayMs);
        }
      }
    }
    
    console.error('📧 💥 All retry attempts exhausted. Final error:', lastError?.message);
    throw lastError;
  }

  /**
   * Generate unique report ID
   * @returns {string} Report ID
   */
  generateReportId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `CYP-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Delay helper function
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { EmailAuditService };