// test-compatibility-logging.js
// Test script to run the System Compatibility Checker with comprehensive logging
// This will demonstrate the entire flow from start to finish

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Ensure Electron is ready
app.whenReady().then(async () => {
  console.log('\n========================================');
  console.log('COMPATIBILITY CHECKER LOGGING TEST');
  console.log('========================================\n');
  
  try {
    // Import the System Compatibility Checker
    const { SystemCompatibilityChecker } = require('./SystemCompatibilityChecker');
    
    // Configure enhanced logging
    const loggerOptions = {
      enableConsole: true,  // Show logs in console
      enableFile: true,     // Write to files
      logLevel: 'DEBUG'     // Capture all details
    };
    
    console.log('📋 Starting System Compatibility Checker with comprehensive logging...\n');
    console.log(`📁 Logs will be saved to: ${path.join(__dirname, 'compatibility', 'log')}\n`);
    
    // Create the compatibility checker instance
    const compatChecker = new SystemCompatibilityChecker(loggerOptions);
    
    // Run the full compatibility check
    const startTime = Date.now();
    const result = await compatChecker.runFullCheck();
    const duration = Date.now() - startTime;
    
    console.log('\n========================================');
    console.log('COMPATIBILITY CHECK COMPLETE');
    console.log('========================================');
    console.log(`⏱️  Total Duration: ${duration}ms`);
    console.log(`✅ Can Proceed: ${result.canProceed}`);
    console.log(`📊 Results Summary:`);
    console.log(`   - Successes: ${result.results.successes.length}`);
    console.log(`   - Warnings: ${result.results.warnings.length}`);
    console.log(`   - Issues: ${result.results.issues.length}`);
    
    // Display log file locations
    if (result.logPaths) {
      console.log('\n📁 LOG FILES GENERATED:');
      console.log('========================================');
      
      // Check if files exist and show their sizes
      Object.entries(result.logPaths).forEach(([key, path]) => {
        if (path && fs.existsSync(path)) {
          const stats = fs.statSync(path);
          const sizeKB = Math.round(stats.size / 1024 * 100) / 100;
          console.log(`${key.padEnd(15)} : ${path}`);
          console.log(`${''.padEnd(15)}   Size: ${sizeKB} KB`);
        }
      });
      
      console.log('\n🔍 COMPREHENSIVE FLOW LOG:');
      console.log('========================================');
      
      // Read and display a snippet of the flow log
      if (result.logPaths.flowLog && fs.existsSync(result.logPaths.flowLog)) {
        const flowLogContent = fs.readFileSync(result.logPaths.flowLog, 'utf8');
        const lines = flowLogContent.split('\n');
        
        // Show first 20 lines and last 20 lines
        console.log('\n--- FLOW LOG START (First 20 lines) ---');
        lines.slice(0, 20).forEach(line => console.log(line));
        
        if (lines.length > 40) {
          console.log('\n... [Middle content omitted] ...\n');
          console.log('--- FLOW LOG END (Last 20 lines) ---');
          lines.slice(-20).forEach(line => console.log(line));
        } else if (lines.length > 20) {
          console.log('\n--- FLOW LOG CONTINUED ---');
          lines.slice(20).forEach(line => console.log(line));
        }
      }
    }
    
    // Display test details if available
    if (result.results.issues.length > 0) {
      console.log('\n⚠️  ISSUES FOUND:');
      console.log('========================================');
      result.results.issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.test}`);
        console.log(`   Message: ${issue.message}`);
        if (issue.details?.recommendation) {
          console.log(`   Recommendation: ${issue.details.recommendation}`);
        }
      });
    }
    
    if (result.results.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      console.log('========================================');
      result.results.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.test}`);
        console.log(`   Message: ${warning.message}`);
      });
    }
    
    console.log('\n========================================');
    console.log('TEST COMPLETE - Check log files for full details');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Wait a moment for logs to flush, then quit
    setTimeout(() => {
      console.log('Exiting test runner...');
      app.quit();
    }, 2000);
  }
});

// Handle app activation (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log('App activated but no windows - exiting');
    app.quit();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Another instance is already running - exiting');
  app.quit();
} else {
  app.on('second-instance', () => {
    console.log('Second instance attempted - focusing existing window');
  });
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  app.quit();
});