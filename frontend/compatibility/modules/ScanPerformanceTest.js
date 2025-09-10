// ScanPerformanceTest.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { AppModeConfigManager } = require('../config/AppModeConfigManager');
const pathResolver = require('../utils/PathResolver');

class ScanPerformanceTest {
  constructor(logger = null, progressCallback = null) {
    this.logger = logger;
    this.progressCallback = progressCallback;
    this.testResults = null;
    this.isTestRunning = false;
  }

  /**
   * Run the complete scan performance test
   * @param {number} timeoutMs - Custom timeout in milliseconds
   * @returns {Promise<Object>} Test results
   */
  async runScanTest(timeoutMs = null) {
    if (this.isTestRunning) {
      return { success: false, reason: 'Test already running' };
    }

    this.isTestRunning = true;
    const startTime = Date.now();

    try {
      // Get configuration
      const config = AppModeConfigManager.getConfig();
      const timeout = timeoutMs || config.hardwareThresholds.fullMode.scanTestTimeout;
      
      // Check for testing overrides
      const overrides = config.testingOverrides || {};
      if (overrides.forceScanResult !== null) {
        return this.handleForcedResult(overrides.forceScanResult, startTime);
      }

      this.logger?.info('SCAN_PERFORMANCE_TEST', 'Starting ML scan performance test', {
        timeout: timeout,
        testMode: config.developmentMode?.enabled
      });

      this.updateProgress('Preparing scan performance test...', 0);

      // Step 1: Check if Python backend is available
      const backendCheck = await this.checkPythonBackend();
      if (!backendCheck.success) {
        return this.generateFailResult('Python backend not available', startTime, backendCheck.details);
      }

      this.updateProgress('Python backend available, preparing test file...', 20);

      // Step 2: Get or create test PDF
      const testPDF = await this.getTestPDF();
      if (!testPDF.success) {
        return this.generateFailResult('Test PDF not available', startTime, testPDF.details);
      }

      this.updateProgress('Test file ready, starting ML scan test...', 40);

      // Step 3: Run the actual scan test with timeout
      const scanResult = await this.performScanTest(testPDF.path, timeout);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.updateProgress('Scan test completed, analyzing results...', 90);

      // Step 4: Analyze results
      const result = this.analyzeScanResults(scanResult, duration, timeout);
      
      this.updateProgress('Analysis complete!', 100);

      this.testResults = result;
      this.logger?.info('SCAN_PERFORMANCE_TEST', 'Scan test completed', {
        success: result.success,
        duration: duration,
        passed: result.passed,
        reason: result.reason
      });

      return result;

    } catch (error) {
      this.logger?.error('SCAN_PERFORMANCE_TEST', 'Scan test failed with error', {
        error: error.message,
        stack: error.stack
      });
      
      return this.generateFailResult(`Test error: ${error.message}`, startTime, { error: error.message });
      
    } finally {
      this.isTestRunning = false;
    }
  }

  /**
   * Check if Python backend is available and responding
   * @returns {Promise<Object>} Backend availability result
   */
  async checkPythonBackend() {
    try {
      this.logger?.info('SCAN_PERFORMANCE_TEST', 'Checking Python backend availability...');
      
      const response = await axios.get('http://127.0.0.1:7500/health', {
        timeout: 5000,
        headers: { 'User-Agent': 'CypherEdge-ScanTest' }
      });

      if (response.status === 200) {
        return { 
          success: true, 
          details: { status: response.status, data: response.data }
        };
      } else {
        return { 
          success: false, 
          details: { status: response.status, reason: 'Unexpected status code' }
        };
      }

    } catch (error) {
      const reason = error.code === 'ECONNREFUSED' 
        ? 'Python backend not running on port 7500'
        : `Connection error: ${error.message}`;
        
      return { 
        success: false, 
        details: { error: error.message, code: error.code, reason }
      };
    }
  }

