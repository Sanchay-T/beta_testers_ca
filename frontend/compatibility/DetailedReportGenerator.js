// DetailedReportGenerator.js
// Enhanced HTML report generator for compatibility checker
// Provides actionable, detailed reports instead of basic alerts

const fs = require('fs');
const path = require('path');
const os = require('os');

class DetailedReportGenerator {
  constructor(logger = null) {
    this.logger = logger;
  }

  // Generate comprehensive HTML report
  async generateDetailedReport(results, logPaths = {}) {
    try {
      this.logger?.debug('REPORT_GEN', 'Generating detailed HTML compatibility report');

      const reportData = this.analyzeResults(results);
      const htmlContent = this.generateHTMLContent(reportData, logPaths);
      
      // Save to temp file and return path
      const reportPath = await this.saveHTMLReport(htmlContent);
      
      this.logger?.info('REPORT_GEN', 'Detailed HTML report generated', { 
        reportPath, 
        issues: reportData.criticalIssues.length,
        warnings: reportData.warnings.length 
      });

      return {
        success: true,
        reportPath,
        reportData
      };

    } catch (error) {
      this.logger?.error('REPORT_GEN', 'Failed to generate detailed report', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  analyzeResults(results) {
    const criticalIssues = results.issues?.filter(issue => issue.severity === 'critical') || [];
    const warnings = results.warnings || [];
    const successes = results.successes || [];
    
    // Categorize issues for better presentation
    const issueCategories = this.categorizeIssues(criticalIssues, warnings);
    const fixSuggestions = this.generateFixSuggestions(criticalIssues, warnings);
    
    return {
      timestamp: new Date().toISOString(),
      duration: results.duration,
      overview: {
        total: successes.length + warnings.length + criticalIssues.length,
        passed: successes.length,
        warnings: warnings.length,
        critical: criticalIssues.length,
        canProceed: results.canProceed
      },
      criticalIssues,
      warnings,
      successes,
      issueCategories,
      fixSuggestions,
      systemInfo: this.getSystemSummary()
    };
  }

  categorizeIssues(criticalIssues, warnings) {
    const categories = {
      blocking: { name: 'App-Blocking Issues', issues: [], fixes: [] },
      network: { name: 'Network & Connectivity', issues: [], fixes: [] },
      components: { name: 'Component Executables', issues: [], fixes: [] },
      system: { name: 'System Requirements', issues: [], fixes: [] },
      permissions: { name: 'Permissions & Access', issues: [], fixes: [] },
      other: { name: 'Other Issues', issues: [], fixes: [] }
    };

    const allIssues = [...criticalIssues, ...warnings];

    allIssues.forEach(issue => {
      const testName = issue.test.toLowerCase();
      
      // Blocking issues first
      if (issue.severity === 'blocking') {
        categories.blocking.issues.push(issue);
      } else if (testName.includes('port') || testName.includes('fastapi') || testName.includes('health')) {
        categories.network.issues.push(issue);
      } else if (testName.includes('python') || testName.includes('gateway') || testName.includes('executable')) {
        categories.components.issues.push(issue);
      } else if (testName.includes('memory') || testName.includes('disk') || testName.includes('windows')) {
        categories.system.issues.push(issue);
      } else if (testName.includes('admin') || testName.includes('permissions') || testName.includes('database')) {
        categories.permissions.issues.push(issue);
      } else {
        categories.other.issues.push(issue);
      }
    });

    return categories;
  }

  generateFixSuggestions(criticalIssues, warnings) {
    const fixes = [];

    criticalIssues.forEach(issue => {
      const fix = this.getFixSuggestion(issue);
      if (fix) fixes.push(fix);
    });

    warnings.forEach(warning => {
      const fix = this.getFixSuggestion(warning);
      if (fix) fixes.push(fix);
    });

    return fixes;
  }

  getFixSuggestion(issue) {
    const testName = issue.test.toLowerCase();
    
    // Python executable issues
    if (testName.includes('python executable')) {
      return {
        category: 'Python Backend',
        issue: issue.test,
        severity: issue.severity,
        problem: 'Python dependencies missing or Python not installed properly',
        solutions: [
          {
            title: 'Install Python Dependencies',
            commands: [
              'cd backend',
              'pip install -r requirements.txt',
              'pip install uvicorn fastapi'
            ],
            description: 'Install all required Python packages'
          },
          {
            title: 'Verify Python Installation',
            commands: ['python --version', 'pip --version'],
            description: 'Check if Python and pip are properly installed'
          },
          {
            title: 'Create Virtual Environment (Alternative)',
            commands: [
              'cd backend',
              'python -m venv venv',
              'venv\\Scripts\\activate',
              'pip install -r requirements.txt'
            ],
            description: 'Create isolated Python environment'
          }
        ]
      };
    }

    // Port availability issues
    if (testName.includes('port') && testName.includes('7890')) {
      return {
        category: 'Gateway Service',
        issue: issue.test,
        severity: issue.severity,
        problem: 'Port 7890 is already in use by another application',
        solutions: [
          {
            title: 'Find and Kill Process Using Port 7890',
            commands: [
              'netstat -ano | findstr :7890',
              'taskkill /PID [PID_NUMBER] /F'
            ],
            description: 'Identify and terminate the process using port 7890'
          },
          {
            title: 'Restart Computer',
            commands: ['shutdown /r /t 0'],
            description: 'Simple restart to free up all ports'
          }
        ]
      };
    }

    // Port 7500 (Python FastAPI) issues
    if (testName.includes('port') && testName.includes('7500')) {
      return {
        category: 'Python Backend',
        issue: issue.test,
        severity: issue.severity,
        problem: 'Port 7500 is already in use by another application',
        solutions: [
          {
            title: 'Find and Kill Process Using Port 7500',
            commands: [
              'netstat -ano | findstr :7500',
              'taskkill /PID [PID_NUMBER] /F'
            ],
            description: 'Identify and terminate the process using port 7500'
          },
          {
            title: 'Restart Computer',
            commands: ['shutdown /r /t 0'],
            description: 'Simple restart to free up all ports'
          },
          {
            title: 'Check if CypherEdge is Already Running',
            commands: ['tasklist | findstr python'],
            description: 'Verify if another CypherEdge instance is already running'
          }
        ]
      };
    }

    // FastAPI health check issues
    if (testName.includes('fastapi') || testName.includes('health')) {
      return {
        category: 'Python Backend',
        issue: issue.test,
        severity: issue.severity,
        problem: 'FastAPI server is not running or not accessible',
        solutions: [
          {
            title: 'Start Python Backend',
            commands: [
              'cd backend',
              'uvicorn main:app --reload --port 7500'
            ],
            description: 'Start the FastAPI server manually'
          },
          {
            title: 'Check if Port 7500 is Available',
            commands: ['netstat -ano | findstr :7500'],
            description: 'Verify port 7500 is not occupied'
          },
          {
            title: 'Test FastAPI Directly',
            commands: ['curl http://localhost:7500/health'],
            description: 'Direct health check test'
          }
        ]
      };
    }

    // Memory warnings
    if (testName.includes('memory')) {
      return {
        category: 'System Resources',
        issue: issue.test,
        severity: issue.severity,
        problem: 'Limited memory may affect performance',
        solutions: [
          {
            title: 'Close Unnecessary Applications',
            commands: ['taskmgr.exe'],
            description: 'Open Task Manager and close memory-intensive applications'
          },
          {
            title: 'Restart Computer',
            commands: ['shutdown /r /t 0'],
            description: 'Restart to free up memory'
          }
        ]
      };
    }

    // Generic fix for other issues
    return {
      category: 'General',
      issue: issue.test,
      severity: issue.severity,
      problem: issue.message || 'Component test failed',
      solutions: [
        {
          title: 'Check Logs for Details',
          commands: ['Check the detailed logs for specific error messages'],
          description: 'Review compatibility checker logs for more information'
        }
      ]
    };
  }

  getSystemSummary() {
    try {
      return {
        platform: os.platform(),
        version: os.release(),
        arch: os.arch(),
        totalMemory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
        freeMemory: `${Math.round(os.freemem() / (1024 * 1024 * 1024))}GB`,
        hostname: os.hostname(),
        timestamp: new Date().toLocaleString()
      };
    } catch (error) {
      return { error: 'Could not collect system information' };
    }
  }

  generateHTMLContent(reportData, logPaths) {
    const statusColor = reportData.overview.critical > 0 ? '#ef4444' : 
                       reportData.overview.warnings > 0 ? '#f59e0b' : '#10b981';
    const statusText = reportData.overview.critical > 0 ? 'ISSUES FOUND' : 
                      reportData.overview.warnings > 0 ? 'WARNINGS' : 'ALL GOOD';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CypherEdge Compatibility Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc; color: #1e293b; line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: white; border-radius: 12px; padding: 30px; margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid ${statusColor};
        }
        .status-badge { 
            display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600;
            background: ${statusColor}; color: white; margin-bottom: 16px;
        }
        .overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 20px 0; }
        .overview-card { 
            background: white; padding: 20px; border-radius: 8px; text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .overview-number { font-size: 2rem; font-weight: bold; margin-bottom: 8px; }
        .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .card-title { font-size: 1.25rem; font-weight: bold; margin-bottom: 16px; color: #1e293b; }
        .issue-item { 
            border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px;
            background: #fefefe;
        }
        .issue-header { display: flex; justify-content: between; align-items: center; margin-bottom: 12px; }
        .issue-title { font-weight: 600; color: #1e293b; }
        .severity-blocking { color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 4px; }
        .severity-critical { color: #ef4444; }
        .severity-warning { color: #f59e0b; }
        .severity-success { color: #10b981; }
        .solution { 
            background: #f8fafc; border-radius: 6px; padding: 16px; margin: 12px 0;
            border-left: 3px solid #3b82f6;
        }
        .solution-title { font-weight: 600; margin-bottom: 8px; color: #1e293b; }
        .commands { 
            background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; 
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 0.9rem;
            margin: 8px 0; white-space: pre-wrap; overflow-x: auto;
        }
        .success-list { list-style: none; }
        .success-item { 
            padding: 8px 12px; margin: 4px 0; background: #f0fdf4; border-radius: 6px;
            border-left: 3px solid #10b981;
        }
        .system-info { font-size: 0.9rem; color: #64748b; }
        .copy-btn { 
            background: #3b82f6; color: white; border: none; padding: 4px 8px;
            border-radius: 4px; cursor: pointer; font-size: 0.8rem; margin-left: 8px;
        }
        .copy-btn:hover { background: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="status-badge">${statusText}</div>
            <h1>CypherEdge Compatibility Report</h1>
            <p>Generated on ${reportData.timestamp}</p>
            <p>Test Duration: ${Math.round(reportData.duration / 1000)}s</p>
            
            <div class="overview-grid">
                <div class="overview-card">
                    <div class="overview-number severity-success">${reportData.overview.passed}</div>
                    <div>Tests Passed</div>
                </div>
                <div class="overview-card">
                    <div class="overview-number severity-warning">${reportData.overview.warnings}</div>
                    <div>Warnings</div>
                </div>
                <div class="overview-card">
                    <div class="overview-number severity-critical">${reportData.overview.critical}</div>
                    <div>Critical Issues</div>
                </div>
                <div class="overview-card">
                    <div class="overview-number">${reportData.overview.total}</div>
                    <div>Total Tests</div>
                </div>
            </div>
        </div>

        ${reportData.criticalIssues.filter(issue => issue.severity === 'blocking').length > 0 ? `
        <div class="card">
            <h2 class="card-title severity-blocking">🚫 Blocking Issues (${reportData.criticalIssues.filter(issue => issue.severity === 'blocking').length})</h2>
            <p>These issues prevent CypherEdge from starting and must be resolved immediately:</p>
            ${reportData.criticalIssues.filter(issue => issue.severity === 'blocking').map(issue => `
                <div class="issue-item">
                    <div class="issue-header">
                        <span class="issue-title">${issue.test}</span>
                        <span class="severity-blocking">BLOCKING</span>
                    </div>
                    <p><strong>Problem:</strong> ${issue.message}</p>
                    ${issue.details?.recommendation ? `<p><strong>Recommendation:</strong> ${issue.details.recommendation}</p>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${reportData.criticalIssues.filter(issue => issue.severity !== 'blocking').length > 0 ? `
        <div class="card">
            <h2 class="card-title severity-critical">🔴 Critical Issues (${reportData.criticalIssues.filter(issue => issue.severity !== 'blocking').length})</h2>
            <p>These issues may affect CypherEdge functionality but won't prevent startup:</p>
            ${reportData.criticalIssues.filter(issue => issue.severity !== 'blocking').map(issue => `
                <div class="issue-item">
                    <div class="issue-header">
                        <span class="issue-title">${issue.test}</span>
                        <span class="severity-critical">CRITICAL</span>
                    </div>
                    <p><strong>Problem:</strong> ${issue.message}</p>
                    ${issue.details?.recommendation ? `<p><strong>Recommendation:</strong> ${issue.details.recommendation}</p>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${reportData.warnings.length > 0 ? `
        <div class="card">
            <h2 class="card-title severity-warning">⚠️ Warnings (${reportData.warnings.length})</h2>
            <p>These issues may affect performance but won't prevent startup:</p>
            ${reportData.warnings.map(warning => `
                <div class="issue-item">
                    <div class="issue-header">
                        <span class="issue-title">${warning.test}</span>
                        <span class="severity-warning">WARNING</span>
                    </div>
                    <p><strong>Issue:</strong> ${warning.message}</p>
                    ${warning.details?.impact ? `<p><strong>Impact:</strong> ${warning.details.impact}</p>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${reportData.fixSuggestions.length > 0 ? `
        <div class="card">
            <h2 class="card-title">🔧 Fix Instructions</h2>
            <p>Step-by-step solutions to resolve the identified issues:</p>
            ${reportData.fixSuggestions.map(fix => `
                <div class="issue-item">
                    <h3>${fix.category}: ${fix.issue}</h3>
                    <p><strong>Problem:</strong> ${fix.problem}</p>
                    ${fix.solutions.map(solution => `
                        <div class="solution">
                            <div class="solution-title">
                                ${solution.title}
                                ${solution.commands.length > 0 ? `<button class="copy-btn" onclick="copyToClipboard('${solution.commands.join('\\n')}')">Copy Commands</button>` : ''}
                            </div>
                            <p>${solution.description}</p>
                            ${solution.commands.length > 0 ? `<div class="commands">${solution.commands.join('\\n')}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${reportData.successes.length > 0 ? `
        <div class="card">
            <h2 class="card-title severity-success">✅ Successful Tests (${reportData.successes.length})</h2>
            <ul class="success-list">
                ${reportData.successes.map(success => `
                    <li class="success-item">${success.test} - ${success.suite}</li>
                `).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="card">
            <h2 class="card-title">💻 System Information</h2>
            <div class="system-info">
                <p><strong>Platform:</strong> ${reportData.systemInfo.platform} ${reportData.systemInfo.version}</p>
                <p><strong>Architecture:</strong> ${reportData.systemInfo.arch}</p>
                <p><strong>Memory:</strong> ${reportData.systemInfo.totalMemory} total, ${reportData.systemInfo.freeMemory} free</p>
                <p><strong>Hostname:</strong> ${reportData.systemInfo.hostname}</p>
                <p><strong>Report Generated:</strong> ${reportData.systemInfo.timestamp}</p>
                ${logPaths.logDir ? `<p><strong>Log Directory:</strong> ${logPaths.logDir}</p>` : ''}
            </div>
        </div>
    </div>

    <script>
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(function() {
                alert('Commands copied to clipboard!');
            }, function(err) {
                console.error('Could not copy text: ', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Commands copied to clipboard!');
            });
        }
    </script>
</body>
</html>
    `;
  }

  async saveHTMLReport(htmlContent) {
    try {
      const { app } = require('electron');
      const tempDir = app.getPath('temp');
      const reportFileName = `cypheridge-compatibility-report-${Date.now()}.html`;
      const reportPath = path.join(tempDir, reportFileName);

      fs.writeFileSync(reportPath, htmlContent, 'utf8');
      return reportPath;
    } catch (error) {
      throw new Error(`Failed to save HTML report: ${error.message}`);
    }
  }
}

module.exports = { DetailedReportGenerator };