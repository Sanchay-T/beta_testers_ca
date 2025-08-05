const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine log file location based on platform
const getLogPath = () => {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA, 'ca-offline-suite', 'cyphersol.log');
  } else if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'ca-offline-suite', 'cyphersol.log');
  } else {
    return path.join(os.homedir(), '.config', 'ca-offline-suite', 'cyphersol.log');
  }
};

const analyzeDebugLogs = () => {
  const logPath = process.argv[2] || getLogPath();
  
  console.log('========================================');
  console.log('CypherSol Debug Log Analyzer');
  console.log('========================================');
  console.log(`Analyzing log file: ${logPath}`);
  console.log();

  try {
    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.split('\n');
    
    // Extract debug lines
    const debugLines = lines.filter(line => line.includes('[INIT DEBUG]') || 
                                            line.includes('[SYSINFO DEBUG]') ||
                                            line.includes('[MAC DEBUG]') ||
                                            line.includes('[UUID DEBUG]') ||
                                            line.includes('[GATEWAY DEBUG]') ||
                                            line.includes('[SERVICE DEBUG]') ||
                                            line.includes('[HEALTH DEBUG]') ||
                                            line.includes('[SID DEBUG]'));
    
    // Parse timing information
    const phases = {};
    let lastPhase = null;
    let initStartTime = null;
    
    debugLines.forEach(line => {
      const match = line.match(/\[(\w+ DEBUG)\] (.+?) - (.+?) \| (?:Total )?Elapsed: (\d+)ms/);
      if (match) {
        const [, debugType, phase, status, elapsed] = match;
        
        if (!phases[phase]) {
          phases[phase] = {
            statuses: [],
            totalTime: 0,
            debugType
          };
        }
        
        phases[phase].statuses.push({
          status,
          elapsed: parseInt(elapsed),
          fullLine: line
        });
        
        if (status === 'SUCCESS' || status === 'FAILED' || status === 'COMPLETE') {
          phases[phase].totalTime = parseInt(elapsed);
        }
        
        if (phase === 'APP_READY' && status === 'START') {
          initStartTime = parseInt(elapsed);
        }
      }
    });
    
    // Find errors and warnings
    const errors = lines.filter(line => line.includes('ERROR') || line.includes('FAILED'));
    const warnings = lines.filter(line => line.includes('WARN') || line.includes('WARNING'));
    
    // Display analysis
    console.log('INITIALIZATION PHASES:');
    console.log('----------------------');
    Object.entries(phases).forEach(([phase, data]) => {
      console.log(`\n${phase}:`);
      data.statuses.forEach(status => {
        console.log(`  - ${status.status}: ${status.elapsed}ms`);
      });
      if (data.totalTime) {
        console.log(`  Total: ${data.totalTime}ms`);
      }
    });
    
    console.log('\n\nPOTENTIAL ISSUES:');
    console.log('-----------------');
    
    // Check for timeouts
    const timeouts = debugLines.filter(line => line.includes('timeout') || line.includes('TIMEOUT'));
    if (timeouts.length > 0) {
      console.log('\nTimeouts detected:');
      timeouts.forEach(line => console.log(`  - ${line.trim()}`));
    }
    
    // Check for stuck phases
    const stuckPhases = [];
    Object.entries(phases).forEach(([phase, data]) => {
      const hasStart = data.statuses.some(s => s.status === 'START' || s.status === 'ATTEMPTING');
      const hasEnd = data.statuses.some(s => s.status === 'SUCCESS' || s.status === 'FAILED' || s.status === 'COMPLETE');
      
      if (hasStart && !hasEnd) {
        stuckPhases.push(phase);
      }
    });
    
    if (stuckPhases.length > 0) {
      console.log('\nPhases that started but didn\'t complete:');
      stuckPhases.forEach(phase => {
        console.log(`  - ${phase}`);
        const lastStatus = phases[phase].statuses[phases[phase].statuses.length - 1];
        console.log(`    Last status: ${lastStatus.status} at ${lastStatus.elapsed}ms`);
      });
    }
    
    // Show errors
    if (errors.length > 0) {
      console.log('\n\nERRORS FOUND:');
      console.log('-------------');
      errors.slice(-10).forEach(line => console.log(line.trim()));
    }
    
    // Summary
    console.log('\n\nSUMMARY:');
    console.log('--------');
    console.log(`Total debug entries analyzed: ${debugLines.length}`);
    console.log(`Errors found: ${errors.length}`);
    console.log(`Warnings found: ${warnings.length}`);
    console.log(`Phases with issues: ${stuckPhases.length}`);
    
    // Check for specific known issues
    console.log('\n\nKNOWN ISSUE CHECKS:');
    console.log('-------------------');
    
    if (lines.some(line => line.includes('wmic') && line.includes('timeout'))) {
      console.log('⚠️  WMI command timeouts detected - may indicate WMI service issues');
    }
    
    if (lines.some(line => line.includes('Service returned 1053'))) {
      console.log('⚠️  Windows Service timeout (1053) detected - gateway service may have issues');
    }
    
    if (lines.some(line => line.includes('gateway') && line.includes('not responding'))) {
      console.log('⚠️  Gateway server not responding - check if port 7890 is blocked');
    }
    
    if (errors.some(line => line.includes('400') || line.includes('Bad Request'))) {
      console.log('⚠️  License validation 400 errors detected');
    }
    
  } catch (error) {
    console.error('Error reading log file:', error.message);
    console.log('\nUsage: node analyze-debug-logs.js [path-to-log-file]');
    console.log(`Default log location: ${getLogPath()}`);
  }
};

analyzeDebugLogs();