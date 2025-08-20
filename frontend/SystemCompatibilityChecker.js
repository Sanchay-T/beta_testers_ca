// SystemCompatibilityChecker.js
const { BrowserWindow, app, ipcMain } = require("electron");
const path = require("path");
const log = require("electron-log");
const { CompatibilityTests } = require("./compatibility/CompatibilityTests");
const { ReportGenerator } = require("./compatibility/ReportGenerator");
const { CompatibilityLogger } = require("./compatibility/CompatibilityLogger");
const { DetailedReportGenerator } = require("./compatibility/DetailedReportGenerator");

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
    this.userDecision = null;
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

    try {
      // Step 1: Create the compatibility checker window
      await this.createCompatibilityWindow();

      // Initialize tests with logger and window reference (after window is created)
      this.tests = new CompatibilityTests(this.logger, this.window);
      this.reportGenerator = new ReportGenerator(this.logger);
      this.detailedReportGenerator = new DetailedReportGenerator(this.logger);

      // Step 2: Wait for user to start tests
      const userDecision = await this.waitForUserDecision();

      // Step 3: Finalize and cleanup
      this.results.endTime = Date.now();
      this.results.duration = this.results.endTime - this.results.startTime;

      if (this.window && !this.window.isDestroyed()) {
        this.window.close();
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

      return { 
        canProceed: userDecision, 
        results: this.results,
        sessionSummary,
        logPaths: this.logger.getLogPaths(),
        reportPath
      };
    } catch (error) {
      this.logger.critical('SESSION_ERROR', 'Compatibility check failed', { error: error.message, stack: error.stack });
      log.error("💥 [COMPAT] Compatibility check failed:", error);
      
      if (this.window && !this.window.isDestroyed()) {
        this.window.close();
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
      resizable: false,
      frame: false,  // Completely frameless
      transparent: false,
      alwaysOnTop: true,
      show: true,  // Show immediately
      focusable: true,
      skipTaskbar: false,
      titleBarStyle: 'hidden',  // Hide title bar on macOS
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false,
      },
      icon: path.join(__dirname, "assets", "cyphersol-icon.png"),
      title: "CypherEdge Compatibility Check",
      backgroundColor: '#f0f4f8',
      thickFrame: false,  // Remove thick frame on Windows
      hasShadow: false,   // Remove drop shadow
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
    // Auto-start tests after 5 seconds if user doesn't click Continue
    setTimeout(() => {
      if (this.window && !this.window.isDestroyed() && this.userDecision === null) {
        this.logger.info('AUTO_START', 'Auto-starting compatibility tests after 5 second delay');
        log.info("🤖 [COMPAT] Auto-starting compatibility tests after 5 second delay");
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
    }, 5000);

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

    // Clean up IPC handlers when done
    this.cleanupIPC = () => {
      ipcMain.removeHandler("compatibility:start-tests");
      ipcMain.removeHandler("compatibility:user-decision");
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

        // Notify React UI that test is starting
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send("test-progress", {
            suiteName: suite.name,
            testName: test.name,
            status: "testing",
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

        // Send result to React UI
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send("test-progress", {
            suiteName: suite.name,
            testName: test.name,
            status,
            message,
            details,
            duration,
          });
        }

        log.info(`  ${status === 'success' ? '✅' : status === 'warning' ? '⚠️' : '❌'} [COMPAT] ${test.name}: ${status.toUpperCase()}`);
        
        // Small delay between tests for UI smoothness and system resource management
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Calculate overall compatibility
    this.results.canProceed = this.calculateCompatibility();

    // Send completion signal to React UI
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send("compatibility-complete", this.results);
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

          resolve(finalDecision);
        } else {
          // Check again in 100ms
          setTimeout(checkDecision, 100);
        }
      };

      checkDecision();
    });
  }
}

module.exports = { SystemCompatibilityChecker };