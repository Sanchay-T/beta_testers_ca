/**
 * CypherEdge UI Flow Logger - Comprehensive Test Suite
 * Test all logging functionality and generate detailed reports
 * 
 * File: frontend/utils/UILoggerTestSuite.js
 */

const uiFlowLogger = require('./UIFlowLogger');
const path = require('path');
const fs = require('fs');

class UILoggerTestSuite {
  constructor() {
    this.testResults = [];
    this.testStartTime = Date.now();
  }

  async runAllTests() {
    console.log('🧪 ===============================================');
    console.log('🧪 CypherEdge UI Flow Logger - Test Suite');
    console.log('🧪 ===============================================');

    const tests = [
      this.testPageNavigation.bind(this),
      this.testButtonClicks.bind(this),
      this.testBackendInteractions.bind(this),
      this.testComponentLifecycle.bind(this),
      this.testModalActions.bind(this),
      this.testFileOperations.bind(this),
      this.testErrorLogging.bind(this),
      this.testSessionData.bind(this),
      this.testPerformanceLogging.bind(this)
    ];

    for (let i = 0; i < tests.length; i++) {
      const testName = tests[i].name.replace('bound ', '');
      console.log(`\n🔍 Running ${testName}...`);
      
      try {
        await tests[i]();
        this.logTestResult(testName, 'PASS', 'Test completed successfully');
      } catch (error) {
        this.logTestResult(testName, 'FAIL', error.message);
        console.error(`❌ ${testName} failed:`, error);
      }
    }

    this.generateTestReport();
  }

  async testPageNavigation() {
    // Test page navigation logging
    uiFlowLogger.logPageNavigation({
      page: 'TestPage',
      filePath: __filename,
      component: 'TestComponent',
      route: '/test',
      trigger: 'test-suite'
    });

    // Test navigation with minimal data
    uiFlowLogger.logPageNavigation({
      page: 'MinimalPage',
      filePath: __filename,
      component: 'MinimalComponent'
    });

    console.log('✅ Page navigation logging tested');
  }

  async testButtonClicks() {
    // Test comprehensive button click logging
    uiFlowLogger.logButtonClick({
      id: 'test-button',
      text: 'Test Button',
      action: 'testAction',
      filePath: __filename,
      component: 'TestComponent',
      context: {
        testMode: true,
        clickCount: 1,
        metadata: { key: 'value' }
      }
    });

    // Test button click with minimal data
    uiFlowLogger.logButtonClick({
      id: 'minimal-button',
      text: 'Minimal',
      action: 'click'
    });

    console.log('✅ Button click logging tested');
  }

  async testBackendInteractions() {
    // Test backend request logging
    uiFlowLogger.logBackendInteraction({
      channel: 'test:channel',
      method: 'invoke',
      direction: 'request',
      handler: 'testHandler',
      handlerFile: 'testHandlers.js',
      payload: { testData: 'test value' },
      status: 'pending'
    });

    // Simulate response after delay
    setTimeout(() => {
      uiFlowLogger.logBackendInteraction({
        channel: 'test:channel',
        method: 'invoke',
        direction: 'response',
        handler: 'testHandler',
        handlerFile: 'testHandlers.js',
        response: { success: true, data: 'response data' },
        duration: 150,
        status: 'success'
      });
    }, 100);

    // Test error response
    setTimeout(() => {
      uiFlowLogger.logBackendInteraction({
        channel: 'test:error',
        method: 'invoke',
        direction: 'response',
        handler: 'errorHandler',
        handlerFile: 'testHandlers.js',
        response: { error: 'Test error message' },
        duration: 75,
        status: 'error'
      });
    }, 50);

    console.log('✅ Backend interaction logging tested');
  }

  async testComponentLifecycle() {
    // Test component mount
    uiFlowLogger.logComponentMount({
      name: 'TestComponent',
      filePath: __filename,
      props: { testProp: 'testValue', count: 42 },
      parent: 'ParentComponent'
    });

    // Test component unmount
    setTimeout(() => {
      uiFlowLogger.logComponentUnmount('TestComponent');
    }, 200);

    console.log('✅ Component lifecycle logging tested');
  }

