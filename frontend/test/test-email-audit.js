// test-email-audit.js
// Simple test to verify EmailAuditService functionality

const { EmailAuditService } = require('../services/EmailAuditService');

async function testEmailAuditService() {
  console.log('🧪 Testing EmailAuditService...');
  
  const emailService = new EmailAuditService();
  
  // Create sample audit data
  const sampleAuditData = {
    userEmail: 'sanchaythalnerkar@gmail.com',
    finalDecision: true,
    
    appVersion: '2.0.100',
    electronVersion: '33.3.1',
    nodeVersion: process.version,
    environment: 'development',
    
    systemInfo: {
      platform: 'win32',
      release: '10.0.22631',
      arch: 'x64',
      hostname: 'TEST-PC',
      totalMemory: 16,
      cpu: 'Intel(R) Core(TM) i7-8750H CPU @ 2.20GHz',
      cpuCores: 12,
      uptime: 24,
      loadAverage: 0.5
    },
    
    compatibilityResults: {
      testSuites: [
        {
          name: 'Port Availability Tests',
          tests: [
            { name: 'Python Backend Port (7500)', result: 'pass', details: 'Port available' },
            { name: 'Gateway Service Port (7890)', result: 'pass', details: 'Port available' },
            { name: 'FastAPI Health Check', result: 'pass', details: 'Service responding' }
          ]
        },
        {
          name: 'System Requirements',
          tests: [
            { name: 'Available RAM', result: 'pass', details: '16GB available' },
            { name: 'Disk Space', result: 'pass', details: '500GB free' },
            { name: 'Windows Version', result: 'pass', details: 'Windows 11 compatible' }
          ]
        }
      ],
      overallScore: 100,
      startTime: new Date(Date.now() - 30000).toISOString(),
      endTime: new Date().toISOString(),
      duration: 30000
    },
    
    modeDetection: {
      determinedMode: 'SCAN',
      confidence: 'high',
      reason: 'Hardware meets requirements and scan test passed',
      analysis: {
        hardware: {
          meetsFullModeRequirements: true,
          ram: { actual: 16, required: 8, meets: true },
          cpu: { actual: 'i7', required: 'i5', meets: true }
        }
      }
    },
    
    performanceMetrics: {
      totalDuration: 30,
      testCount: 6,
      successRate: 100,
      memoryUsage: process.memoryUsage(),
      timings: { total: 30000, tests: 25000, analysis: 5000 }
    },
    
    userJourney: [
      {
        timestamp: new Date(Date.now() - 30000).toISOString(),
        action: 'Started compatibility check',
        details: 'User initiated system compatibility assessment'
      },
      {
        timestamp: new Date(Date.now() - 25000).toISOString(),
        action: 'Email verification completed',
        details: 'Email: sanchaythalnerkar@gmail.com'
      },
      {
        timestamp: new Date(Date.now() - 20000).toISOString(),
        action: 'Compatibility tests started',
        details: 'Running comprehensive system tests'
      },
      {
        timestamp: new Date(Date.now() - 5000).toISOString(),
        action: 'Tests completed',
        details: 'Results: 6 passed, 0 warnings, 0 issues'
      },
      {
        timestamp: new Date().toISOString(),
        action: 'User chose to proceed',
        details: 'Launching CypherEdge application'
      }
    ],
    
    sessionId: 'TEST-SESSION-001',
    timestamp: new Date().toISOString()
  };
  
  try {
    console.log('📧 Sending test email audit...');
    const result = await emailService.sendCompatibilityAudit(sampleAuditData);
    
    if (result.success) {
      console.log('✅ Email audit sent successfully!');
      console.log('📧 Email ID:', result.emailId);
      console.log('⏰ Timestamp:', result.timestamp);
      console.log('\n🎉 Test completed successfully!');
      console.log('📮 Check your email (sanchaythalnerkar@gmail.com) for the comprehensive audit report.');
    } else {
      console.log('❌ Email audit failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Test failed with exception:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testEmailAuditService();
}

module.exports = { testEmailAuditService };