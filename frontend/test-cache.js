// Test script to verify CompatibilityCache functionality
const { CompatibilityCache } = require('./compatibility/CompatibilityCache');

// Mock logger
const mockLogger = {
  info: (prefix, message, data) => console.log(`INFO [${prefix}]: ${message}`, data || ''),
  warn: (prefix, message, data) => console.log(`WARN [${prefix}]: ${message}`, data || ''),
  error: (prefix, message, data) => console.log(`ERROR [${prefix}]: ${message}`, data || '')
};

async function testCache() {
  console.log('🧪 Testing CompatibilityCache functionality...\n');
  
  const cache = new CompatibilityCache(mockLogger);
  
  // Test 1: Check initial status (should be no cache)
  console.log('📂 Test 1: Initial cache status');
  const status1 = cache.getCacheStatus();
  console.log('Cache exists:', status1.exists);
  console.log('Cache path:', status1.path);
  console.log('Environment:', status1.environment);
  
  // Test 2: Check for cached result (should be null)
  console.log('\n📂 Test 2: Get cached result (should be null)');
  const cached1 = cache.getCachedResult();
  console.log('Cached result:', cached1);
  
  // Test 3: Create a mock compatibility result and save it
  console.log('\n💾 Test 3: Save mock compatibility result');
  const mockResult = {
    determinedMode: 'SCAN',
    confidence: 'high',
    canProceed: true,
    userMessage: '✅ Full offline processing with scanning enabled',
    duration: 45231,
    technical: {
      configVersion: '1.0.0',
      testMode: true
    }
  };
  
  const saveSuccess = cache.saveCachedResult(mockResult);
  console.log('Save successful:', saveSuccess);
  
  // Test 4: Check status after saving
  console.log('\n📂 Test 4: Cache status after saving');
  const status2 = cache.getCacheStatus();
  console.log('Cache exists:', status2.exists);
  console.log('Cache mode:', status2.mode);
  console.log('Cache confidence:', status2.confidence);
  console.log('Cache age:', status2.age);
  console.log('Cache valid:', status2.isValid);
  
  // Test 5: Get cached result (should return the saved data)
  console.log('\n📂 Test 5: Get cached result (should return saved data)');
  const cached2 = cache.getCachedResult();
  if (cached2) {
    console.log('✅ Cached result found!');
    console.log('Mode:', cached2.compatibilityResult.determinedMode);
    console.log('Confidence:', cached2.compatibilityResult.confidence);
    console.log('Age:', cache.getCacheAge(cached2.timestamp));
  } else {
    console.log('❌ No cached result found');
  }
  
  // Test 6: Clear cache
  console.log('\n🗑️ Test 6: Clear cache');
  const clearSuccess = cache.clearCache();
  console.log('Clear successful:', clearSuccess);
  
  // Test 7: Check status after clearing
  console.log('\n📂 Test 7: Cache status after clearing');
  const status3 = cache.getCacheStatus();
  console.log('Cache exists:', status3.exists);
  
  console.log('\n✅ Cache functionality test completed!');
}

// Run the test
testCache().catch(console.error);