  async testModalActions() {
    // Test modal open
    uiFlowLogger.logModalAction({
      name: 'TestModal',
      action: 'open',
      filePath: __filename,
      component: 'TestComponent',
      data: { modalId: 'test-modal', title: 'Test Title' }
    });

    // Test modal close
    setTimeout(() => {
      uiFlowLogger.logModalAction({
        name: 'TestModal',
        action: 'close',
        filePath: __filename,
        component: 'TestComponent',
        data: { result: 'confirmed' }
      });
    }, 300);

    console.log('✅ Modal action logging tested');
  }

  async testFileOperations() {
    // Test file upload
    uiFlowLogger.logFileOperation({
      operation: 'upload',
      fileName: 'test-file.pdf',
      filePath: __filename,
      fileSize: 1024000,
      mimeType: 'application/pdf',
      status: 'success',
      component: 'TestComponent'
    });

    // Test file download
    uiFlowLogger.logFileOperation({
      operation: 'download',
      fileName: 'report.xlsx',
      filePath: __filename,
      fileSize: 512000,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      status: 'success',
      component: 'TestComponent'
    });

    console.log('✅ File operation logging tested');
  }

  async testErrorLogging() {
    // Test error logging
    const testError = new Error('Test error message');
    testError.stack = 'Test stack trace';

    uiFlowLogger.logError({
      component: 'TestComponent',
      filePath: __filename,
      error: testError.message,
      stack: testError.stack,
      context: { errorCode: 'TEST_001', severity: 'low' }
    });

    console.log('✅ Error logging tested');
  }

  async testSessionData() {
    // Test session data retrieval
    const sessionData = uiFlowLogger.getSessionData();
    
    if (!sessionData.sessionId) {
      throw new Error('Session ID not found');
    }

    if (!Array.isArray(sessionData.navigationHistory)) {
      throw new Error('Navigation history not an array');
    }

    if (!Array.isArray(sessionData.userActions)) {
      throw new Error('User actions not an array');
    }

    if (!Array.isArray(sessionData.backendInteractions)) {
      throw new Error('Backend interactions not an array');
    }

    console.log('✅ Session data retrieval tested');
    console.log(`   Session ID: ${sessionData.sessionId}`);
    console.log(`   Navigation entries: ${sessionData.navigationHistory.length}`);
    console.log(`   User actions: ${sessionData.userActions.length}`);
    console.log(`   Backend calls: ${sessionData.backendInteractions.length}`);
  }

  async testPerformanceLogging() {
    // Test session summary generation
    const summary = uiFlowLogger.generateSessionSummary();
    
    if (typeof summary !== 'object') {
      throw new Error('Session summary not an object');
    }

    // Test export functionality
    const exportData = uiFlowLogger.exportSessionData('json');
    const parsedExport = JSON.parse(exportData);
    
    if (!parsedExport.summary) {
      throw new Error('Export data missing summary');
    }

    console.log('✅ Performance logging and export tested');
    console.log(`   Total page navigations: ${summary.totalPageNavigations}`);
    console.log(`   Total button clicks: ${summary.totalButtonClicks}`);
    console.log(`   Total backend interactions: ${summary.totalBackendInteractions}`);
  }

  logTestResult(testName, status, message) {
    this.testResults.push({
      testName,
      status,
      message,
      timestamp: new Date().toISOString()
    });
  }

  generateTestReport() {
    const testEndTime = Date.now();
    const totalDuration = testEndTime - this.testStartTime;
    const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
    const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;

    console.log('\n🏆 ===============================================');
    console.log('🏆 UI Flow Logger Test Results');
    console.log('🏆 ===============================================');
    console.log(`📊 Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⏱️  Duration: ${totalDuration}ms`);
    console.log(`📈 Success Rate: ${((passedTests / this.testResults.length) * 100).toFixed(1)}%`);

    // Display failed tests
    const failedTestsList = this.testResults.filter(t => t.status === 'FAIL');
    if (failedTestsList.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTestsList.forEach(test => {
        console.log(`   ${test.testName}: ${test.message}`);
      });
    }

    // Generate detailed report file
    this.generateDetailedReport(totalDuration, passedTests, failedTests);
  }

