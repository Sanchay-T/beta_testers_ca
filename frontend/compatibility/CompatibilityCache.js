// CompatibilityCache.js
// Simple mechanism to skip compatibility flow if already completed and valid

const fs = require('fs');
const path = require('path');
const os = require('os');
const pathResolver = require('./utils/PathResolver');

class CompatibilityCache {
  constructor(logger = null) {
    this.logger = logger;
    this.cacheFileName = 'compatibility-result.json';
    this.maxCacheAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  }

  /**
   * Get cache file path based on environment
   * @returns {string} Cache file path
   */
  getCacheFilePath() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (isDevelopment) {
      // Development: Store in project cache directory
      const devPath = pathResolver.getCacheDir();
      pathResolver.ensureDir(devPath);
      return path.join(devPath, this.cacheFileName);
    } else {
      // Production: Store in user data directory
      const { app } = require('electron');
      const userDataPath = app.getPath('userData');
      const prodPath = path.join(userDataPath, 'CypherEdge');
      if (!fs.existsSync(prodPath)) {
        fs.mkdirSync(prodPath, { recursive: true });
      }
      return path.join(prodPath, this.cacheFileName);
    }
  }

  /**
   * Generate system fingerprint for validation
   * @returns {Object} System fingerprint
   */
  generateSystemFingerprint() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      totalMemoryGB: Math.round(os.totalmem() / (1024 ** 3)),
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model?.substring(0, 50) || 'unknown', // First 50 chars
      nodeVersion: process.version,
      electronVersion: process.versions?.electron || 'unknown'
    };
  }

  /**
   * Check if cached result exists and is valid
   * @returns {Object|null} Valid cached result or null
   */
  getCachedResult() {
    try {
      const cacheFilePath = this.getCacheFilePath();
      
      // Check if cache file exists
      if (!fs.existsSync(cacheFilePath)) {
        this.logger?.info('COMPATIBILITY_CACHE', 'No cache file found');
        return null;
      }

      // Read and parse cache file
      const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
      this.logger?.info('COMPATIBILITY_CACHE', 'Cache file found, validating...');

      // Validate cache structure
      if (!this.isValidCacheStructure(cacheData)) {
        this.logger?.warn('COMPATIBILITY_CACHE', 'Invalid cache structure, ignoring');
        return null;
      }

      // Check cache age
      if (this.isCacheExpired(cacheData.timestamp)) {
        this.logger?.info('COMPATIBILITY_CACHE', 'Cache expired, ignoring');
        return null;
      }

      // Check system fingerprint
      if (!this.isSystemFingerprintValid(cacheData.systemFingerprint)) {
        this.logger?.info('COMPATIBILITY_CACHE', 'System changed, cache invalid');
        return null;
      }

      // Cache is valid
      this.logger?.info('COMPATIBILITY_CACHE', '✅ Valid cache found', {
        mode: cacheData.compatibilityResult.determinedMode,
        age: this.getCacheAge(cacheData.timestamp),
        confidence: cacheData.compatibilityResult.confidence
      });

      return cacheData;

    } catch (error) {
      this.logger?.error('COMPATIBILITY_CACHE', 'Error reading cache', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Save compatibility result to cache
   * @param {Object} compatibilityResult - Result from compatibility check
   * @returns {boolean} Success status
   */
  saveCachedResult(compatibilityResult) {
    try {
      const cacheFilePath = this.getCacheFilePath();
      
      const cacheData = {
        version: '1.0.0',
        timestamp: Date.now(),
        systemFingerprint: this.generateSystemFingerprint(),
        compatibilityResult: {
          determinedMode: compatibilityResult.determinedMode,
          confidence: compatibilityResult.confidence,
          canProceed: compatibilityResult.canProceed,
          userMessage: compatibilityResult.userMessage,
          duration: compatibilityResult.duration,
          technical: compatibilityResult.technical || {}
        },
        metadata: {
          nodeEnv: process.env.NODE_ENV || 'development',
          appVersion: this.getAppVersion(),
          createdAt: new Date().toISOString()
        }
      };

      // Write cache file
      fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8');
      
      this.logger?.info('COMPATIBILITY_CACHE', '✅ Compatibility result cached', {
        path: cacheFilePath,
        mode: compatibilityResult.determinedMode,
        confidence: compatibilityResult.confidence
      });

      return true;

    } catch (error) {
      this.logger?.error('COMPATIBILITY_CACHE', 'Error saving cache', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Clear/invalidate cached result
   * @returns {boolean} Success status
   */
  clearCache() {
    try {
      const cacheFilePath = this.getCacheFilePath();
      
      if (fs.existsSync(cacheFilePath)) {
        fs.unlinkSync(cacheFilePath);
        this.logger?.info('COMPATIBILITY_CACHE', 'Cache cleared successfully');
        return true;
      }

      return true; // Already cleared
    } catch (error) {
      this.logger?.error('COMPATIBILITY_CACHE', 'Error clearing cache', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Validate cache data structure
   * @param {Object} cacheData - Cache data to validate
   * @returns {boolean} Is valid
   */
  isValidCacheStructure(cacheData) {
    return (
      cacheData &&
      typeof cacheData.timestamp === 'number' &&
      cacheData.systemFingerprint &&
      cacheData.compatibilityResult &&
      cacheData.compatibilityResult.determinedMode &&
      ['SCAN', 'UNSCAN', 'HYBRID'].includes(cacheData.compatibilityResult.determinedMode)
    );
  }

  /**
   * Check if cache is expired
   * @param {number} cacheTimestamp - Cache timestamp
   * @returns {boolean} Is expired
   */
  isCacheExpired(cacheTimestamp) {
    const age = Date.now() - cacheTimestamp;
    return age > this.maxCacheAge;
  }

  /**
   * Validate system fingerprint against current system
   * @param {Object} cachedFingerprint - Cached system fingerprint
   * @returns {boolean} Is valid
   */
  isSystemFingerprintValid(cachedFingerprint) {
    const currentFingerprint = this.generateSystemFingerprint();
    
    // Check critical system components
    const isValid = (
      cachedFingerprint.platform === currentFingerprint.platform &&
      cachedFingerprint.arch === currentFingerprint.arch &&
      cachedFingerprint.totalMemoryGB === currentFingerprint.totalMemoryGB &&
      cachedFingerprint.cpuModel === currentFingerprint.cpuModel
    );

    if (!isValid) {
      this.logger?.info('COMPATIBILITY_CACHE', 'System fingerprint mismatch', {
        cached: {
          platform: cachedFingerprint.platform,
          arch: cachedFingerprint.arch,
          memoryGB: cachedFingerprint.totalMemoryGB,
          cpu: cachedFingerprint.cpuModel?.substring(0, 20) + '...'
        },
        current: {
          platform: currentFingerprint.platform,
          arch: currentFingerprint.arch,
          memoryGB: currentFingerprint.totalMemoryGB,
          cpu: currentFingerprint.cpuModel?.substring(0, 20) + '...'
        }
      });
    }

    return isValid;
  }

  /**
   * Get cache age in human-readable format
   * @param {number} cacheTimestamp - Cache timestamp
   * @returns {string} Age description
   */
  getCacheAge(cacheTimestamp) {
    const ageMs = Date.now() - cacheTimestamp;
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
    const ageDays = Math.floor(ageHours / 24);
    
    if (ageDays > 0) {
      return `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`;
    } else if (ageHours > 0) {
      return `${ageHours} hour${ageHours !== 1 ? 's' : ''} ago`;
    } else {
      const ageMinutes = Math.floor(ageMs / (60 * 1000));
      return `${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago`;
    }
  }

  /**
   * Get app version for metadata
   * @returns {string} App version
   */
  getAppVersion() {
    try {
      const { app } = require('electron');
      return app.getVersion();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get cache status information
   * @returns {Object} Cache status
   */
  getCacheStatus() {
    const cacheFilePath = this.getCacheFilePath();
    const exists = fs.existsSync(cacheFilePath);
    
    let cacheInfo = {
      exists: exists,
      path: cacheFilePath,
      environment: process.env.NODE_ENV || 'development'
    };

    if (exists) {
      try {
        const stats = fs.statSync(cacheFilePath);
        const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        
        cacheInfo = {
          ...cacheInfo,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          mode: cacheData.compatibilityResult?.determinedMode,
          confidence: cacheData.compatibilityResult?.confidence,
          age: this.getCacheAge(cacheData.timestamp),
          isValid: this.getCachedResult() !== null
        };
      } catch (error) {
        cacheInfo.error = error.message;
      }
    }

    return cacheInfo;
  }
}

module.exports = { CompatibilityCache };