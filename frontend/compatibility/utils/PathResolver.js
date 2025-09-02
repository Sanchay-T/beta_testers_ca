// PathResolver.js
// Centralized path resolution utility for the compatibility system
const fs = require('fs');
const path = require('path');

class PathResolver {
  constructor() {
    this.projectRoot = null;
    this.frontendRoot = null;
    this.compatibilityRoot = null;
    this.resolved = false;
  }

  /**
   * Find and cache the project root directory
   * @returns {string} Project root path
   */
  getProjectRoot() {
    if (this.projectRoot && this.resolved) {
      return this.projectRoot;
    }

    // Method 1: Look for package.json to identify project root
    let searchDir = __dirname;
    for (let i = 0; i < 10; i++) { // Search up to 10 levels
      const packagePath = path.join(searchDir, 'package.json');
      if (fs.existsSync(packagePath)) {
        // Verify this is the right package.json by checking for frontend folder
        const frontendPath = path.join(searchDir, 'frontend');
        if (fs.existsSync(frontendPath)) {
          this.projectRoot = searchDir;
          this.frontendRoot = frontendPath;
          this.compatibilityRoot = path.join(frontendPath, 'compatibility');
          this.resolved = true;
          console.log(`🧭 [PATH_RESOLVER] Project root found: ${this.projectRoot}`);
          return this.projectRoot;
        }
      }
      searchDir = path.dirname(searchDir);
    }

    // Method 2: Use process.cwd() if it contains the project structure
    const cwdCheck = process.cwd();
    const frontendCheck = path.join(cwdCheck, 'frontend');
    if (fs.existsSync(frontendCheck)) {
      this.projectRoot = cwdCheck;
      this.frontendRoot = frontendCheck;
      this.compatibilityRoot = path.join(frontendCheck, 'compatibility');
      this.resolved = true;
      console.log(`🧭 [PATH_RESOLVER] Project root found via cwd: ${this.projectRoot}`);
      return this.projectRoot;
    }

    // Method 3: Search from current working directory upwards
    searchDir = process.cwd();
    for (let i = 0; i < 10; i++) {
      const frontendPath = path.join(searchDir, 'frontend');
      if (fs.existsSync(frontendPath)) {
        this.projectRoot = searchDir;
        this.frontendRoot = frontendPath;
        this.compatibilityRoot = path.join(frontendPath, 'compatibility');
        this.resolved = true;
        console.log(`🧭 [PATH_RESOLVER] Project root found via search: ${this.projectRoot}`);
        return this.projectRoot;
      }
      searchDir = path.dirname(searchDir);
    }

    // Fallback: Use __dirname and go up until we find the right structure
    this.projectRoot = path.resolve(__dirname, '../../../');
    this.frontendRoot = path.join(this.projectRoot, 'frontend');
    this.compatibilityRoot = path.join(this.frontendRoot, 'compatibility');
    this.resolved = true;
    
    console.log(`⚠️ [PATH_RESOLVER] Using fallback project root: ${this.projectRoot}`);
    return this.projectRoot;
  }

  /**
   * Get frontend directory path
   * @returns {string} Frontend directory path
   */
  getFrontendRoot() {
    if (!this.resolved) this.getProjectRoot();
    return this.frontendRoot;
  }

  /**
   * Get compatibility directory path
   * @returns {string} Compatibility directory path
   */
  getCompatibilityRoot() {
    if (!this.resolved) this.getProjectRoot();
    return this.compatibilityRoot;
  }

  /**
   * Resolve path relative to compatibility directory
   * @param {...string} pathSegments - Path segments to join
   * @returns {string} Resolved path
   */
  resolveCompatibility(...pathSegments) {
    return path.join(this.getCompatibilityRoot(), ...pathSegments);
  }

  /**
   * Resolve path relative to frontend directory
   * @param {...string} pathSegments - Path segments to join
   * @returns {string} Resolved path
   */
  resolveFrontend(...pathSegments) {
    return path.join(this.getFrontendRoot(), ...pathSegments);
  }

  /**
   * Resolve path relative to project root
   * @param {...string} pathSegments - Path segments to join
   * @returns {string} Resolved path
   */
  resolveProject(...pathSegments) {
    return path.join(this.getProjectRoot(), ...pathSegments);
  }

  /**
   * Get cache directory path
   * @returns {string} Cache directory path
   */
  getCacheDir() {
    return this.resolveCompatibility('cache');
  }

  /**
   * Get log directory path
   * @returns {string} Log directory path
   */
  getLogDir() {
    return this.resolveCompatibility('log');
  }

  /**
   * Get reports directory path
   * @returns {string} Reports directory path
   */
  getReportsDir() {
    return this.resolveCompatibility('log', 'reports');
  }

  /**
   * Get config directory path
   * @returns {string} Config directory path
   */
  getConfigDir() {
    return this.resolveCompatibility('config');
  }

  /**
   * Get test samples directory path
   * @returns {string} Test samples directory path
   */
  getTestSamplesDir() {
    return this.resolveProject('test-samples');
  }

  /**
   * Get backend directory path
   * @returns {string} Backend directory path
   */
  getBackendDir() {
    return this.resolveProject('backend');
  }

  /**
   * Get dist directory path
   * @returns {string} Dist directory path
   */
  getDistDir() {
    return this.resolveProject('dist');
  }

  /**
   * Get gateway server directory path
   * @returns {string} Gateway server directory path
   */
  getGatewayServerDir() {
    return this.resolveFrontend('gatewayServer');
  }

  /**
   * Ensure directory exists, create if it doesn't
   * @param {string} dirPath - Directory path to ensure
   * @returns {boolean} True if directory exists or was created
   */
  ensureDir(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 [PATH_RESOLVER] Created directory: ${dirPath}`);
      }
      return true;
    } catch (error) {
      console.error(`❌ [PATH_RESOLVER] Failed to create directory ${dirPath}:`, error.message);
      return false;
    }
  }

  /**
   * Find a file by searching in multiple possible locations
   * @param {string} filename - Name of file to find
   * @param {string[]} searchPaths - Array of paths to search in
   * @returns {string|null} Path to file if found, null otherwise
   */
  findFile(filename, searchPaths) {
    for (const searchPath of searchPaths) {
      const fullPath = path.join(searchPath, filename);
      if (fs.existsSync(fullPath)) {
        console.log(`🔍 [PATH_RESOLVER] Found ${filename} at: ${fullPath}`);
        return fullPath;
      }
    }
    console.log(`⚠️ [PATH_RESOLVER] File ${filename} not found in any search paths`);
    return null;
  }

  /**
   * Get debug information about resolved paths
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      projectRoot: this.projectRoot,
      frontendRoot: this.frontendRoot,
      compatibilityRoot: this.compatibilityRoot,
      resolved: this.resolved,
      __dirname: __dirname,
      'process.cwd()': process.cwd(),
      'process.argv[0]': process.argv[0]
    };
  }
}

// Export singleton instance
module.exports = new PathResolver();
