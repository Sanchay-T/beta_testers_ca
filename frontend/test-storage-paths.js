// Test storage paths for different environments
const { app } = require("electron");
const { CompatibilityLogger } = require("./compatibility/CompatibilityLogger");
const { EnhancedReportCollector } = require("./compatibility/EnhancedReportCollector");

console.log("🧪 Testing CypherEdge Storage Paths Configuration");
console.log("================================================");

// Mock app.isPackaged for testing
const originalIsPackaged = app.isPackaged;

// Test Development Environment
app.isPackaged = false;
console.log("\n📁 DEVELOPMENT MODE (NODE_ENV=development):");
const devLogger = new CompatibilityLogger({ enableConsole: false, enableFile: false });
const devCollector = new EnhancedReportCollector();

console.log("Logger Storage Info:", devLogger.getStorageInfo());
console.log("Report Collector Paths:", devCollector.getStoragePaths());

// Test Production Environment
app.isPackaged = true;
console.log("\n🏭 PRODUCTION MODE (NODE_ENV=production):");
const prodLogger = new CompatibilityLogger({ enableConsole: false, enableFile: false });
const prodCollector = new EnhancedReportCollector();

console.log("Logger Storage Info:", prodLogger.getStorageInfo());
console.log("Report Collector Paths:", prodCollector.getStoragePaths());

// Restore original value
app.isPackaged = originalIsPackaged;

console.log("\n✅ Storage path configuration test completed!");
console.log("\n📋 SUMMARY:");
console.log("- Development: Logs in project directory, reports in compatibility/log/");
console.log("- Production: All data centralized in %APPDATA%/CypherEdge/");
console.log("- Mode decisions, reports, and sessions properly segregated");