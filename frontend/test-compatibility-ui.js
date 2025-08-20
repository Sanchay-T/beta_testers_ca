// test-compatibility-ui.js
// Test runner for Phase 1 compatibility checker UI

const { app, BrowserWindow } = require("electron");
const path = require("path");
const { SystemCompatibilityChecker } = require("./SystemCompatibilityChecker");

// Enable live reload for development
try {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
} catch (_) {
  console.log('electron-reload not available');
}

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'react-app', 'build', 'index.html'));
  mainWindow.webContents.openDevTools();
}

async function testCompatibilityChecker() {
  console.log("🧪 Testing CypherEdge Compatibility Checker");
  console.log("======================================");
  
  try {
    const compatChecker = new SystemCompatibilityChecker();
    
    // For testing, we'll auto-close after 30 seconds
    const testTimeout = setTimeout(() => {
      console.log("⏰ Test timeout - auto-closing compatibility checker");
      app.quit();
    }, 30000);
    
    const result = await compatChecker.runFullCheck();
    
    clearTimeout(testTimeout);
    console.log("✅ Compatibility check completed:", result);
    
    // After completion, show main app window for a moment then exit
    setTimeout(() => {
      console.log("🎉 Test completed successfully! Compatibility checker UI is working.");
      app.quit();
    }, 2000);
    
  } catch (error) {
    console.error("❌ Compatibility check failed:", error);
    
    // Show error and exit
    setTimeout(() => {
      app.quit();
    }, 3000);
  }
}

app.whenReady().then(() => {
  console.log("🚀 Starting compatibility checker test...");
  testCompatibilityChecker();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (mainWindow) {
      createMainWindow();
    } else {
      testCompatibilityChecker();
    }
  }
});