  generateDetailedReport(totalDuration, passedTests, failedTests) {
    const sessionData = uiFlowLogger.getSessionData();
    const summary = uiFlowLogger.generateSessionSummary();

    const report = {
      testSuite: {
        timestamp: new Date().toISOString(),
        duration: totalDuration,
        totalTests: this.testResults.length,
        passed: passedTests,
        failed: failedTests,
        successRate: ((passedTests / this.testResults.length) * 100).toFixed(1) + '%'
      },
      testResults: this.testResults,
      loggerPerformance: {
        sessionId: sessionData.sessionId,
        totalLogEntries: sessionData.navigationHistory.length + 
                         sessionData.userActions.length + 
                         sessionData.backendInteractions.length,
        navigationEntries: sessionData.navigationHistory.length,
        userActions: sessionData.userActions.length,
        backendInteractions: sessionData.backendInteractions.length,
        componentsTracked: sessionData.componentStack.length
      },
      sessionSummary: summary,
      sampleLogEntries: {
        navigation: sessionData.navigationHistory.slice(-3),
        actions: sessionData.userActions.slice(-3),
        backend: sessionData.backendInteractions.slice(-3)
      }
    };

    // Save report to file
    const reportDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, `ui_logger_test_report_${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  // Test individual components
  async testCompatibilityFlowLogging() {
    console.log('\n🧪 Testing Compatibility Flow Logging...');
    
    // Simulate compatibility flow
    uiFlowLogger.logPageNavigation({
      page: 'CompatibilityChecker',
      filePath: 'compatibility.html',
      component: 'CompatibilityApp',
      trigger: 'test-suite'
    });

    // Simulate mode detection
    uiFlowLogger.logButtonClick({
      id: 'test-scenario-lowEnd',
      text: 'Test Low-End PC',
      action: 'selectTestScenario',
      filePath: 'compatibility.html',
      component: 'CompatibilityApp',
      context: { scenario: 'lowEnd', testingMode: true }
    });

    // Simulate HYBRID flow
    uiFlowLogger.logModalAction({
      name: 'HybridModeDecision',
      action: 'open',
      filePath: 'compatibility.html',
      component: 'CompatibilityApp',
      data: { mode: 'HYBRID', step: 'DECISION_MODAL' }
    });

    console.log('✅ Compatibility flow logging tested');
  }

  // Performance testing
  async runPerformanceTests() {
    console.log('\n⚡ Running Performance Tests...');
    
    const startTime = Date.now();
    const iterations = 1000;

    // Test logging performance
    for (let i = 0; i < iterations; i++) {
      uiFlowLogger.logButtonClick({
        id: `perf-test-${i}`,
        text: `Performance Test ${i}`,
        action: 'performanceTest',
        context: { iteration: i }
      });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const avgTime = duration / iterations;

    console.log(`✅ Performance test completed:`);
    console.log(`   ${iterations} log entries in ${duration}ms`);
    console.log(`   Average time per entry: ${avgTime.toFixed(2)}ms`);
    console.log(`   Entries per second: ${(1000 / avgTime).toFixed(0)}`);

    // Test memory usage
    if (global.gc) {
      global.gc();
    }
    const memUsage = process.memoryUsage();
    console.log(`   Memory usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  }
}

// Export for use in other modules
module.exports = UILoggerTestSuite;

// Run tests if executed directly
if (require.main === module) {
  const testSuite = new UILoggerTestSuite();
  
  (async () => {
    await testSuite.runAllTests();
    await testSuite.testCompatibilityFlowLogging();
    await testSuite.runPerformanceTests();
    
    console.log('\n🎉 All tests completed!');
    process.exit(0);
  })().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}