// test-compatibility-flow.js  
// Test the full compatibility checker flow with simulated user interactions

const { app, BrowserWindow } = require("electron");
const { SystemCompatibilityChecker } = require("./SystemCompatibilityChecker");

async function testFullFlow() {
  console.log("🧪 Testing Full Compatibility Checker Flow");
  console.log("==========================================");
  
  try {
    const compatChecker = new SystemCompatibilityChecker();
    
    // Add a listener to automatically interact with the UI
    let stepCompleted = false;
    
    // Override the IPC setup to auto-simulate user actions
    const originalSetupIPC = compatChecker.setupIPC.bind(compatChecker);
    compatChecker.setupIPC = function() {
      originalSetupIPC();
      
      // Auto-click continue after 3 seconds
      setTimeout(async () => {
        if (!stepCompleted && compatChecker.window && !compatChecker.window.isDestroyed()) {
          console.log("🤖 Auto-clicking 'Continue' button...");
          compatChecker.window.webContents.executeJavaScript(`
            const continueBtn = document.getElementById('continue-btn');
            if (continueBtn) {
              continueBtn.click();
            }
          `);
        }
      }, 3000);
      
      // Auto-proceed after tests complete (wait 20 seconds for all tests)
      setTimeout(async () => {
        if (!stepCompleted && compatChecker.window && !compatChecker.window.isDestroyed()) {
          console.log("🤖 Auto-clicking 'Launch CypherEdge' button...");
          compatChecker.window.webContents.executeJavaScript(`
            const launchBtn = document.getElementById('launch-btn');
            if (launchBtn) {
              launchBtn.click();
            }
          `);
          stepCompleted = true;
        }
      }, 25000);
    };
    
    // Run the compatibility check
    const result = await compatChecker.runFullCheck();
    
    console.log("✅ COMPATIBILITY CHECKER FLOW TEST COMPLETED!");
    console.log("===========================================");
    console.log("📊 Final Result:", {
      canProceed: result.canProceed,
      successes: result.results.successes.length,
      warnings: result.results.warnings.length, 
      issues: result.results.issues.length,
      duration: `${Math.round(result.results.duration / 1000)}s`
    });
    
    if (result.canProceed) {
      console.log("✅ SUCCESS: Compatibility checker passed and user can proceed!");
    } else {
      console.log("❌ BLOCKED: Critical compatibility issues found");
    }
    
    // Exit after showing results
    setTimeout(() => {
      console.log("🏁 Test completed - exiting");
      app.quit();
    }, 2000);
    
  } catch (error) {
    console.error("💥 TEST FAILED:", error);
    setTimeout(() => app.quit(), 3000);
  }
}

app.whenReady().then(() => {
  console.log("🚀 Starting full flow test...");
  testFullFlow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});