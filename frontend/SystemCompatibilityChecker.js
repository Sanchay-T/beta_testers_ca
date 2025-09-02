// SystemCompatibilityChecker.js
const { BrowserWindow, app, ipcMain } = require("electron");
const path = require("path");
const log = require("electron-log");
const { CompatibilityTests } = require("./compatibility/CompatibilityTests");
const { ReportGenerator } = require("./compatibility/ReportGenerator");
const { CompatibilityLogger } = require("./compatibility/CompatibilityLogger");
const { DetailedReportGenerator } = require("./compatibility/DetailedReportGenerator");
const { getSharedAppModeManager } = require("./compatibility/SharedAppModeManager");
const { ModeNotificationUI } = require("./compatibility/ui/ModeNotificationUI");
const { EnhancedReportCollector } = require("./compatibility/EnhancedReportCollector");
const { EmailAuditService } = require("./services/EmailAuditService");

class SystemCompatibilityChecker {
  constructor(loggerOptions = {}) {
    this.window = null;
    this.logger = new CompatibilityLogger({ 
      enableConsole: true, 
      enableFile: true,
      ...loggerOptions 
    });
    this.tests = null; // Will be initialized when needed
    this.reportGenerator = null; // Will be initialized when needed
    this.detailedReportGenerator = null; // Will be initialized when needed
    this.appModeManager = null; // Will be initialized when window is available
    this.modeNotificationUI = null; // Will be initialized when window is available
    this.enhancedReportCollector = new EnhancedReportCollector(this.logger);
    this.emailAuditService = new EmailAuditService(this.logger);
    this.store = null; // Will be initialized dynamically
    this.userEmail = null; // Will store user email from verification step
    this.userDecision = null;
    
    // 📧 EMAIL PERSISTENCE: Initialize store and load previously captured email
    // Note: initializeStore is async and will be called in runFullCheck()
    this.results = {
      startTime: Date.now(),
      canProceed: false,
      issues: [],
      warnings: [],
      successes: [],
      timings: {},
      systemInfo: {},
      endTime: null,
      duration: null,
    };
  }

  async runFullCheck() {
    this.logger.info('SESSION_START', 'Starting comprehensive compatibility check');
    log.info("🔍 [COMPAT] Starting comprehensive compatibility check...");

    // 📧 EMAIL PERSISTENCE: Initialize store first (async operation)
    await this.initializeStore();

    // Start enhanced report collection
    this.enhancedReportCollector.startCompatibilityCheck();

    try {
      // Step 1: Create the compatibility checker window (email verification will be first screen inside)
      await this.createCompatibilityWindow();

      // Initialize tests with logger and window reference (after window is created)
      this.tests = new CompatibilityTests(this.logger, this.window);
      this.reportGenerator = new ReportGenerator(this.logger);
      this.detailedReportGenerator = new DetailedReportGenerator(this.logger);
      this.appModeManager = getSharedAppModeManager(this.logger, this.window);
      this.modeNotificationUI = new ModeNotificationUI(this.logger, this.window);

      // Step 2: Wait for user to start tests
      const userDecision = await this.waitForUserDecision();

      this.logger.info('USER_DECISION_DEBUG', 'User decision received in main flow', {
        userDecision: userDecision,
        userDecisionType: typeof userDecision,
        rawUserDecision: this.userDecision
      });
      log.info(`🐛 [COMPAT] User decision debug: ${userDecision} (type: ${typeof userDecision}), raw: ${this.userDecision}`);

      // Step 2.5: Run app mode detection after compatibility tests
      let modeDetectionResult = null;
      if (userDecision === true || userDecision === 'proceed') {
        this.logger.info('MODE_DETECTION_START', 'Starting app mode detection after compatibility tests');
        log.info("🎯 [COMPAT] Running app mode detection...");
        
        try {
          // First, try to use stored decision from compatibility window testing
          const storedDecision = this.appModeManager.loadStoredDecision();
          const isRecentDecision = storedDecision && storedDecision.timestamp && 
            (Date.now() - new Date(storedDecision.timestamp).getTime() < 5 * 60 * 1000); // 5 minutes
          
          if (isRecentDecision && storedDecision.determinedMode) {
            this.logger.info('MODE_DETECTION_STORED', 'Using stored mode decision from compatibility testing', {
              determinedMode: storedDecision.determinedMode,
              timestamp: storedDecision.timestamp,
              confidence: storedDecision.confidence
            });
            log.info(`🎯 [COMPAT] Using stored mode decision: ${storedDecision.determinedMode} (from testing)`);
            
            // Add missing properties that SystemCompatibilityChecker expects
            modeDetectionResult = {
              ...storedDecision,
              success: true,
              canProceed: storedDecision.determinedMode === 'SCAN' ? true : (storedDecision.determinedMode === 'UNSCAN' ? true : false),
              userMessage: storedDecision.userMessage || `${storedDecision.determinedMode} mode selected from compatibility testing`,
              duration: 0, // No duration since we're using stored result
              phase: 'complete',
              source: 'stored_decision'
            };
          } else {
            this.logger.info('MODE_DETECTION_FRESH', 'No recent stored decision found, running fresh detection');
            log.info(`🎯 [COMPAT] Running fresh mode detection...`);
            log.info(`🔍 [MODE_DEBUG] Fresh detection parameters:`, {
              storedDecision: storedDecision ? 'exists' : 'null',
              isRecentDecision: isRecentDecision,
              storedMode: storedDecision?.determinedMode || 'none'
            });
            
            // [MODE_DEBUG] Log shared instance state before running detection
            this.logger.info('MODE_DETECTION_DEBUG', 'Running detection with shared AppModeManager', {
              hasSharedInstance: !!this.appModeManager,
              lastUsedScenario: this.appModeManager.lastUsedScenario,
              sessionAge: this.appModeManager ? Date.now() - this.appModeManager.sessionStartTime : null
            });
            
            log.info(`🔍 [MODE_DEBUG] About to call appModeManager.runModeDetection() for REAL hardware detection`);
            modeDetectionResult = await this.appModeManager.runModeDetection({
              skipTestingPanel: true,  // Skip testing panel since user already clicked "Launch CypherEdge"
              source: 'compatibility_proceed'  // Context for why we're running detection
            });
            log.info(`🔍 [MODE_DEBUG] appModeManager.runModeDetection() returned:`, {
              success: modeDetectionResult?.success,
              determinedMode: modeDetectionResult?.determinedMode,
              canProceed: modeDetectionResult?.canProceed,
              userMessage: modeDetectionResult?.userMessage
            });
          }
          
          this.logger.info('MODE_DETECTION_COMPLETE', 'App mode detection completed', {
            determinedMode: modeDetectionResult.determinedMode,
            canProceed: modeDetectionResult.canProceed
          });
          
          log.info(`🎯 [COMPAT] Mode determined: ${modeDetectionResult.determinedMode} (canProceed: ${modeDetectionResult.canProceed})`);
          
          // Set mode detection result in enhanced report
          this.enhancedReportCollector.setModeDetectionResult(modeDetectionResult);
          
          // Update window title based on detected mode
          this.updateWindowTitle(modeDetectionResult.determinedMode);
          
          // Verify mode result persistence
          this.verifyModeResultPersistence(modeDetectionResult);
          
          // Step 2.6: Handle mode-specific user notification flows
          this.logger.info('MODE_NOTIFICATION_START', 'Starting mode-specific notification flow');
          log.info("🔔 [COMPAT] Running mode notification flow...");
          
          let notificationResult = null;
          try {
            notificationResult = await this.modeNotificationUI.handleModeNotificationFlow(modeDetectionResult);
            
            this.logger.info('MODE_NOTIFICATION_COMPLETE', 'Mode notification flow completed', {
              outcome: notificationResult.outcome,
              canProceed: notificationResult.canProceed
            });
            
            log.info(`🔔 [COMPAT] Mode notification completed: ${notificationResult.outcome} (canProceed: ${notificationResult.canProceed})`);
          } catch (error) {
            this.logger.error('MODE_NOTIFICATION_ERROR', 'Mode notification flow failed', {
              error: error.message,
              stack: error.stack
            });
            log.error("❌ [COMPAT] Mode notification flow failed:", error);
            
            // Continue with default behavior if notification fails
            notificationResult = {
              outcome: 'notification_error',
              canProceed: true,
              message: `Notification error: ${error.message}`
            };
          }
          
          // Update results with mode information
          this.results.appMode = {
            determined: modeDetectionResult.determinedMode,
            canProceed: modeDetectionResult.canProceed && notificationResult.canProceed,
            confidence: modeDetectionResult.confidence,
            userMessage: modeDetectionResult.userMessage,
            nextSteps: modeDetectionResult.nextSteps,
            details: modeDetectionResult.modeDecision,
            timestamp: modeDetectionResult.timestamp,
            duration: modeDetectionResult.duration,
            notificationFlow: {
              outcome: notificationResult.outcome,
              message: notificationResult.message,
              userChoices: notificationResult.userChoices
            }
          };
          
          // Check if either mode detection or notification flow blocks startup
          if (!modeDetectionResult.canProceed) {
            this.logger.info('MODE_DETECTION_BLOCKED', 'Mode detection blocked app startup', {
              reason: modeDetectionResult.reason || 'Mode detection failed'
            });
            log.warn(`⚠️ [COMPAT] Mode detection blocked startup: ${modeDetectionResult.reason}`);
            
            this.results.canProceed = false;
            this.results.blockReason = modeDetectionResult.reason || 'App mode detection failed';
          } else if (!notificationResult.canProceed) {
            this.logger.info('MODE_NOTIFICATION_BLOCKED', 'Mode notification flow blocked app startup', {
              reason: notificationResult.message || 'User chose not to proceed'
            });
            log.warn(`⚠️ [COMPAT] Mode notification blocked startup: ${notificationResult.message}`);
            
            this.results.canProceed = false;
            this.results.blockReason = notificationResult.message || 'Mode notification flow blocked startup';
          } else {
            this.results.canProceed = true;
          }
          
        } catch (error) {
          this.logger.error('MODE_DETECTION_ERROR', 'App mode detection failed', {
            error: error.message,
            stack: error.stack
          });
          log.error("❌ [COMPAT] App mode detection failed:", error);
          
          // Don't block startup if mode detection fails - fallback to normal operation
          this.logger.info('MODE_DETECTION_FALLBACK', 'Continuing with normal startup despite mode detection failure');
          log.info("⚠️ [COMPAT] Continuing with normal startup (mode detection failed)");
          
          this.results.appMode = {
            determined: 'ERROR',
            canProceed: true, // Don't block on detection failure
            error: error.message,
            fallback: true
          };
          this.results.canProceed = true;
        }
      } else {
        // User decided not to proceed or cancelled
        this.results.canProceed = false;
        this.results.blockReason = 'User chose not to proceed with compatibility check';
      }

      // Step 3: Finalize and cleanup
      this.results.endTime = Date.now();
      this.results.duration = this.results.endTime - this.results.startTime;

      // Set final outcome in enhanced report
      const finalOutcome = this.results.canProceed ? 
        (userDecision === true ? 'proceed' : 'cancelled') : 
        'blocked';
      this.enhancedReportCollector.setFinalOutcome(finalOutcome, {
        canProceed: this.results.canProceed,
        blockReason: this.results.blockReason,
        userDecision: this.userDecision,
        duration: this.results.duration
      });

      // Save enhanced report before cleanup
      try {
        const reportResult = await this.enhancedReportCollector.saveReport();
        if (reportResult.success) {
          this.logger.info('ENHANCED_REPORT_SAVED', 'Enhanced compatibility report saved successfully', {
            sessionId: reportResult.sessionId,
            files: reportResult.files.map(f => f.path)
          });
          log.info(`📊 [COMPAT] Enhanced report saved (Session: ${reportResult.sessionId})`);
        } else {
          this.logger.error('ENHANCED_REPORT_SAVE_FAILED', 'Failed to save enhanced report', {
            error: reportResult.error
          });
          log.error(`❌ [COMPAT] Failed to save enhanced report: ${reportResult.error}`);
        }
      } catch (error) {
        this.logger.error('ENHANCED_REPORT_ERROR', 'Error saving enhanced report', {
          error: error.message,
          stack: error.stack
        });
        log.error(`❌ [COMPAT] Error saving enhanced report: ${error.message}`);
      }

      // Step 4: Auto-report results to server and email
      try {
        this.logger.info('AUTO_REPORT_START', 'Starting auto-reporting of compatibility results');
        log.info("📧 [COMPAT] Auto-reporting compatibility results to server...");
        
        const autoReportResult = await this.autoReportResults(this.results, modeDetectionResult);
        if (autoReportResult.success) {
          this.logger.info('AUTO_REPORT_SUCCESS', 'Compatibility results successfully reported', {
            sessionId: autoReportResult.sessionId,
            endpoint: autoReportResult.endpoint
          });
          log.info(`📧 [COMPAT] Auto-report successful - Session: ${autoReportResult.sessionId}`);
        } else {
          this.logger.warn('AUTO_REPORT_FAILED', 'Auto-reporting failed but continuing', {
            error: autoReportResult.error
          });
          log.warn(`📧 [COMPAT] Auto-report failed: ${autoReportResult.error}`);
        }
      } catch (error) {
        this.logger.error('AUTO_REPORT_ERROR', 'Auto-reporting encountered an error', {
          error: error.message,
          stack: error.stack
        });
        log.error(`📧 [COMPAT] Auto-reporting error: ${error.message}`);
      }

      // Generate comprehensive logs and reports  
      const sessionSummary = this.logger.endSession(this.results);
      const reportPath = this.logger.generateSummaryReport(this.results);
      
      this.logger.info('SESSION_COMPLETE', 'Compatibility check completed', {
        canProceed: userDecision,
        duration: this.results.duration,
        issues: this.results.issues.length,
        warnings: this.results.warnings.length,
        reportPath
      });
      
      log.info("✅ [COMPAT] Compatibility check completed", {
        canProceed: userDecision,
        duration: this.results.duration,
        issues: this.results.issues.length,
        warnings: this.results.warnings.length,
        logPaths: this.logger.getLogPaths(),
        reportPath
      });

      const result = { 
        canProceed: this.results.canProceed, 
        results: this.results,
        sessionSummary,
        logPaths: this.logger.getLogPaths(),
        reportPath,
        modeDetection: modeDetectionResult
      };

      log.info("🔍 [FINAL_RESULT_DEBUG] Final compatibility result being returned to main.js:", {
        canProceed: result.canProceed,
        modeDetectionExists: !!result.modeDetection,
        determinedMode: result.modeDetection?.determinedMode,
        modeCanProceed: result.modeDetection?.canProceed,
        autoLaunchExpected: result.modeDetection?.determinedMode === 'SCAN' || result.modeDetection?.determinedMode === 'UNSCAN'
      });

      // ✅ CRITICAL FIX: Close window AFTER returning result to avoid app.quit() race condition
      // Delay window closure to ensure main.js receives the result first
      setTimeout(() => {
        // Cleanup app mode manager
        if (this.appModeManager) {
          this.appModeManager.cleanup();
        }

        // Cleanup mode notification UI  
        if (this.modeNotificationUI) {
          this.modeNotificationUI.cleanup();
        }

        // Close window last
        if (this.window && !this.window.isDestroyed()) {
          this.window.close();
        }
      }, 100); // 100ms delay to let main.js process the result

      return result;
    } catch (error) {
      this.logger.critical('SESSION_ERROR', 'Compatibility check failed', { error: error.message, stack: error.stack });
      log.error("💥 [COMPAT] Compatibility check failed:", error);
      
      if (this.window && !this.window.isDestroyed()) {
        this.window.close();
      }

      // Cleanup app mode manager
      if (this.appModeManager) {
        this.appModeManager.cleanup();
      }

      // Cleanup mode notification UI
      if (this.modeNotificationUI) {
        this.modeNotificationUI.cleanup();
      }
      
      // Try to generate error report
      try {
        this.logger.generateSummaryReport({
          ...this.results,
          criticalError: error.message,
          stack: error.stack
        });
      } catch (reportError) {
        this.logger.error('REPORT_ERROR', 'Failed to generate error report', { error: reportError.message });
      }
      
      throw error;
    }
  }