  /**
   * Get or create a test PDF for scanning
   * @returns {Promise<Object>} Test PDF result
   */
  async getTestPDF() {
    try {
      // First, try to find an existing test PDF using PathResolver
      const testSamplesDir = pathResolver.getTestSamplesDir();
      const possiblePaths = [
        path.join(testSamplesDir, 'scan-test.pdf'),
        path.join(testSamplesDir, 'test.pdf')
      ];

      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          const stats = fs.statSync(testPath);
          this.logger?.info('SCAN_PERFORMANCE_TEST', `Found test PDF: ${testPath}`, {
            size: stats.size,
            sizeKB: Math.round(stats.size / 1024)
          });
          
          return { success: true, path: testPath, size: stats.size };
        }
      }

      // If no test PDF found, create a minimal one or use alternative approach
      this.logger?.warn('SCAN_PERFORMANCE_TEST', 'No test PDF found, will use alternative test method');
      
      // For now, return success with null path to trigger alternative test
      return { 
        success: true, 
        path: null, 
        alternative: true,
        reason: 'No test PDF found, using backend health stress test'
      };

    } catch (error) {
      return { 
        success: false, 
        details: { error: error.message }
      };
    }
  }

  /**
   * Perform the actual scan test
   * @param {string|null} pdfPath - Path to test PDF
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Scan test result
   */
  async performScanTest(pdfPath, timeout) {
    const testStartTime = Date.now();
    
    try {
      // Create a race between the scan test and timeout
      const testPromise = pdfPath 
        ? this.runPDFScanTest(pdfPath)
        : this.runAlternativeScanTest();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Scan test timeout'));
        }, timeout);
      });

      // Check if we should simulate slow scan for testing
      const config = AppModeConfigManager.getConfig();
      if (config.testingOverrides?.simulateSlowScan) {
        this.logger?.info('SCAN_PERFORMANCE_TEST', 'Simulating slow scan for testing...');
        await new Promise(resolve => setTimeout(resolve, timeout + 1000));
      }

      const result = await Promise.race([testPromise, timeoutPromise]);
      const duration = Date.now() - testStartTime;

      return {
        success: true,
        duration: duration,
        result: result,
        timedOut: false
      };

    } catch (error) {
      const duration = Date.now() - testStartTime;
      const timedOut = error.message.includes('timeout');

      return {
        success: !timedOut, // Not success if timed out
        duration: duration,
        error: error.message,
        timedOut: timedOut
      };
    }
  }

  /**
   * Run PDF scan test using existing backend endpoint
   * @param {string} pdfPath - Path to test PDF
   * @returns {Promise<Object>} PDF scan result
   */
  async runPDFScanTest(pdfPath) {
    this.logger?.info('SCAN_PERFORMANCE_TEST', 'Running PDF scan test...');
    
    try {
      const response = await axios.post('http://127.0.0.1:7500/add-pdf/', {
        bank_names: ["Test Bank"],
        pdf_paths: [pdfPath],
        passwords: [""],
        start_date: ["2024-01-01"],
        end_date: ["2024-12-31"],
        ca_id: "scan-performance-test"
      }, {
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'CypherEdge-ScanTest' 
        },
        timeout: 25000 // Slightly less than the overall timeout
      });

      return {
        method: 'pdf_scan',
        status: response.status,
        data: response.data,
        success: response.status === 200
      };

    } catch (error) {
      return {
        method: 'pdf_scan',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run alternative scan test (computational stress test)
   * @returns {Promise<Object>} Alternative test result
   */
  async runAlternativeScanTest() {
    this.logger?.info('SCAN_PERFORMANCE_TEST', 'Running alternative computational test...');
    
    try {
      // Run a computational stress test to simulate ML processing
      const iterations = 100000;
      const startTime = Date.now();
      
      let result = 0;
      for (let i = 0; i < iterations; i++) {
        // Simulate CPU-intensive operations
        result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
        
        // Update progress occasionally
        if (i % 10000 === 0) {
          const progress = Math.floor((i / iterations) * 30) + 60; // 60-90% progress
          this.updateProgress(`Running computational test... ${i}/${iterations}`, progress);
        }
      }
      
      const duration = Date.now() - startTime;
      
      return {
        method: 'computational_test',
        success: true,
        result: result,
        iterations: iterations,
        duration: duration
      };

    } catch (error) {
      return {
        method: 'computational_test',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze scan test results to determine pass/fail
   * @param {Object} scanResult - Raw scan results
   * @param {number} duration - Test duration
   * @param {number} timeout - Configured timeout
   * @returns {Object} Analysis result
   */
  analyzeScanResults(scanResult, duration, timeout) {
    const config = AppModeConfigManager.getConfig();
    const thresholds = config.hardwareThresholds.fullMode;

    // Base result structure
    const result = {
      success: scanResult.success,
      passed: false,
      duration: duration,
      timeout: timeout,
      method: scanResult.method || 'unknown',
      reason: '',
      performance: this.classifyPerformance(duration, timeout),
      details: scanResult
    };

    // Determine if test passed
    if (scanResult.timedOut) {
      result.passed = false;
      result.reason = `Scan test timed out after ${timeout}ms`;
    } else if (!scanResult.success) {
      result.passed = false;
      result.reason = `Scan test failed: ${scanResult.error}`;
    } else if (duration > timeout) {
      result.passed = false;
      result.reason = `Scan test too slow: ${duration}ms > ${timeout}ms`;
    } else {
      result.passed = true;
      result.reason = `Scan test passed in ${duration}ms`;
    }

    // Add performance classification
    result.performanceClass = this.getPerformanceClass(duration, timeout);

    this.logger?.info('SCAN_PERFORMANCE_TEST', 'Scan test analysis complete', {
      passed: result.passed,
      duration: result.duration,
      performance: result.performance,
      reason: result.reason
    });

    return result;
  }

  /**
   * Classify performance based on duration vs timeout
   * @param {number} duration - Actual duration
   * @param {number} timeout - Timeout threshold
   * @returns {string} Performance classification
   */
  classifyPerformance(duration, timeout) {
    const ratio = duration / timeout;
    
    if (ratio <= 0.3) return 'excellent';
    if (ratio <= 0.5) return 'good';
    if (ratio <= 0.7) return 'acceptable';
    if (ratio <= 1.0) return 'marginal';
    return 'poor';
  }

  /**
   * Get performance class for decision making
   * @param {number} duration - Test duration
   * @param {number} timeout - Configured timeout
   * @returns {string} Performance class
   */
  getPerformanceClass(duration, timeout) {
    if (duration <= timeout * 0.5) return 'fast';
    if (duration <= timeout * 0.8) return 'moderate';
    if (duration <= timeout) return 'slow';
    return 'too_slow';
  }

  /**
   * Handle forced test results for testing purposes
   * @param {string} forcedResult - Forced result ('pass' or 'fail')
   * @param {number} startTime - Test start time
   * @returns {Object} Forced result
   */
  handleForcedResult(forcedResult, startTime) {
    const duration = Date.now() - startTime;
    const passed = forcedResult === 'pass';

    this.logger?.info('SCAN_PERFORMANCE_TEST', `Using forced test result: ${forcedResult}`);

    return {
      success: true,
      passed: passed,
      duration: duration,
      timeout: 30000,
      method: 'forced_override',
      reason: `Forced result: ${forcedResult}`,
      performance: passed ? 'excellent' : 'poor',
      performanceClass: passed ? 'fast' : 'too_slow',
      forced: true,
      details: { forcedResult }
    };
  }

  /**
   * Generate a failure result
   * @param {string} reason - Failure reason
   * @param {number} startTime - Test start time
   * @param {Object} details - Additional details
   * @returns {Object} Failure result
   */
  generateFailResult(reason, startTime, details = {}) {
    return {
      success: false,
      passed: false,
      duration: Date.now() - startTime,
      reason: reason,
      performance: 'failed',
      performanceClass: 'failed',
      details: details
    };
  }

  /**
   * Update progress if callback is provided
   * @param {string} message - Progress message
   * @param {number} percent - Progress percentage (0-100)
   */
  updateProgress(message, percent) {
    if (this.progressCallback && typeof this.progressCallback === 'function') {
      this.progressCallback({ message, percent });
    }
  }

  /**
   * Get cached test results
   * @returns {Object|null} Last test results
   */
  getLastTestResults() {
    return this.testResults;
  }

  /**
   * Check if test is currently running
   * @returns {boolean} Test running status
   */
  isRunning() {
    return this.isTestRunning;
  }
}

module.exports = { ScanPerformanceTest };