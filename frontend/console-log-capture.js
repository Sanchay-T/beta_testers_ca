// Console Log Capture Script for CypherEdge Testing
// Add this to compatibility.html to capture and download all logs

(function() {
  'use strict';
  
  // Store all logs
  let allLogs = [];
  
  // Override console functions to capture logs
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  function captureLog(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    allLogs.push({
      timestamp,
      level,
      message
    });
    
    // Keep only last 1000 logs to prevent memory issues
    if (allLogs.length > 1000) {
      allLogs = allLogs.slice(-1000);
    }
  }
  
  console.log = function(...args) {
    captureLog('LOG', args);
    originalLog.apply(console, args);
  };
  
  console.error = function(...args) {
    captureLog('ERROR', args);
    originalError.apply(console, args);
  };
  
  console.warn = function(...args) {
    captureLog('WARN', args);
    originalWarn.apply(console, args);
  };
  
  // Function to download logs as a file
  window.downloadLogs = function() {
    const logContent = allLogs.map(log => 
      `[${log.timestamp}] [${log.level}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cypheredge-test-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('📄 [LOG CAPTURE] Logs downloaded successfully');
  };
  
  // Function to clear logs
  window.clearLogs = function() {
    allLogs = [];
    console.log('🗑️ [LOG CAPTURE] All logs cleared');
  };
  
  // Function to get logs as string
  window.getLogs = function() {
    return allLogs.map(log => 
      `[${log.timestamp}] [${log.level}] ${log.message}`
    ).join('\n');
  };
  
  // Add download button to the page
  setTimeout(() => {
    const downloadBtn = document.createElement('button');
    downloadBtn.innerHTML = '📄 Download Logs';
    downloadBtn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 10001;
      background: #1f2937; color: white; border: none; padding: 10px 15px;
      border-radius: 6px; font-size: 12px; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    downloadBtn.onclick = window.downloadLogs;
    document.body.appendChild(downloadBtn);
    
    console.log('📄 [LOG CAPTURE] Log capture system initialized');
    console.log('📄 [LOG CAPTURE] Download button added to bottom-right corner');
  }, 1000);
  
})();