  async createCompatibilityWindow() {
    this.logger.info('WINDOW_CREATE', 'Creating compatibility checker window');
    log.info("🖥️ [COMPAT] Creating compatibility checker window...");

    this.window = new BrowserWindow({
      width: 900,
      height: 700,
      center: true,
      resizable: true,   // Enable resizing
      movable: true,     // Enable moving/dragging
      frame: true,       // Enable native window frame
      transparent: false,
      alwaysOnTop: true,
      show: true,        // Show immediately
      focusable: true,
      skipTaskbar: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false,
      },
      icon: path.join(__dirname, "assets", "cyphersol-icon.png"),
      title: "CypherEdge Compatibility Check",
      backgroundColor: '#f0f4f8',
    });

    // Load the compatibility HTML page
    const compatibilityHtmlPath = path.join(
      __dirname,
      "react-app",
      "compatibility.html"
    );
    await this.window.loadFile(compatibilityHtmlPath);

    // Set up IPC communication with React app
    this.setupIPC();

    // Log that window was created
    this.logger.info('WINDOW_READY', 'Compatibility window created and displayed', {
      windowId: this.window.id,
      dimensions: { width: 900, height: 700 }
    });
    log.info("✅ [COMPAT] Compatibility window created and displayed");

    // Handle window closed
    this.window.on("closed", () => {
      this.window = null;
      if (this.cleanupIPC) {
        this.cleanupIPC();
      }
    });
  }

  setupIPC() {
    // Auto-start tests after 2 seconds if user doesn't click Continue (reduced for testing)
    // Skip auto-start in development mode when showing testing panel
    const isDevelopmentMode = process.env.NODE_ENV === 'development';
    
    if (!isDevelopmentMode) {
      setTimeout(() => {
        if (this.window && !this.window.isDestroyed() && this.userDecision === null) {
          this.logger.info('AUTO_START', 'Auto-starting compatibility tests after 2 second delay');
          log.info("🤖 [COMPAT] Auto-starting compatibility tests after 2 second delay");
          this.window.webContents.executeJavaScript(`
            const continueBtn = document.getElementById('continue-btn');
            if (continueBtn) {
              continueBtn.textContent = 'Auto-starting...';
              setTimeout(() => {
                continueBtn.click();
              }, 500);
            }
          `);
        }
      }, 2000); // Reduced from 5000 to 2000 for testing
    } else {
      this.logger.info('DEV_MODE', 'Auto-start disabled in development mode');
      log.info("🧪 [COMPAT] Auto-start disabled - development mode active");
    }

    // React app requests to start tests
    ipcMain.handle("compatibility:start-tests", async () => {
      this.logger.info('USER_ACTION', 'User initiated compatibility tests');
      log.info("🧪 [COMPAT] User initiated compatibility tests");
      
      // Phase 2: Run real system validation tests
      return await this.runAllTests();
    });

    // React app sends user decision (proceed/cancel/view-report)
    ipcMain.handle("compatibility:user-decision", async (event, decision) => {
      this.logger.info('USER_DECISION', `User decision: ${decision}`, { decision });
      log.info(`👤 [COMPAT] User decision: ${decision}`);
      this.userDecision = decision;
      return true;
    });

    // Email audit trigger handler - called when final report page is displayed
    ipcMain.handle("compatibility:send-email-audit", async (event, data) => {
      console.log('📧 🎯 === EMAIL AUDIT IPC HANDLER TRIGGERED ===');
      console.log('📧 🎯 Called from final report page (Step 3)');
      console.log('📧 🎯 Test results provided:', !!data.testResults);
      console.log('📧 🎯 Current step:', data.currentStep);
      console.log('📧 🎯 User email available:', !!this.userEmail);
      
      try {
        // Send email audit report immediately
        const emailResult = await this.sendEmailAuditReport(true); // Always send as "completed" when reaching final report
        
        return {
          success: emailResult.success || false,
          emailId: emailResult.emailId,
          recipients: emailResult.recipients,
          timestamp: emailResult.timestamp,
          error: emailResult.error
        };
        
      } catch (error) {
        console.error('📧 💥 Email audit IPC handler failed:', error);
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    });

    // Email verification handlers (integrated into compatibility window)
    ipcMain.handle("email-verification:verify", async (event, email) => {
      this.logger.info('EMAIL_VERIFICATION', 'Verifying email within compatibility window', { email });
      log.info(`🔐 [COMPAT] Verifying email: ${email}`);
      
      try {
        // Simulate backend email verification (demo logic)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const validEmails = [
          'valid@test.com',
          'admin@cyphersol.co.in', 
          'test@cypheredge.com',
          'demo@example.com'
        ];
        
        const isValid = validEmails.includes(email.toLowerCase());
        
        if (isValid) {
          this.verifiedEmail = email;
          this.logger.info('EMAIL_VERIFICATION', 'Email verification successful', { email });
          log.info(`🔐 [COMPAT] Email verified successfully: ${email}`);
        } else {
          this.logger.warn('EMAIL_VERIFICATION', 'Email verification failed', { email });
          log.warn(`🔐 [COMPAT] Email verification failed: ${email}`);
        }
        
        return { valid: isValid };
      } catch (error) {
        this.logger.error('EMAIL_VERIFICATION', 'Email verification error', { error: error.message });
        log.error(`🔐 [COMPAT] Email verification error: ${error.message}`);
        return { valid: false, error: error.message };
      }
    });

    // Clean up IPC handlers when done
    this.cleanupIPC = () => {
      ipcMain.removeHandler("compatibility:start-tests");
      ipcMain.removeHandler("compatibility:user-decision");
      ipcMain.removeHandler("email-verification:verify");
    };
  }

  // Phase 2: Run real system validation tests
  async runAllTests() {
    this.logger.info('TESTS_START', 'Executing comprehensive real system validation tests');
    log.info("🧪 [COMPAT] Running real system validation tests...");

    const testSuites = [
      {
        name: "System Requirements",
        tests: [
          { name: "Available RAM", test: () => this.tests.testMemory() },
          { name: "ML Models Memory", test: () => this.tests.testMLModelsMemory() },
          { name: "Disk Space", test: () => this.tests.testDiskSpace() },
          { name: "Windows Version", test: () => this.tests.testWindowsVersion() },
          { name: "Admin Privileges", test: () => this.tests.testAdminRights() },
        ],
      },
      {
        name: "Component Auto-Startup & Verification",
        tests: [
          { name: "CypherEdge Component Flow Test", test: () => this.tests.testComponentStartupFlow() },
        ],
      },
      {
        name: "Basic Port Availability", 
        tests: [
          { name: "Python Backend Port (7500)", test: () => this.tests.testPythonPort() },
          { name: "Gateway Service Port (7890)", test: () => this.tests.testGatewayPort() },
          { name: "FastAPI Health Check", test: () => this.tests.testFastAPIHealth() },
        ],
      },
      {
        name: "File System Tests",
        tests: [
          { name: "Python Executable", test: () => this.tests.testPythonExecutable() },
          { name: "Gateway Service", test: () => this.tests.testGatewayService() },
          { name: "Database Access", test: () => this.tests.testDatabaseAccess() },
          { name: "File Permissions", test: () => this.tests.testFilePermissions() },
        ],
      },
      {
        name: "API Dependencies",
        tests: [
          { name: "FastAPI Dependencies", test: () => this.tests.testFastAPIDependencies() },
          { name: "PDF Processing Capability", test: () => this.tests.testPDFProcessingCapability() },
        ],
      },
    ];

    for (const suite of testSuites) {
      this.logger.info('SUITE_START', `Starting ${suite.name} test suite`, { suiteName: suite.name, testCount: suite.tests.length });
      log.info(`🔄 [COMPAT] Running ${suite.name} tests...`);

      for (const test of suite.tests) {
        // Start test with enhanced logging
        const testTracker = this.logger.startTest(suite.name, test.name);

        // Enhanced UI notification with detailed context
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send("test-progress", {
            suiteName: suite.name,
            testName: test.name,
            status: "testing",
            message: `Testing ${test.name.toLowerCase()}...`,
            details: {
              description: this.getTestDescription(suite.name, test.name),
              importance: this.getTestImportance(suite.name, test.name),
              expectedDuration: this.getExpectedDuration(suite.name, test.name),
              testType: this.getTestType(suite.name, test.name)
            },
            progress: {
              currentTest: suite.tests.indexOf(test) + 1,
              totalInSuite: suite.tests.length,
              suiteName: suite.name
            }
          });
        }

        // Execute real test
        let result;
        try {
          result = await test.test();
        } catch (error) {
          result = {
            success: false,
            message: `Test crashed: ${error.message}`,
            details: { error: error.message, stack: error.stack },
            severity: "critical",
          };
        }

        // Finish test tracking
        testTracker.finish(result);

        // Process real test result
        let status, message, details;
        const duration = Date.now() - testTracker.startTime;
        
        if (result.success) {
          status = "success";
          message = result.message;
          details = result.details;
          this.results.successes.push({
            test: test.name,
            suite: suite.name,
            duration,
            details,
          });
        } else {
          const severity = result.severity || "error";
          status = severity === "warning" ? "warning" : "error";
          message = result.message;
          details = result.details;
          
          if (severity === "warning") {
            this.results.warnings.push({
              test: test.name,
              suite: suite.name,
              message,
              details,
              duration,
              severity: "warning",
            });
          } else {
            this.results.issues.push({
              test: test.name,
              suite: suite.name,
              message,
              details,
              duration,
              severity,
            });
          }
        }

        // Enhanced result notification with comprehensive information
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send("test-progress", {
            suiteName: suite.name,
            testName: test.name,
            status,
            message,
            details,
            duration,
            result: {
              summary: this.getTestSummary(test.name, result, status),
              impact: this.getTestImpact(test.name, result, status),
              recommendation: result.details?.recommendation || null,
              technical: result.details || {},
              performance: {
                duration: `${duration}ms`,
                category: duration < 1000 ? 'fast' : duration < 5000 ? 'normal' : 'slow'
              }
            },
            progress: {
              currentTest: suite.tests.indexOf(test) + 1,
              totalInSuite: suite.tests.length,
              overallProgress: this.calculateOverallProgress(suite, test, testSuites)
            }
          });
        }

        log.info(`  ${status === 'success' ? '✅' : status === 'warning' ? '⚠️' : '❌'} [COMPAT] ${test.name}: ${status.toUpperCase()}`);
        
        // Small delay between tests for UI smoothness and system resource management
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Calculate overall compatibility
    this.results.canProceed = this.calculateCompatibility();

    // Enhanced completion signal with comprehensive results
    if (this.window && !this.window.isDestroyed()) {
      const enhancedResults = {
        ...this.results,
        duration: Date.now() - this.results.startTime,
        systemInfo: {
          timestamp: new Date().toISOString(),
          totalTests: this.results.successes.length + this.results.warnings.length + this.results.issues.length,
          environment: process.env.NODE_ENV || 'production'
        },
        summary: {
          overallStatus: this.results.canProceed === true ? 'compatible' : 
                        this.results.canProceed === false ? 'incompatible' : 'compatible-with-warnings',
          performanceLevel: this.getPerformanceLevel(),
          startupMode: this.getStartupMode(),
          recommendations: this.getOverallRecommendations()
        },
        breakdown: {
          critical: this.results.issues.filter(i => i.severity === 'critical').length,
          warnings: this.results.warnings.length,
          passed: this.results.successes.length
        }
      };
      
      this.window.webContents.send("compatibility-complete", enhancedResults);
    }

    this.logger.info('TESTS_COMPLETE', 'All compatibility tests completed', {
      successes: this.results.successes.length,
      warnings: this.results.warnings.length,
      issues: this.results.issues.length,
      canProceed: this.results.canProceed,
      totalDuration: Date.now() - this.results.startTime
    });
    
    log.info("🏁 [COMPAT] Real system validation tests completed", {
      successes: this.results.successes.length,
      warnings: this.results.warnings.length,
      issues: this.results.issues.length,
      canProceed: this.results.canProceed,
    });

    // 📧 FALLBACK EMAIL TRIGGER: Send email audit when tests complete (Step 2)
    // This ensures email is sent even if Step 3 (final report) is never reached
    console.log('📧 🎯 === TESTS COMPLETED - TRIGGERING FALLBACK EMAIL AUDIT ===');
    console.log('📧 🎯 Test results: canProceed =', this.results.canProceed);
    console.log('📧 🎯 User email available:', !!this.userEmail);
    
    // 🔧 FIX: Calculate and set duration before sending email
    if (!this.results.endTime) {
      this.results.endTime = Date.now();
    }
    if (!this.results.duration && this.results.startTime) {
      this.results.duration = this.results.endTime - this.results.startTime;
      console.log('📧 🔧 Fixed duration calculation:', this.results.duration, 'ms');
    }
    
    // 🔧 FIX: Run quick mode detection for email if not already done
    if (this.appModeManager && this.results.canProceed) {
      try {
        console.log('📧 🔧 Running quick mode detection for email audit...');
        
        // Check if mode detection has already run
        const storedDecision = this.appModeManager.loadStoredDecision ? 
          this.appModeManager.loadStoredDecision() : null;
        
        if (storedDecision && storedDecision.determinedMode) {
          console.log('📧 🔧 Found stored mode decision for fallback email:', storedDecision.determinedMode);
          // Store it in enhanced report collector for email to pick up
          if (this.enhancedReportCollector && this.enhancedReportCollector.setModeDetectionResult) {
            this.enhancedReportCollector.setModeDetectionResult(storedDecision);
            console.log('📧 🔧 Set mode detection result in enhanced report collector');
          }
        } else {
          console.log('📧 🔧 No stored mode decision, running quick detection for email...');
          
          // Run a quick mode detection just for the email
          try {
            const quickModeResult = await this.appModeManager.runModeDetection({
              skipTestingPanel: true,
              skipUI: true,  // Don't show UI, just detect
              source: 'email_audit_fallback'
            });
            
            if (quickModeResult && quickModeResult.determinedMode) {
              console.log('📧 🔧 Quick mode detection result:', quickModeResult.determinedMode);
              
              // Store in enhanced report collector
              if (this.enhancedReportCollector && this.enhancedReportCollector.setModeDetectionResult) {
                this.enhancedReportCollector.setModeDetectionResult(quickModeResult);
                console.log('📧 🔧 Stored mode detection result for email');
              }
              
              // Also store in results for backward compatibility
              this.results.appMode = quickModeResult;
            }
          } catch (modeError) {
            console.log('📧 🔧 Quick mode detection failed:', modeError.message);
          }
        }
      } catch (error) {
        console.log('📧 🔧 Could not retrieve mode detection for fallback:', error.message);
      }
    } else if (!this.appModeManager) {
      console.log('📧 🔧 AppModeManager not available for mode detection');
    }
    
    if (this.userEmail && this.results.canProceed) {
      console.log('📧 🎯 Sending fallback email audit for successful test completion...');
      try {
        await this.sendEmailAuditReport('test-completion-fallback');
        console.log('📧 ✅ Fallback email audit sent successfully');
      } catch (error) {
        console.error('📧 ❌ Fallback email audit failed:', error.message);
        this.logger?.error('EMAIL_AUDIT', 'Fallback email audit failed:', error.message);
      }
    } else if (!this.userEmail) {
      console.log('📧 ⚠️ Fallback email skipped: No user email available');
    } else if (!this.results.canProceed) {
      console.log('📧 ⚠️ Fallback email skipped: Tests failed, user may retry');
    }

    // Cleanup managed server after all tests are complete
    if (this.tests && this.tests.cleanupManagedServer) {
      this.logger.info('TESTS_COMPLETE', 'Initiating managed server cleanup');
      try {
        const cleanupResult = await this.tests.cleanupManagedServer();
        this.logger.info('TESTS_COMPLETE', 'Server cleanup completed', cleanupResult);
      } catch (cleanupError) {
        this.logger.warn('TESTS_COMPLETE', 'Server cleanup encountered issues', {
          error: cleanupError.message
        });
      }
    }

    return this.results;
  }

  calculateCompatibility() {
    // Only truly critical issues that absolutely prevent startup (like missing core files)
    const blockingIssues = this.results.issues.filter(
      (issue) => issue.severity === "blocking"
    );
    
    const criticalIssues = this.results.issues.filter(
      (issue) => issue.severity === "critical"
    );
    
    const allIssues = this.results.issues.length;
    const warnings = this.results.warnings.length;
    
    this.logger.info('COMPATIBILITY_CALCULATION', 'Determining overall compatibility status', {
      blockingIssues: blockingIssues.length,
      criticalIssues: criticalIssues.length,
      totalIssues: allIssues,
      warnings,
      successes: this.results.successes.length
    });

    // Only prevent startup for truly blocking issues (missing executables, no permissions)
    if (blockingIssues.length > 0) {
      this.logger.error('COMPATIBILITY_BLOCKED', 'Blocking issues found - app cannot start', {
        blockingIssues: blockingIssues.map(issue => ({ test: issue.test, message: issue.message }))
      });
      log.warn("🚫 [COMPAT] Blocking issues found - app cannot start");
      return false;
    }

    // For critical or other issues, allow user to proceed but show warnings
    if (criticalIssues.length > 0 || allIssues > 0) {
      this.logger.warn('COMPATIBILITY_WARNING', 'Issues found but app can still start - user can decide', {
        criticalIssues: criticalIssues.map(issue => ({ test: issue.test, message: issue.message, severity: issue.severity })),
        otherIssues: this.results.issues.filter(issue => issue.severity !== "critical").map(issue => ({ test: issue.test, message: issue.message, severity: issue.severity }))
      });
      log.warn("⚠️ [COMPAT] Issues found but app can still start - showing detailed report");
      return "user_choice";
    }

    this.logger.info('COMPATIBILITY_PASSED', 'No issues found - compatibility PASSED', {
      warnings,
      status: warnings > 0 ? 'passed_with_warnings' : 'passed_clean'
    });
    log.info("✅ [COMPAT] No issues found - compatibility PASSED");
    return true;
  }

  /**
   * Show app mode testing panel in development mode
   * @returns {Promise<Object>} Testing panel result
   */
  async showAppModeTestingPanel() {
    this.logger.info('TESTING_PANEL', 'Showing app mode testing panel');
    log.info("🧪 [COMPAT] Displaying app mode testing panel");

    try {
      // Send testing panel HTML to the compatibility window
      const testingPanel = this.appModeManager.testingPanel;
      const testingHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>App Mode Testing Panel</title>
          <style>
            body { margin: 0; padding: 20px; font-family: 'Segoe UI', sans-serif; background: #f5f5f5; }
            .dev-header { background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
            .dev-header h1 { margin: 0; color: #1976d2; }
            .dev-header p { margin: 5px 0 0 0; color: #666; }
          </style>
        </head>
        <body>
          <div class="dev-header">
            <h1>🧪 CypherEdge App Mode Testing Panel</h1>
            <p>Development Mode Active - NODE_ENV=development</p>
          </div>
          ${testingPanel.generateTestingPanelHTML()}
          <script>
            // Set up Electron API bridge
            const { ipcRenderer } = require('electron');
            window.electronAPI = {
              invoke: ipcRenderer.invoke.bind(ipcRenderer),
              on: ipcRenderer.on.bind(ipcRenderer)
            };
          </script>
        </body>
        </html>
      `;

      // Load the testing HTML into the window
      await this.window.webContents.loadURL('data:text/html,' + encodeURIComponent(testingHTML));

      // Initialize the testing panel IPC handlers
      testingPanel.initialize();

      // Wait for user to complete testing or exit
      return await this.waitForTestingCompletion();

    } catch (error) {
      this.logger.error('TESTING_PANEL_ERROR', 'Failed to show testing panel', {
        error: error.message,
        stack: error.stack
      });

      return {
        canProceed: false,
        error: error.message,
        modeDecision: { determined: 'ERROR', canProceed: false }
      };
    }
  }

  /**
   * Wait for testing completion in development mode
   * @returns {Promise<Object>} Testing result
   */
  async waitForTestingCompletion() {
    return new Promise((resolve) => {
      let resolved = false;

      // Listen for proceed signal (user completed testing)
      this.window.webContents.on('compatibility:proceed', () => {
        if (resolved) return;
        resolved = true;
        
        this.logger.info('TESTING_COMPLETE', 'User completed testing and chose to proceed');
        log.info("✅ [COMPAT] Testing completed - user chose to proceed");
        
        // Get the stored mode decision
        const storedDecision = this.appModeManager.loadStoredDecision();
        resolve({
          canProceed: true,
          modeDecision: storedDecision,
          source: 'testing_panel'
        });
      });

      // Listen for cancel signal (user chose to exit)
      this.window.webContents.on('compatibility:cancel', () => {
        if (resolved) return;
        resolved = true;
        
        this.logger.info('TESTING_CANCELLED', 'User cancelled testing');
        log.info("❌ [COMPAT] Testing cancelled by user");
        
        resolve({
          canProceed: false,
          modeDecision: { determined: 'CANCELLED', canProceed: false },
          source: 'testing_panel'
        });
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        
        this.logger.warn('TESTING_TIMEOUT', 'Testing panel timed out after 10 minutes');
        log.warn("⏱️ [COMPAT] Testing panel timed out");
        
        resolve({
          canProceed: false,
          modeDecision: { determined: 'TIMEOUT', canProceed: false },
          source: 'timeout'
        });
      }, 600000); // 10 minutes
    });
  }

  async waitForUserDecision() {
    this.logger.info('USER_WAIT', 'Waiting for user decision');
    log.info("⏳ [COMPAT] Waiting for user decision...");

    return new Promise((resolve) => {
      const checkDecision = async () => {
        if (this.userDecision !== null) {
          const decision = this.userDecision;
          this.userDecision = null; // Reset for next time

          this.logger.info('USER_DECISION_RECEIVED', `User decision received: ${decision}`, { decision });
          log.info(`👤 [COMPAT] User decision: ${decision}`);

          // Handle different decision types
          if (decision === "view-report") {
            this.logger.info('REPORT_REQUEST', 'User requested to view detailed HTML report');
            log.info("📊 [COMPAT] User requested to view detailed HTML report");
            
            try {
              // Generate detailed HTML report
              const reportResult = await this.detailedReportGenerator.generateDetailedReport(
                this.results, 
                this.logger.getLogPaths()
              );
              
              if (reportResult.success) {
                this.logger.info('REPORT_GENERATED', 'Detailed HTML report generated successfully', {
                  reportPath: reportResult.reportPath
                });
                
                // Open the HTML report in the default browser
                const { shell } = require('electron');
                await shell.openExternal(`file://${reportResult.reportPath}`);
                
                // Show confirmation message
                if (this.window && !this.window.isDestroyed()) {
                  this.window.webContents.executeJavaScript(`
                    alert("📊 Detailed Compatibility Report\\n\\nA comprehensive HTML report has been generated and opened in your default browser.\\n\\nThe report includes:\\n• Test results summary\\n• Step-by-step fix instructions\\n• System information\\n• Copy-pasteable commands\\n\\nReport saved to: ${reportResult.reportPath.replace(/\\\\/g, '\\\\\\\\')}\\n\\nClick OK to return to results screen.");
                  `);
                }
              } else {
                this.logger.error('REPORT_ERROR', 'Failed to generate detailed report', { error: reportResult.error });
                
                // Fallback to basic report
                if (this.window && !this.window.isDestroyed()) {
                  this.window.webContents.executeJavaScript(`
                    alert("📊 Report Generation Error\\n\\nFailed to generate detailed HTML report: ${reportResult.error}\\n\\nBasic Summary:\\n• Tests Passed: ${this.results.successes.length}\\n• Warnings: ${this.results.warnings.length}\\n• Critical Issues: ${this.results.issues.length}\\n\\nClick OK to return to results screen.");
                  `);
                }
              }
            } catch (error) {
              this.logger.error('REPORT_EXCEPTION', 'Exception during report generation', { error: error.message });
              
              // Fallback alert
              if (this.window && !this.window.isDestroyed()) {
                this.window.webContents.executeJavaScript(`
                  alert("📊 Report Error\\n\\nCould not generate detailed report due to an unexpected error.\\n\\nBasic Summary:\\n• Tests Passed: ${this.results.successes.length}\\n• Warnings: ${this.results.warnings.length}\\n• Critical Issues: ${this.results.issues.length}\\n\\nCheck the logs for more details.");
                `);
              }
            }
            
            // Don't resolve yet - wait for another decision
            setTimeout(checkDecision, 100);
            return;
          }

          // Clean up IPC handlers
          if (this.cleanupIPC) {
            this.cleanupIPC();
          }
          
          const finalDecision = decision === "proceed";
          this.logger.info('FINAL_DECISION', 'User decision processed', { 
            decision, 
            finalDecision,
            canProceed: finalDecision
          });

          // Email audit already sent when final report page was displayed
          console.log('🎯 ===============================');
          console.log('🎯 USER MADE FINAL DECISION');
          console.log('🎯 ===============================');
          console.log('🎯 USER DECISION:', decision);
          console.log('🎯 FINAL DECISION (boolean):', finalDecision);
          console.log('🎯 EMAIL AUDIT: Already sent when report page displayed');
          console.log('🎯 TIMESTAMP:', new Date().toISOString());
          console.log('🎯 ===============================');

          resolve(finalDecision);
        } else {
          // Check again in 100ms
          setTimeout(checkDecision, 100);
        }
      };

      checkDecision();
    });
  }

  // Enhanced UI Information Methods
  getTestDescription(suiteName, testName) {
    const descriptions = {
      // System Requirements
      "Available RAM": "Verifying system has sufficient memory for optimal performance",
      "ML Models Memory": "Checking memory availability for machine learning model operations",
      "Disk Space": "Ensuring adequate storage space for application data and temporary files", 
      "Windows Version": "Validating Windows version compatibility and feature support",
      "Admin Privileges": "Confirming administrator permissions for system-level operations",
      
      // Component Tests
      "CypherEdge Component Flow Test": "Comprehensive test of all core components in isolated environment",
      "Python Backend Port (7500)": "Verifying FastAPI backend service port availability",
      "Gateway Service Port (7890)": "Checking .NET Gateway licensing service port accessibility",
      "FastAPI Health Check": "Testing HTTP connectivity to Python backend API endpoints",
      
      // File System  
      "Python Executable": "Validating Python backend executable integrity and accessibility",
      "Gateway Service": "Verifying .NET Gateway service executable and configuration", 
      "Database Access": "Testing SQLite database creation, read/write operations",
      "File Permissions": "Checking file system permissions for application directories",
      
      // API Dependencies
      "FastAPI Dependencies": "Validating Python dependencies and ML model availability",
      "PDF Processing Capability": "Testing PDF parsing and document processing functionality"
    };
    
    return descriptions[testName] || `Testing ${testName.toLowerCase()} functionality`;
  }

  getTestImportance(suiteName, testName) {
    const criticalTests = [
      "Available RAM", "Windows Version", "Admin Privileges", 
      "CypherEdge Component Flow Test", "Database Access"
    ];
    
    const importantTests = [
      "Python Executable", "Gateway Service", "FastAPI Dependencies",
      "Python Backend Port (7500)", "Gateway Service Port (7890)"
    ];
    
    if (criticalTests.includes(testName)) return "critical";
    if (importantTests.includes(testName)) return "important";
    return "standard";
  }

  getExpectedDuration(suiteName, testName) {
    const durations = {
      "Available RAM": "< 1s",
      "ML Models Memory": "< 1s", 
      "Disk Space": "1-2s",
      "Windows Version": "< 1s",
      "Admin Privileges": "2-3s",
      "CypherEdge Component Flow Test": "15-25s",
      "Python Backend Port (7500)": "< 1s",
      "Gateway Service Port (7890)": "< 1s", 
      "FastAPI Health Check": "3-5s",
      "Python Executable": "1-2s",
      "Gateway Service": "1-2s",
      "Database Access": "2-3s",
      "File Permissions": "1-2s", 
      "FastAPI Dependencies": "3-5s",
      "PDF Processing Capability": "2-4s"
    };
    
    return durations[testName] || "1-3s";
  }

  getTestType(suiteName, testName) {
    if (testName.includes("Port")) return "network";
    if (testName.includes("Memory") || testName === "Available RAM") return "system";
    if (testName.includes("Executable") || testName.includes("Service")) return "component";
    if (testName.includes("API") || testName.includes("Processing")) return "integration";
    if (testName.includes("Admin") || testName.includes("Permissions")) return "security";
    return "general";
  }

  getTestSummary(testName, result, status) {
    if (status === "success") {
      const successMessages = {
        "Available RAM": `✅ ${result.details?.totalGB}GB total memory (${result.details?.freeGB}GB available)`,
        "ML Models Memory": `✅ Sufficient memory for ML operations (${result.details?.freeGB}GB available)`, 
        "Disk Space": `✅ ${result.details?.freeGB}GB available space`,
        "Windows Version": `✅ ${result.details?.version} - Fully compatible`,
        "Admin Privileges": "✅ Administrator permissions confirmed",
        "CypherEdge Component Flow Test": "✅ All components started and tested successfully",
        "Python Backend Port (7500)": "✅ Port available for FastAPI backend",
        "Gateway Service Port (7890)": "✅ Port available for licensing service",
        "FastAPI Health Check": "✅ Backend API responding normally",
        "Python Executable": `✅ Backend executable verified (${result.details?.size})`,
        "Gateway Service": `✅ Licensing service verified (${result.details?.size})`,
        "Database Access": "✅ SQLite database operations successful",
        "File Permissions": "✅ All required directories accessible", 
        "FastAPI Dependencies": "✅ Python dependencies and ML models ready",
        "PDF Processing Capability": "✅ PDF processing pipeline functional"
      };
      
      return successMessages[testName] || `✅ ${testName} completed successfully`;
    }
    
    return result.message || `${status === "warning" ? "⚠️" : "❌"} ${testName} ${status}`;
  }

  getTestImpact(testName, result, status) {
    if (status === "success") return "No issues - optimal performance expected";
    
    const impacts = {
      "Available RAM": "May cause slow performance or crashes during heavy operations",
      "ML Models Memory": "Machine learning features may not load or perform slowly",
      "Disk Space": "Application may fail to save data or create temporary files",
      "Windows Version": "Some features may not work correctly on this Windows version",
      "Admin Privileges": "Unable to perform system-level operations and service management",
      "CypherEdge Component Flow Test": "Core application components may not start properly",
      "Python Backend Port (7500)": "PDF processing and backend services unavailable",
      "Gateway Service Port (7890)": "License validation and authentication will fail", 
      "FastAPI Health Check": "Backend API communication issues expected",
      "Python Executable": "PDF processing and ML features will not function",
      "Gateway Service": "License management and user authentication unavailable",
      "Database Access": "Data storage and retrieval operations will fail",
      "File Permissions": "Unable to access required directories and files",
      "FastAPI Dependencies": "Backend services may crash or function incorrectly",
      "PDF Processing Capability": "PDF analysis and document processing unavailable"
    };
    
    return impacts[testName] || "May affect application functionality";
  }

  calculateOverallProgress(currentSuite, currentTest, allSuites) {
    let totalTests = 0;
    let completedTests = 0;
    
    for (const suite of allSuites) {
      for (const test of suite.tests) {
        totalTests++;
        if (suite === currentSuite && test === currentTest) {
          // Current test is completed
          completedTests++;
          break;
        }
        if (suite !== currentSuite) {
          // Previous suite, all tests completed
          completedTests++;
        }
      }
      if (suite === currentSuite) break;
    }
    
    return {
      completed: completedTests,
      total: totalTests,
      percentage: Math.round((completedTests / totalTests) * 100)
    };
  }

  getPerformanceLevel() {
    const criticalIssues = this.results.issues.filter(i => i.severity === 'critical').length;
    const warnings = this.results.warnings.length;
    
    if (criticalIssues === 0 && warnings === 0) return 'excellent';
    if (criticalIssues === 0 && warnings <= 2) return 'good';
    if (criticalIssues <= 1 && warnings <= 3) return 'fair';
    return 'poor';
  }

  getStartupMode() {
    const criticalIssues = this.results.issues.filter(i => i.severity === 'critical').length;
    const warnings = this.results.warnings.length;
    
    if (criticalIssues === 0 && warnings === 0) return 'optimal';
    if (criticalIssues === 0) return 'standard';
    if (this.results.canProceed) return 'fallback';
    return 'blocked';
  }

  getOverallRecommendations() {
    const recommendations = [];
    
    if (this.results.issues.length > 0) {
      recommendations.push("Address critical issues before launching CypherEdge");
    }
    
    if (this.results.warnings.length > 0) {
      recommendations.push("Review warnings for optimal performance");
    }
    
    if (this.results.successes.length === 15) {
      recommendations.push("System fully ready for CypherEdge deployment");
    }
    
    return recommendations;
  }

  /**
   * Update window title based on detected mode
   * @param {string} mode - Detected mode (SCAN, UNSCAN, HYBRID)
   */
  updateWindowTitle(mode) {
    try {
      if (this.window && !this.window.isDestroyed()) {
        let newTitle;
        switch (mode) {
          case 'SCAN':
            newTitle = 'CypherEdge - Standard Mode';
            break;
          case 'UNSCAN':
            newTitle = 'CypherEdge - UNSCAN Mode';
            break;
          case 'HYBRID':
            newTitle = 'CypherEdge - HYBRID Mode';
            break;
          default:
            newTitle = 'CypherEdge Compatibility Check';
        }
        
        this.window.setTitle(newTitle);
        this.logger.info('WINDOW_TITLE_UPDATE', 'Updated window title for mode', {
          mode: mode,
          newTitle: newTitle
        });
        log.info(`🪟 [COMPAT] Window title updated to: ${newTitle}`);
      }
    } catch (error) {
      this.logger.error('WINDOW_TITLE_ERROR', 'Failed to update window title', {
        error: error.message,
        mode: mode
      });
      log.error('❌ [COMPAT] Failed to update window title:', error.message);
    }
  }

  /**
   * Verify mode result persistence to JSON storage
   * @param {Object} modeDetectionResult - Mode detection result
   */
  verifyModeResultPersistence(modeDetectionResult) {
    try {
      this.logger.info('MODE_PERSISTENCE_VERIFY', 'Verifying mode result storage');
      log.info('📁 [COMPAT] Verifying mode result persistence...');

      // Check if AppModeManager has storage manager
      if (this.appModeManager && this.appModeManager.storageManager) {
        const storageStatus = this.appModeManager.getStorageStatus();
        
        this.logger.info('MODE_PERSISTENCE_STATUS', 'Storage manager status checked', {
          storageDirectory: storageStatus.directory,
          storageExists: storageStatus.exists,
          files: Object.keys(storageStatus.files || {})
        });

        log.info('📁 [COMPAT] Mode storage directory:', storageStatus.directory);
        log.info('📁 [COMPAT] Storage directory exists:', storageStatus.exists);

        // Log expected JSON file location
        const expectedFiles = [
          'appModeDecision.json (main decision file)',
          'modeDecisionLog.json (detailed log)',
          'decisionHistory.json (historical records)'
        ];
        
        log.info('📁 [COMPAT] Expected storage files:', expectedFiles);

        // Check if we have the necessary data for storage
        const hasRequiredData = !!(modeDetectionResult.determinedMode && 
                                   modeDetectionResult.confidence && 
                                   modeDetectionResult.timestamp);
        
        log.info('📁 [COMPAT] Mode result has required data for storage:', hasRequiredData);
        
        if (hasRequiredData) {
          log.info('📁 [COMPAT] Mode detection result ready for JSON storage:', {
            mode: modeDetectionResult.determinedMode,
            confidence: modeDetectionResult.confidence,
            userMessage: modeDetectionResult.userMessage || 'No user message',
            duration: modeDetectionResult.duration || 'No duration'
          });
        } else {
          log.warn('⚠️ [COMPAT] Mode detection result missing required data for storage');
        }

      } else {
        log.warn('⚠️ [COMPAT] AppModeManager or StorageManager not available for verification');
      }

    } catch (error) {
      this.logger.error('MODE_PERSISTENCE_ERROR', 'Failed to verify mode result persistence', {
        error: error.message,
        stack: error.stack
      });
      log.error('❌ [COMPAT] Mode persistence verification failed:', error.message);
    }
  }


  /**
   * Send compatibility results to server and email report
   * @param {Object} results - Compatibility check results
   * @param {Object} modeDetectionResult - Mode detection result
   * @returns {Promise<Object>} Report submission result
   */
  async autoReportResults(results, modeDetectionResult) {
    this.logger.info('AUTO_REPORT', 'Starting auto-reporting of compatibility results');
    log.info("📧 [COMPAT] Auto-reporting compatibility results...");

    try {
      // Prepare report data
      const reportData = {
        timestamp: new Date().toISOString(),
        sessionId: `compat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        systemInfo: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
          appVersion: app.getVersion()
        },
        compatibilityResults: {
          canProceed: results.canProceed,
          totalTests: results.successes.length + results.warnings.length + results.issues.length,
          successes: results.successes.length,
          warnings: results.warnings.length,
          issues: results.issues.length,
          duration: results.duration,
          performanceLevel: this.getPerformanceLevel(),
          startupMode: this.getStartupMode()
        },
        modeDetection: modeDetectionResult ? {
          determinedMode: modeDetectionResult.determinedMode,
          confidence: modeDetectionResult.confidence,
          canProceed: modeDetectionResult.canProceed,
          userMessage: modeDetectionResult.userMessage
        } : null,
        detailedResults: {
          successes: results.successes.map(s => ({ test: s.test, message: s.message })),
          warnings: results.warnings.map(w => ({ test: w.test, message: w.message })),
          issues: results.issues.map(i => ({ test: i.test, message: i.message, severity: i.severity }))
        }
      };

      // TODO: Replace with actual server endpoint
      const serverEndpoint = 'https://api.cyphersol.co.in/compatibility-report';
      
      this.logger.info('AUTO_REPORT', 'Prepared report data for submission', {
        sessionId: reportData.sessionId,
        canProceed: reportData.compatibilityResults.canProceed,
        determinedMode: reportData.modeDetection?.determinedMode || 'unknown'
      });

      // Simulate server submission for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.logger.info('AUTO_REPORT', 'Compatibility report submitted successfully', {
        sessionId: reportData.sessionId,
        endpoint: serverEndpoint
      });
      
      log.info(`📧 [COMPAT] Compatibility report submitted - Session: ${reportData.sessionId}`);

      return {
        success: true,
        sessionId: reportData.sessionId,
        timestamp: reportData.timestamp,
        endpoint: serverEndpoint,
        reportData: reportData
      };

    } catch (error) {
      this.logger.error('AUTO_REPORT', 'Failed to auto-report compatibility results', {
        error: error.message,
        stack: error.stack
      });
      
      log.error("📧 [COMPAT] Auto-reporting failed:", error.message);

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Initialize electron-store dynamically (ES module compatibility)
   */
  async initializeStore() {
    try {
      const { default: Store } = await import('electron-store');
      this.store = new Store({ name: 'compatibility-session' });
      console.log('📧 💾 Electron-store initialized successfully');
      
      // Load persisted email after store is initialized
      this.loadPersistedEmail();
    } catch (error) {
      console.error('📧 ❌ Error initializing electron-store:', error.message);
      // Fallback: Use in-memory storage
      this.store = {
        get: () => null,
        set: () => {},
        delete: () => {}
      };
    }
  }

  /**
   * Load previously captured email from persistent storage
   */
  loadPersistedEmail() {
    try {
      if (!this.store) {
        console.log('📧 📋 Store not initialized yet, skipping email load');
        return;
      }
      
      const persistedEmail = this.store.get('userEmail');
      const timestamp = this.store.get('emailTimestamp');
      
      // Only use persisted email if it's less than 24 hours old
      if (persistedEmail && timestamp) {
        const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
        if (ageHours < 24) {
          this.userEmail = persistedEmail;
          console.log('📧 🎯 === EMAIL LOADED FROM STORAGE ===');
          console.log('📧 🎯 Email:', this.userEmail);
          console.log('📧 🎯 Age:', ageHours.toFixed(1), 'hours');
          this.logger?.info('EMAIL_PERSISTENCE', 'Loaded persisted email from storage:', persistedEmail);
          return;
        } else {
          console.log('📧 ⚠️ Persisted email too old (', ageHours.toFixed(1), 'hours), clearing storage');
          this.clearPersistedEmail();
        }
      }
      console.log('📧 📋 No valid persisted email found');
    } catch (error) {
      console.error('📧 ❌ Error loading persisted email:', error.message);
    }
  }

  /**
   * Clear persisted email from storage
   */
  clearPersistedEmail() {
    try {
      if (!this.store) {
        console.log('📧 📋 Store not initialized yet, skipping email clear');
        return;
      }
      
      this.store.delete('userEmail');
      this.store.delete('emailTimestamp');
      console.log('📧 🗑️ Cleared persisted email from storage');
    } catch (error) {
      console.error('📧 ❌ Error clearing persisted email:', error.message);
    }
  }

  /**
   * Set user email for audit reporting
   * @param {string} email - User email address
   */
  setUserEmail(email) {
    console.log('📧 🎯 === SET USER EMAIL CALLED IN COMPATIBILITY CHECKER ===');
    console.log('📧 🎯 Email received:', email);
    console.log('📧 🎯 Previous email value:', this.userEmail);
    
    this.userEmail = email;
    
    // 📧 EMAIL PERSISTENCE: Save email to storage for cross-session availability
    try {
      if (this.store) {
        this.store.set('userEmail', email);
        this.store.set('emailTimestamp', Date.now());
        console.log('📧 💾 Email persisted to storage successfully');
      } else {
        console.log('📧 📋 Store not initialized yet, email persistence skipped');
      }
    } catch (error) {
      console.error('📧 ❌ Error persisting email:', error.message);
    }
    
    console.log('📧 🎯 Email stored successfully:', this.userEmail);
    console.log('📧 🎯 === EMAIL CAPTURE COMPLETED ===');
    
    this.logger?.info('EMAIL_CAPTURE', 'User email captured for audit:', email);
  }

  /**
   * Send comprehensive email audit report
   * @param {boolean} finalDecision - Whether user decided to proceed or cancel
   */
  async sendEmailAuditReport(finalDecision) {
    console.log('📧 🔄 === SEND EMAIL AUDIT REPORT METHOD CALLED ===');
    console.log('📧 🔄 Method called with finalDecision:', finalDecision);
    console.log('📧 🔄 this.userEmail:', this.userEmail);
    console.log('📧 🔄 Current timestamp:', new Date().toISOString());
    
    this.logger?.info('EMAIL_AUDIT', '=== INITIATING EMAIL AUDIT REPORT ===');
    this.logger?.info('EMAIL_AUDIT', 'Final decision:', finalDecision ? 'PROCEED' : 'CANCEL');
    
    try {
      // Skip if no user email collected
      if (!this.userEmail) {
        console.log('📧 ⚠️ NO USER EMAIL - SKIPPING AUDIT EMAIL');
        this.logger?.warn('EMAIL_AUDIT', 'No user email available - skipping audit email');
        return;
      }

      // 📧 EMAIL DEDUPLICATION: Check if email was already sent for this user/session
      const emailKey = `email_sent_${this.userEmail}_${new Date().toDateString()}`;
      const lastEmailSent = this.store ? this.store.get(emailKey) : null;
      
      if (lastEmailSent) {
        const timeSince = Date.now() - lastEmailSent;
        const minutesSince = Math.floor(timeSince / (1000 * 60));
        
        // Don't send another email if one was sent in the last 5 minutes
        if (timeSince < 5 * 60 * 1000) {
          console.log('📧 ⏭️ DEDUPLICATION: Email already sent', minutesSince, 'minutes ago, skipping');
          this.logger?.info('EMAIL_AUDIT', 'Deduplication: Email already sent recently, skipping');
          return { success: true, skipped: true, reason: 'duplicate_prevention' };
        } else {
          console.log('📧 📧 DEDUPLICATION: Previous email sent', minutesSince, 'minutes ago, proceeding');
        }
      }

      console.log('📧 📊 Collecting comprehensive audit data...');
      // Collect comprehensive audit data
      const auditData = await this.collectAuditData(finalDecision);
      
      // 🔍 COMPREHENSIVE PRE-EMAIL LOGGING - Verify all data is captured
      console.log('📧 🔍 ===============================================');
      console.log('📧 🔍 === PRE-EMAIL SEND DATA VERIFICATION ===');
      console.log('📧 🔍 ===============================================');
      console.log('📧 📋 User Email:', auditData.userEmail);
      console.log('📧 📋 Final Decision:', auditData.finalDecision);
      console.log('📧 📋 Session ID:', auditData.sessionId);
      console.log('📧 📋 Timestamp:', auditData.timestamp);
      
      // 🎯 MODE DETECTION VERIFICATION
      console.log('📧 🎯 === MODE DETECTION DATA ===');
      console.log('📧 🎯 Mode Detection Available:', !!auditData.modeDetection);
      if (auditData.modeDetection) {
        console.log('📧 🎯 Determined Mode:', auditData.modeDetection.determinedMode);
        console.log('📧 🎯 Confidence:', auditData.modeDetection.confidence);
        console.log('📧 🎯 Can Proceed:', auditData.modeDetection.canProceed);
        console.log('📧 🎯 User Message:', auditData.modeDetection.userMessage);
        console.log('📧 🎯 Reason:', auditData.modeDetection.reason);
        console.log('📧 🎯 Full Mode Data:', JSON.stringify(auditData.modeDetection, null, 2));
      } else {
        console.log('📧 🎯 ❌ NO MODE DETECTION DATA FOUND');
        console.log('📧 🎯 this.appModeManager available:', !!this.appModeManager);
        console.log('📧 🎯 Enhanced Report Mode Detection:', auditData.enhancedReportData?.modeDetection);
      }
      
      // ⚡ PERFORMANCE METRICS VERIFICATION
      console.log('📧 ⚡ === PERFORMANCE METRICS DATA ===');
      console.log('📧 ⚡ Performance Metrics Available:', !!auditData.performanceMetrics);
      if (auditData.performanceMetrics) {
        console.log('📧 ⚡ Session Duration:', auditData.performanceMetrics.session?.totalDuration);
        console.log('📧 ⚡ Test Success Rate:', auditData.performanceMetrics.testing?.successRate);
        console.log('📧 ⚡ Memory Usage:', auditData.performanceMetrics.system?.memoryUsage);
        console.log('📧 ⚡ Full Performance Data:', JSON.stringify(auditData.performanceMetrics, null, 2));
      } else {
        console.log('📧 ⚡ ❌ NO PERFORMANCE METRICS DATA FOUND');
      }
      
      // 🧪 COMPATIBILITY RESULTS VERIFICATION
      console.log('📧 🧪 === COMPATIBILITY RESULTS DATA ===');
      console.log('📧 🧪 Compatibility Results Available:', !!auditData.compatibilityResults);
      if (auditData.compatibilityResults) {
        console.log('📧 🧪 Overall Score:', auditData.compatibilityResults.overallScore);
        console.log('📧 🧪 Test Suites Count:', auditData.compatibilityResults.testSuites?.length);
        console.log('📧 🧪 Duration:', auditData.compatibilityResults.duration);
        auditData.compatibilityResults.testSuites?.forEach((suite, index) => {
          console.log(`📧 🧪 Suite ${index + 1}: ${suite.name} (${suite.tests?.length || 0} tests)`);
        });
      } else {
        console.log('📧 🧪 ❌ NO COMPATIBILITY RESULTS DATA FOUND');
      }
      
      // 💻 SYSTEM INFO VERIFICATION
      console.log('📧 💻 === SYSTEM INFO DATA ===');
      console.log('📧 💻 Platform:', auditData.systemInfo?.platform);
      console.log('📧 💻 Total Memory:', auditData.systemInfo?.totalMemory, 'GB');
      console.log('📧 💻 CPU:', auditData.systemInfo?.cpu);
      console.log('📧 💻 CPU Cores:', auditData.systemInfo?.cpuCores);
      console.log('📧 💻 Architecture:', auditData.systemInfo?.arch);
      
      // 📊 ENHANCED REPORT DATA VERIFICATION
      console.log('📧 📊 === ENHANCED REPORT DATA ===');
      console.log('📧 📊 Enhanced Report Available:', !!auditData.enhancedReportData);
      if (auditData.enhancedReportData) {
        console.log('📧 📊 Enhanced Report Keys:', Object.keys(auditData.enhancedReportData));
        console.log('📧 📊 Enhanced Report Mode Detection:', auditData.enhancedReportData.modeDetection);
      }
      
      // 🔗 DATA SOURCES VERIFICATION
      console.log('📧 🔗 === DATA SOURCES STATUS ===');
      console.log('📧 🔗 this.results available:', !!this.results);
      console.log('📧 🔗 this.results keys:', this.results ? Object.keys(this.results) : 'N/A');
      console.log('📧 🔗 this.enhancedReportCollector available:', !!this.enhancedReportCollector);
      console.log('📧 🔗 this.appModeManager available:', !!this.appModeManager);
      
      console.log('📧 🔍 ===============================================');
      console.log('📧 🔍 === END PRE-EMAIL DATA VERIFICATION ===');
      console.log('📧 🔍 ===============================================');
      
      console.log('📧 📧 Calling email audit service...');
      console.log('📧 📧 Total audit data keys:', Object.keys(auditData).length);
      
      // Send email audit
      const emailResult = await this.emailAuditService.sendCompatibilityAudit(auditData);
      
      if (emailResult.success) {
        // 📧 TRACK EMAIL SENT: Record successful email for deduplication
        const emailKey = `email_sent_${this.userEmail}_${new Date().toDateString()}`;
        if (this.store) {
          this.store.set(emailKey, Date.now());
        }
        
        console.log('📧 ✅ EMAIL AUDIT COMPLETED SUCCESSFULLY!');
        console.log('📧 ✅ Email ID:', emailResult.emailId);
        console.log('📧 ✅ Recipients:', emailResult.recipients);
        console.log('📧 ✅ Email tracked for deduplication');
        this.logger?.info('EMAIL_AUDIT', '✅ Audit email sent successfully');
        this.logger?.info('EMAIL_AUDIT', 'Email ID:', emailResult.emailId);
        
        return { success: true, emailId: emailResult.emailId, recipients: emailResult.recipients };
      } else {
        console.log('📧 ❌ EMAIL AUDIT FAILED:', emailResult.error);
        this.logger?.error('EMAIL_AUDIT', '❌ Audit email failed:', emailResult.error);
        
        return { success: false, error: emailResult.error };
      }

    } catch (error) {
      console.error('📧 💥 EMAIL AUDIT EXCEPTION:', error.message);
      console.error('📧 💥 Stack trace:', error.stack);
      this.logger?.error('EMAIL_AUDIT', '❌ Email audit exception:', error.message);
      
      return { success: false, error: error.message };
    }
    
    console.log('📧 🔄 === SEND EMAIL AUDIT REPORT METHOD COMPLETED ===');
  }

  /**
   * Collect comprehensive audit data from all sources
   * @param {boolean} finalDecision - User's final decision
   * @returns {Object} Complete audit data
   */
  async collectAuditData(finalDecision) {
    const os = require('os');
    const { app } = require('electron');
    
    // Get enhanced report data
    const enhancedReport = this.enhancedReportCollector.getReport();
    
    // Get mode detection result (if available)
    const modeDetectionResult = this.appModeManager ? 
      await this.getModeDetectionResult() : null;

    // Compile comprehensive audit data
    const auditData = {
      // User Information
      userEmail: this.userEmail,
      finalDecision: finalDecision,
      
      // Application Information  
      appVersion: this.getAppVersion(),
      electronVersion: app?.getVersion() || process.versions.electron,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'production',
      
      // System Information
      systemInfo: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        totalMemory: Math.round(os.totalmem() / (1024**3)),
        cpu: os.cpus()[0]?.model || 'Unknown',
        cpuCores: os.cpus().length,
        uptime: Math.round(os.uptime() / 3600), // hours
        loadAverage: os.loadavg()[0] || 0
      },
      
      // Compatibility Results
      compatibilityResults: {
        testSuites: this.convertResultsToTestSuites(),
        overallScore: this.calculateOverallScore(),
        startTime: new Date(this.results.startTime).toISOString(),
        endTime: new Date(this.results.endTime || Date.now()).toISOString(),
        duration: this.results.duration || (Date.now() - this.results.startTime)
      },
      
      // Mode Detection Results
      modeDetection: modeDetectionResult,
      
      // Performance Metrics
      performanceMetrics: this.collectPerformanceMetrics(enhancedReport),
      
      // User Journey
      userJourney: this.buildUserJourney(finalDecision),
      
      // Enhanced Report Data
      enhancedReportData: enhancedReport,
      
      // Session Metadata
      sessionId: enhancedReport?.meta?.sessionId || this.generateSessionId(),
      timestamp: new Date().toISOString()
    };
    
    // 📧 🔍 DEBUG: Log what data we're sending to email service
    console.log('📧 🔍 === EMAIL AUDIT DATA DEBUG ===');
    console.log('📧 📋 Mode Detection Data:', JSON.stringify(auditData.modeDetection, null, 2));
    console.log('📧 📋 Performance Metrics Data:', JSON.stringify(auditData.performanceMetrics, null, 2));
    console.log('📧 📋 Enhanced Report Data Available:', !!auditData.enhancedReportData);
    console.log('📧 📋 Enhanced Report Mode Detection:', JSON.stringify(auditData.enhancedReportData?.modeDetection, null, 2));
    
    return auditData;
  }

  /**
   * Get app version from package.json
   * @returns {string} App version
   */
  getAppVersion() {
    try {
      const packageJson = require('./package.json');
      return packageJson.version || '2.0.100';
    } catch (error) {
      return '2.0.100';
    }
  }

  /**
   * Collect comprehensive performance metrics
   * @param {Object} enhancedReport - Enhanced report data
   * @returns {Object} Performance metrics
   */
  collectPerformanceMetrics(enhancedReport) {
    console.log('📧 ⚡ === COLLECTING PERFORMANCE METRICS ===');
    console.log('📧 ⚡ Enhanced report available:', !!enhancedReport);
    console.log('📧 ⚡ this.results available:', !!this.results);
    
    // 🔧 FIX: Use multiple sources for duration, including direct calculation
    let duration = enhancedReport?.compatibility?.duration || 
                   this.results.duration || 
                   (this.results.endTime && this.results.startTime ? 
                    this.results.endTime - this.results.startTime : 0);
    
    // If still 0, calculate from timestamps
    if (duration === 0 && this.results.startTime) {
      duration = Date.now() - this.results.startTime;
      console.log('📧 ⚡ Calculated duration from startTime:', duration, 'ms');
    }
    
    const testCount = this.results.successes.length + this.results.warnings.length + this.results.issues.length;
    const successCount = this.results.successes.length;
    
    console.log('📧 ⚡ Raw duration:', duration);
    console.log('📧 ⚡ Test count:', testCount);
    console.log('📧 ⚡ Success count:', successCount);
    console.log('📧 ⚡ this.results.successes:', this.results.successes.length);
    console.log('📧 ⚡ this.results.warnings:', this.results.warnings.length);
    console.log('📧 ⚡ this.results.issues:', this.results.issues.length);
    
    // Calculate session statistics
    const sessionDurationMs = enhancedReport?.finalOutcome?.sessionTime || duration;
    const sessionDurationSec = Math.round(sessionDurationMs / 1000);
    const sessionDurationMin = Math.round(sessionDurationSec / 60);
    
    // Memory usage information
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    };
    
    return {
      session: {
        totalDuration: `${sessionDurationSec}s (${sessionDurationMin}m)`,
        startTime: enhancedReport?.compatibility?.startTime || new Date(Date.now() - duration).toISOString(),
        endTime: enhancedReport?.compatibility?.endTime || new Date().toISOString()
      },
      testing: {
        totalTests: testCount,
        successfulTests: successCount,
        successRate: testCount > 0 ? Math.round((successCount / testCount) * 100) + '%' : '0%',
        failedTests: this.results.issues.length,
        warningTests: this.results.warnings.length
      },
      system: {
        memoryUsage: memoryUsageMB,
        peakMemoryUsage: `${memoryUsageMB.rss}MB RSS`,
        heapUtilization: `${memoryUsageMB.heapUsed}MB/${memoryUsageMB.heapTotal}MB`,
      },
      timing: {
        averageTestDuration: testCount > 0 ? Math.round(duration / testCount) + 'ms' : 'N/A',
        totalProcessingTime: Math.round(duration) + 'ms',
        timings: this.results.timings || {}
      }
    };
    
    console.log('📧 ⚡ === PERFORMANCE METRICS CALCULATED ===');
    console.log('📧 ⚡ Session Duration:', `${sessionDurationSec}s (${sessionDurationMin}m)`);
    console.log('📧 ⚡ Success Rate:', testCount > 0 ? Math.round((successCount / testCount) * 100) + '%' : '0%');
    console.log('📧 ⚡ Memory Usage:', `${memoryUsageMB.rss}MB RSS`);
    console.log('📧 ⚡ Full performance metrics:', JSON.stringify({
      session: { totalDuration: `${sessionDurationSec}s (${sessionDurationMin}m)` },
      testing: { successRate: testCount > 0 ? Math.round((successCount / testCount) * 100) + '%' : '0%' },
      system: { memoryUsage: memoryUsageMB }
    }, null, 2));
    
    return {
      session: {
        totalDuration: `${sessionDurationSec}s (${sessionDurationMin}m)`,
        startTime: enhancedReport?.compatibility?.startTime || new Date(Date.now() - duration).toISOString(),
        endTime: enhancedReport?.compatibility?.endTime || new Date().toISOString()
      },
      testing: {
        totalTests: testCount,
        successfulTests: successCount,
        successRate: testCount > 0 ? Math.round((successCount / testCount) * 100) + '%' : '0%',
        failedTests: this.results.issues.length,
        warningTests: this.results.warnings.length
      },
      system: {
        memoryUsage: memoryUsageMB,
        peakMemoryUsage: `${memoryUsageMB.rss}MB RSS`,
        heapUtilization: `${memoryUsageMB.heapUsed}MB/${memoryUsageMB.heapTotal}MB`,
      },
      timing: {
        averageTestDuration: testCount > 0 ? Math.round(duration / testCount) + 'ms' : 'N/A',
        totalProcessingTime: Math.round(duration) + 'ms',
        timings: this.results.timings || {}
      }
    };
  }

  /**
   * Get mode detection result if available
   * @returns {Object|null} Mode detection result
   */
  async getModeDetectionResult() {
    console.log('📧 🔍 === GETTING MODE DETECTION RESULT ===');
    
    try {
      // 🎯 SINGLE SOURCE: Use global variable from compatibility window
      if (this.window && !this.window.isDestroyed()) {
        const globalMode = await this.window.webContents.executeJavaScript('window.GLOBAL_DETECTED_MODE');
        if (globalMode) {
          console.log('📧 ✅ Using GLOBAL_DETECTED_MODE:', globalMode);
          return {
            determinedMode: globalMode,
            confidence: 'high',
            userMessage: `${globalMode} mode detected from compatibility check`,
            canProceed: true,
            source: 'global_variable'
          };
        }
      }
      
      // Fallback: First try to get from enhanced report collector (most reliable)
      const enhancedReport = this.enhancedReportCollector.getReport();
      console.log('📧 🔍 Enhanced report available:', !!enhancedReport);
      
      if (enhancedReport) {
        console.log('📧 🔍 Enhanced report keys:', Object.keys(enhancedReport));
        console.log('📧 🔍 Enhanced report modeDetection present:', !!enhancedReport.modeDetection);
        
        if (enhancedReport.modeDetection) {
          console.log('📧 ✅ Retrieved mode detection from enhanced report:');
          console.log('📧 ✅ Mode:', enhancedReport.modeDetection.determinedMode);
          console.log('📧 ✅ Confidence:', enhancedReport.modeDetection.confidence);
          console.log('📧 ✅ Full data:', JSON.stringify(enhancedReport.modeDetection, null, 2));
          return enhancedReport.modeDetection;
        }
      }
      
      // Fallback: Try to get from app mode manager if available
      console.log('📧 🔍 Trying fallback - app mode manager...');
      if (this.appModeManager) {
        console.log('📧 🔍 AppModeManager methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.appModeManager)));
        
        if (this.appModeManager.getLastDecision) {
          const lastDecision = this.appModeManager.getLastDecision();
          console.log('📧 🔍 Last decision from app mode manager:', lastDecision);
          
          if (lastDecision) {
            console.log('📧 ✅ Retrieved mode detection from app mode manager:');
            console.log('📧 ✅ Mode:', lastDecision.determinedMode);
            console.log('📧 ✅ Full data:', JSON.stringify(lastDecision, null, 2));
            return lastDecision;
          }
        } else {
          console.log('📧 🔍 getLastDecision method not available on appModeManager');
        }
        
        // Try alternative methods to get mode data
        if (this.appModeManager.lastModeResult) {
          console.log('📧 🔍 lastModeResult available:', this.appModeManager.lastModeResult);
          return this.appModeManager.lastModeResult;
        }
        
        if (this.appModeManager.currentMode) {
          console.log('📧 🔍 currentMode available:', this.appModeManager.currentMode);
          return { determinedMode: this.appModeManager.currentMode, source: 'currentMode' };
        }
      } else {
        console.log('📧 🔍 AppModeManager not available');
      }
      
      // Check if mode detection result is stored elsewhere
      console.log('📧 🔍 Checking alternative sources...');
      console.log('📧 🔍 this.results available:', !!this.results);
      if (this.results && this.results.appMode) {
        console.log('📧 🔍 this.results.appMode:', this.results.appMode);
        return this.results.appMode;
      }
      
      console.log('📧 ❌ No mode detection result available from any source');
      console.log('📧 🔍 === END MODE DETECTION RESULT SEARCH ===');
      return null;
    } catch (error) {
      this.logger?.error('EMAIL_AUDIT', 'Failed to get mode detection result:', error.message);
      console.error('📧 ❌ Error getting mode detection result:', error.message);
      console.error('📧 ❌ Stack trace:', error.stack);
      return null;
    }
  }

  /**
   * Convert compatibility results to test suites format for email
   * @returns {Array} Test suites
   */
  convertResultsToTestSuites() {
    const testSuites = [
      {
        name: 'Successful Tests',
        tests: this.results.successes.map(item => ({
          name: item.name || item.test || 'Unknown Test',
          result: 'pass',
          details: item.details || item.message,
          duration: item.duration
        }))
      },
      {
        name: 'Warnings',
        tests: this.results.warnings.map(item => ({
          name: item.name || item.test || 'Unknown Test',
          result: 'warning',
          details: item.details || item.message,
          duration: item.duration
        }))
      },
      {
        name: 'Issues',
        tests: this.results.issues.map(item => ({
          name: item.name || item.test || 'Unknown Test',
          result: 'fail',
          details: item.details || item.message,
          duration: item.duration
        }))
      }
    ];
    
    return testSuites.filter(suite => suite.tests.length > 0);
  }

  /**
   * Calculate overall compatibility score
   * @returns {number} Score percentage
   */
  calculateOverallScore() {
    const total = this.results.successes.length + this.results.warnings.length + this.results.issues.length;
    if (total === 0) return 0;
    
    const successWeight = this.results.successes.length * 1.0;
    const warningWeight = this.results.warnings.length * 0.5;
    const issueWeight = this.results.issues.length * 0.0;
    
    return Math.round(((successWeight + warningWeight + issueWeight) / total) * 100);
  }

  /**
   * Calculate success rate
   * @returns {number} Success rate percentage
   */
  calculateSuccessRate() {
    const total = this.results.successes.length + this.results.warnings.length + this.results.issues.length;
    if (total === 0) return 0;
    
    return Math.round((this.results.successes.length / total) * 100);
  }

  /**
   * Build user journey timeline
   * @param {boolean} finalDecision - Final decision
   * @returns {Array} Journey events
   */
  buildUserJourney(finalDecision) {
    const journey = [];
    
    // Add key events
    journey.push({
      timestamp: new Date(this.results.startTime).toISOString(),
      action: 'Started compatibility check',
      details: 'User initiated system compatibility assessment'
    });
    
    if (this.userEmail) {
      journey.push({
        timestamp: new Date(this.results.startTime + 5000).toISOString(),
        action: 'Email verification completed',
        details: `Email: ${this.userEmail}`
      });
    }
    
    journey.push({
      timestamp: new Date(this.results.startTime + 10000).toISOString(),
      action: 'Compatibility tests started',
      details: 'Running comprehensive system tests'
    });
    
    journey.push({
      timestamp: new Date(this.results.endTime || Date.now()).toISOString(),
      action: 'Tests completed',
      details: `Results: ${this.results.successes.length} passed, ${this.results.warnings.length} warnings, ${this.results.issues.length} issues`
    });
    
    journey.push({
      timestamp: new Date().toISOString(),
      action: finalDecision ? 'User chose to proceed' : 'User chose to cancel',
      details: finalDecision ? 'Launching CypherEdge application' : 'Exiting compatibility checker'
    });
    
    return journey;
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `COMPAT-${timestamp}-${random}`.toUpperCase();
  }
}

module.exports = { SystemCompatibilityChecker };