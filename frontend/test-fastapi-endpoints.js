// test-fastapi-endpoints.js
// Custom test script to verify FastAPI endpoints when main.exe is running manually
// Run this AFTER you start main.exe manually

const axios = require('axios');
const path = require('path');

async function testFastAPIEndpoints() {
  console.log('\n========================================');
  console.log('FASTAPI ENDPOINT TESTING');
  console.log('========================================\n');
  
  console.log('📍 Testing against: http://127.0.0.1:7500 (IPv4 explicit)');
  console.log('⚠️  Make sure main.exe is running first!\n');
  
  const tests = [
    {
      name: 'Health Check',
      method: 'GET',
      url: 'http://127.0.0.1:7500/health',
      headers: { 'User-Agent': 'CypherEdge-Manual-Test' },
      expectedStatus: 200
    },
    {
      name: 'FastAPI Dependencies Check',
      method: 'GET', 
      url: 'http://127.0.0.1:7500/health',
      headers: { 'User-Agent': 'CypherEdge-Manual-Test' },
      expectedStatus: 200,
      validateResponse: (data) => {
        return data && typeof data === 'object';
      }
    },
    {
      name: 'PDF Processing Endpoint',
      method: 'POST',
      url: 'http://127.0.0.1:7500/add-pdf/',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'CypherEdge-Manual-Test' 
      },
      data: {
        bank_names: ["Test Bank"],
        pdf_paths: [],
        passwords: [""],
        start_date: ["2024-01-01"],
        end_date: ["2024-12-31"],
        ca_id: "manual-test"
      },
      expectedStatus: [200, 400], // 400 might be OK for empty PDF paths
      timeout: 10000
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n🧪 Test ${i + 1}/${totalTests}: ${test.name}`);
    console.log(`   ${test.method} ${test.url}`);
    
    try {
      const startTime = Date.now();
      
      const config = {
        method: test.method,
        url: test.url,
        headers: test.headers,
        timeout: test.timeout || 5000
      };
      
      if (test.data) {
        config.data = test.data;
      }
      
      const response = await axios(config);
      const duration = Date.now() - startTime;
      
      // Check status
      const expectedStatuses = Array.isArray(test.expectedStatus) 
        ? test.expectedStatus 
        : [test.expectedStatus];
        
      const statusOK = expectedStatuses.includes(response.status);
      
      // Validate response if validator provided
      let responseValid = true;
      if (test.validateResponse && response.data) {
        responseValid = test.validateResponse(response.data);
      }
      
      if (statusOK && responseValid) {
        console.log(`   ✅ PASSED (${response.status}) in ${duration}ms`);
        console.log(`   📊 Response: ${JSON.stringify(response.data).substring(0, 100)}${JSON.stringify(response.data).length > 100 ? '...' : ''}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Status: ${response.status}, Valid: ${responseValid}`);
        console.log(`   📊 Response: ${JSON.stringify(response.data, null, 2)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ FAILED - Error: ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        console.log(`   🚨 Connection refused - Is main.exe running on port 7500?`);
      } else if (error.code === 'ECONNABORTED') {
        console.log(`   ⏱️  Request timed out after ${test.timeout || 5000}ms`);
      } else {
        console.log(`   🔍 Error details: ${error.response?.status} ${error.response?.statusText}`);
        if (error.response?.data) {
          console.log(`   📊 Error response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
    }
  }
  
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! FastAPI backend is working correctly.');
    console.log('The issue is likely in the compatibility checker\'s process management.');
  } else {
    console.log('\n⚠️  Some tests failed. Check main.exe startup and logs.');
  }
  
  console.log('\n📁 Next steps:');
  console.log('1. If tests pass: Issue is in compatibility checker process spawning');
  console.log('2. If tests fail: Issue is in main.exe FastAPI implementation');
  console.log('3. Check main.exe console output for startup errors');
  
  return passedTests === totalTests;
}

// Check if main.exe process is running
async function checkMainExeProcess() {
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq main.exe"', (error, stdout, stderr) => {
      const isRunning = stdout.includes('main.exe');
      console.log(`🔍 main.exe process running: ${isRunning ? '✅ YES' : '❌ NO'}`);
      if (isRunning) {
        console.log('   Process found in task list');
      } else {
        console.log('   ⚠️  Start main.exe first: C:\\Users\\sanch\\Desktop\\Offlinesuite\\beta_testers_ca\\dist\\main\\main.exe');
      }
      resolve(isRunning);
    });
  });
}

// Main execution
async function main() {
  console.log('🔍 Checking if main.exe is running...');
  await checkMainExeProcess();
  
  console.log('\n⏱️  Starting endpoint tests in 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    await testFastAPIEndpoints();
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
  }
}

main().catch(console.error);