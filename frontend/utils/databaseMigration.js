const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');

class DatabaseMigration {
  constructor() {
    this.currentUserDataDir = app.getPath('userData');
    this.migrationLogFile = path.join(this.currentUserDataDir, 'migration-detailed.log');
    
    // The old app name where user's important data is stored
    this.oldAppName = 'cyphersol-ats-electron-app';
    
    // Initialize detailed logging
    this.initializeDetailedLogging();
  }

  /**
   * Initialize comprehensive logging system
   */
  initializeDetailedLogging() {
    const systemInfo = {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      appVersion: app.getVersion(),
      appName: app.getName(),
      isPackaged: app.isPackaged,
      currentUserDataDir: this.currentUserDataDir,
      oldAppName: this.oldAppName,
      processId: process.pid,
      workingDirectory: process.cwd()
    };

    this.logMigration('🚀 SIMPLIFIED MIGRATION SYSTEM INITIALIZED', systemInfo);
    this.logMigration('='.repeat(80));
  }

  /**
   * Get the old app data directory path where user's data is stored
   */
  getOldAppDataDirectory() {
    const appDataRoot = path.dirname(this.currentUserDataDir);
    const oldDir = path.join(appDataRoot, this.oldAppName);
    
    this.logMigration('📍 CALCULATING OLD APP DIRECTORY', {
      appDataRoot: appDataRoot,
      oldAppName: this.oldAppName,
      calculatedOldDir: oldDir,
      currentDir: this.currentUserDataDir
    });
    
    return oldDir;
  }

  /**
   * Check if migration has already been performed for this installation
   */
  isMigrationCompleted() {
    const migrationFlagFile = path.join(this.currentUserDataDir, '.migration-completed');
    const exists = fs.existsSync(migrationFlagFile);
    
    this.logMigration('🔍 CHECKING MIGRATION STATUS', {
      flagFile: migrationFlagFile,
      exists: exists,
      currentUserDataDirExists: fs.existsSync(this.currentUserDataDir)
    });
    
    if (exists) {
      try {
        const content = fs.readFileSync(migrationFlagFile, 'utf8');
        const migrationInfo = JSON.parse(content);
        this.logMigration('📄 EXISTING MIGRATION INFO FOUND', migrationInfo);
      } catch (error) {
        this.logMigration('❌ ERROR READING MIGRATION FLAG', { error: error.message });
      }
    }
    
    return exists;
  }

  /**
   * Mark migration as completed with detailed information
   */
  markMigrationCompleted(migrationResults = []) {
    const migrationFlagFile = path.join(this.currentUserDataDir, '.migration-completed');
    const migrationInfo = {
      completedAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: process.platform,
      oldAppName: this.oldAppName,
      oldDirectory: this.getOldAppDataDirectory(),
      currentDirectory: this.currentUserDataDir,
      migratedFiles: migrationResults,
      note: 'Original files preserved in old location',
      migrationLogFile: this.migrationLogFile,
      processId: process.pid,
      migrationVersion: 'simplified-v1.0'
    };
    
    try {
      fs.writeFileSync(migrationFlagFile, JSON.stringify(migrationInfo, null, 2));
      this.logMigration('✅ MIGRATION COMPLETION FLAG CREATED', {
        flagFile: migrationFlagFile,
        migrationInfo: migrationInfo
      });
    } catch (error) {
      this.logMigration('❌ FAILED TO CREATE MIGRATION FLAG', {
        error: error.message,
        flagFile: migrationFlagFile
      });
    }
  }

  /**
   * Enhanced logging with multiple outputs and detailed context
   */
  logMigration(message, data = null) {
    const timestamp = new Date().toISOString();
    const formattedEntry = `[${timestamp}] [PID:${process.pid}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
    
    // 1. Log to electron-log (appears in main app logs)
    if (data) {
      log.info(`[SIMPLE-MIGRATION] ${message}`, data);
    } else {
      log.info(`[SIMPLE-MIGRATION] ${message}`);
    }
    
    // 2. Log to console for immediate visibility during development
    console.log(`[SIMPLE-MIGRATION] ${message}`, data || '');
    
    // 3. Log to dedicated migration file for detailed audit trail
    try {
      // Ensure current userData directory exists
      if (!fs.existsSync(this.currentUserDataDir)) {
        fs.mkdirSync(this.currentUserDataDir, { recursive: true });
        console.log(`[SIMPLE-MIGRATION] Created userData directory: ${this.currentUserDataDir}`);
      }
      
      fs.appendFileSync(this.migrationLogFile, formattedEntry);
    } catch (error) {
      console.error('[SIMPLE-MIGRATION] CRITICAL: Failed to write to migration log file:', error);
      log.error('[SIMPLE-MIGRATION] CRITICAL: Failed to write to migration log file:', error);
    }
    
    // 4. Also write to a backup log in temp directory as failsafe
    try {
      const tempLogFile = path.join(app.getPath('temp'), 'cyphersol-migration-backup.log');
      fs.appendFileSync(tempLogFile, formattedEntry);
    } catch (error) {
      console.error('[SIMPLE-MIGRATION] Failed to write backup log:', error);
    }
  }

  /**
   * Find critical user data files (simplified to only essential files)
   */
  findOldUserDataFiles() {
    const oldDir = this.getOldAppDataDirectory();
    const foundFiles = [];
    
    this.logMigration('🔍 === STARTING SIMPLIFIED USER DATA SEARCH ===');
    this.logMigration('SEARCH PARAMETERS', { 
      oldAppDirectory: oldDir,
      newAppDirectory: this.currentUserDataDir,
      oldAppName: this.oldAppName,
      strategy: 'SIMPLIFIED - Only Critical Files'
    });

    if (!fs.existsSync(oldDir)) {
      this.logMigration('🆕 NO OLD APP DATA FOUND - FRESH INSTALLATION DETECTED');
      return foundFiles;
    }

    // SIMPLIFIED FILES LIST - Only the absolutely critical files
    const criticalFiles = [
      { name: 'db.sqlite3', description: 'Main application database', priority: 'CRITICAL' },
      { name: 'clientLicense.enc', description: 'Encrypted license file', priority: 'CRITICAL' }
    ];

    this.logMigration('📋 SEARCHING FOR CRITICAL FILES ONLY', { 
      totalFiles: criticalFiles.length,
      files: criticalFiles.map(f => f.name)
    });

    // Check for critical files
    for (const fileInfo of criticalFiles) {
      const filePath = path.join(oldDir, fileInfo.name);
      
      this.logMigration(`🔍 Checking ${fileInfo.priority} file: ${fileInfo.name}`, {
        path: filePath,
        description: fileInfo.description,
        priority: fileInfo.priority
      });
      
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          
          this.logMigration(`📄 CRITICAL FILE FOUND: ${fileInfo.name}`, {
            path: filePath,
            size: stats.size,
            sizeKB: (stats.size / 1024).toFixed(2),
            created: stats.birthtime,
            modified: stats.mtime,
            description: fileInfo.description,
            priority: fileInfo.priority
          });
          
          // Only migrate files that have content
          if (stats.size > 0) {
            foundFiles.push({
              type: 'file',
              oldPath: filePath,
              fileName: fileInfo.name,
              description: fileInfo.description,
              priority: fileInfo.priority,
              size: stats.size,
              lastModified: stats.mtime,
              sourceDirectory: oldDir
            });
            
            this.logMigration(`✅ ADDED TO MIGRATION LIST: ${fileInfo.name} (${fileInfo.priority})`);
          } else {
            this.logMigration(`⚠️ SKIPPING EMPTY FILE: ${fileInfo.name}`, { path: filePath });
          }
        } catch (error) {
          this.logMigration(`❌ ERROR ANALYZING FILE: ${fileInfo.name}`, {
            path: filePath,
            error: error.message
          });
        }
      } else {
        this.logMigration(`❌ CRITICAL FILE NOT FOUND: ${fileInfo.name}`, { path: filePath });
      }
    }

    this.logMigration('📊 === SIMPLIFIED SEARCH SUMMARY ===', {
      totalItemsFound: foundFiles.length,
      criticalItemsFound: foundFiles.length,
      foundItems: foundFiles.map(f => ({ 
        name: f.fileName, 
        type: f.type, 
        priority: f.priority,
        description: f.description 
      }))
    });

    return foundFiles;
  }

  /**
   * Copy a single file with extensive verification and logging
   */
  copyFile(sourceInfo) {
    const { oldPath, fileName, description, priority } = sourceInfo;
    const newPath = path.join(this.currentUserDataDir, fileName);
    
    this.logMigration(`📄 === STARTING FILE COPY: ${fileName} (${priority}) ===`, {
      description: description,
      priority: priority,
      source: oldPath,
      destination: newPath
    });
    
    try {
      // Pre-copy analysis
      const sourceStats = fs.statSync(oldPath);
      this.logMigration(`📊 SOURCE FILE ANALYSIS: ${fileName}`, {
        path: oldPath,
        size: sourceStats.size,
        sizeKB: (sourceStats.size / 1024).toFixed(2),
        created: sourceStats.birthtime,
        modified: sourceStats.mtime,
        priority: priority
      });

      // Check if destination already exists
      if (fs.existsSync(newPath)) {
        const existingStats = fs.statSync(newPath);
        this.logMigration(`⚠️ DESTINATION FILE EXISTS: ${fileName}`, {
          path: newPath,
          existingSize: existingStats.size,
          existingSizeKB: (existingStats.size / 1024).toFixed(2),
          existingModified: existingStats.mtime
        });
        
        if (existingStats.size > 0) {
          // Create backup
          const backupDir = path.join(this.currentUserDataDir, 'pre-migration-backups');
          const timestamp = Date.now();
          const backupPath = path.join(backupDir, `${fileName}.backup.${timestamp}`);
          
          this.logMigration(`💾 CREATING BACKUP OF EXISTING FILE: ${fileName}`, {
            backupPath: backupPath
          });
          
          if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
            this.logMigration(`📁 CREATED BACKUP DIRECTORY: ${backupDir}`);
          }
          
          fs.copyFileSync(newPath, backupPath);
          const backupStats = fs.statSync(backupPath);
          
          this.logMigration(`✅ BACKUP CREATED SUCCESSFULLY: ${fileName}`, {
            backupPath: backupPath,
            backupSize: backupStats.size,
            verified: backupStats.size === existingStats.size
          });
        }
      }

      // Perform the actual copy
      this.logMigration(`🔄 COPYING ${priority} FILE: ${fileName}`);
      const copyStartTime = Date.now();
      
      fs.copyFileSync(oldPath, newPath);
      
      const copyEndTime = Date.now();
      const copyDuration = copyEndTime - copyStartTime;
      
      // Verify the copy
      const newStats = fs.statSync(newPath);
      const verificationResult = {
        originalSize: sourceStats.size,
        copiedSize: newStats.size,
        sizesMatch: sourceStats.size === newStats.size,
        copyDurationMs: copyDuration,
        copySpeedKBps: sourceStats.size > 0 ? ((sourceStats.size / 1024) / (copyDuration / 1000)).toFixed(2) : 0,
        priority: priority
      };
      
      if (verificationResult.sizesMatch) {
        this.logMigration(`✅ FILE COPY SUCCESSFUL: ${fileName} (${priority})`, {
          source: oldPath,
          destination: newPath,
          verification: verificationResult
        });
        return true;
      } else {
        throw new Error(`File size mismatch after copy. Original: ${sourceStats.size}, Copy: ${newStats.size}`);
      }
      
    } catch (error) {
      this.logMigration(`❌ FILE COPY FAILED: ${fileName} (${priority})`, {
        error: error.message,
        stack: error.stack,
        source: oldPath,
        destination: newPath,
        priority: priority
      });
      return false;
    }
  }

  /**
   * Perform the simplified migration process
   */
  async performMigration() {
    const migrationStartTime = Date.now();
    
    this.logMigration('🚀 === STARTING SIMPLIFIED MIGRATION PROCESS ===');
    this.logMigration('MIGRATION STRATEGY', {
      approach: 'SIMPLIFIED',
      targetFiles: ['db.sqlite3', 'clientLicense.enc'],
      preserveOriginal: true,
      oneTimeOnly: true
    });

    try {
      // Step 1: Check if migration already completed
      this.logMigration('📋 STEP 1: CHECKING MIGRATION STATUS');
      if (this.isMigrationCompleted()) {
        const result = {
          alreadyCompleted: true,
          success: true,
          message: 'Migration already completed previously'
        };
        this.logMigration('✅ MIGRATION ALREADY COMPLETED - SKIPPING', result);
        return result;
      }

      // Step 2: Ensure current directory exists
      this.logMigration('📋 STEP 2: ENSURING CURRENT USER DATA DIRECTORY');
      if (!fs.existsSync(this.currentUserDataDir)) {
        fs.mkdirSync(this.currentUserDataDir, { recursive: true });
        this.logMigration('📁 CREATED CURRENT USER DATA DIRECTORY', {
          path: this.currentUserDataDir
        });
      }

      // Step 3: Find old user data
      this.logMigration('📋 STEP 3: SEARCHING FOR OLD USER DATA');
      const oldUserData = this.findOldUserDataFiles();
      
      if (oldUserData.length === 0) {
        const result = {
          freshInstall: true,
          success: true,
          message: 'No old user data found - fresh installation'
        };
        this.logMigration('🆕 FRESH INSTALLATION DETECTED', result);
        this.markMigrationCompleted([]);
        return result;
      }

      // Step 4: Perform migration
      this.logMigration('📋 STEP 4: PERFORMING SIMPLIFIED DATA MIGRATION', {
        itemsToMigrate: oldUserData.length,
        items: oldUserData.map(item => ({ 
          name: item.fileName, 
          type: item.type, 
          priority: item.priority,
          description: item.description 
        }))
      });

      const migrationResults = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < oldUserData.length; i++) {
        const item = oldUserData[i];
        const itemStartTime = Date.now();
        
        this.logMigration(`🔄 MIGRATING ITEM ${i + 1}/${oldUserData.length}: ${item.fileName} (${item.priority})`, {
          type: item.type,
          description: item.description,
          priority: item.priority
        });
        
        let success = false;
        
        try {
          success = this.copyFile(item);
        } catch (error) {
          this.logMigration(`❌ MIGRATION ERROR FOR ITEM: ${item.fileName}`, {
            error: error.message,
            stack: error.stack,
            priority: item.priority
          });
          success = false;
        }
        
        const itemEndTime = Date.now();
        const itemDuration = itemEndTime - itemStartTime;
        
        const result = {
          ...item,
          migrationSuccess: success,
          newPath: path.join(this.currentUserDataDir, item.fileName),
          migrationDurationMs: itemDuration
        };
        
        migrationResults.push(result);
        
        if (success) {
          successCount++;
          this.logMigration(`✅ ITEM MIGRATION SUCCESS: ${item.fileName} (${item.priority})`, { 
            durationMs: itemDuration 
          });
        } else {
          failureCount++;
          this.logMigration(`❌ ITEM MIGRATION FAILED: ${item.fileName} (${item.priority})`, { 
            durationMs: itemDuration 
          });
        }
      }

      // Step 5: Complete migration
      this.logMigration('📋 STEP 5: COMPLETING MIGRATION PROCESS');
      this.markMigrationCompleted(migrationResults);
      
      const migrationEndTime = Date.now();
      const totalMigrationTime = migrationEndTime - migrationStartTime;
      
      const finalResult = {
        success: successCount > 0,
        totalItems: oldUserData.length,
        successfulMigrations: successCount,
        failedMigrations: failureCount,
        migratedItems: migrationResults,
        oldAppName: this.oldAppName,
        oldDirectory: this.getOldAppDataDirectory(),
        preservedOriginal: true,
        migrationDurationMs: totalMigrationTime,
        migrationDurationSeconds: (totalMigrationTime / 1000).toFixed(2),
        migrationVersion: 'simplified-v1.0'
      };

      if (finalResult.success) {
        this.logMigration('🎉 === SIMPLIFIED MIGRATION COMPLETED SUCCESSFULLY ===', {
          summary: `${successCount}/${oldUserData.length} critical files migrated successfully`,
          totalDuration: `${finalResult.migrationDurationSeconds} seconds`,
          note: 'Original files preserved in old app directory'
        });
      } else {
        this.logMigration('⚠️ === SIMPLIFIED MIGRATION COMPLETED WITH FAILURES ===', finalResult);
      }
      
      this.logMigration('='.repeat(80));
      
      return finalResult;
      
    } catch (error) {
      const migrationEndTime = Date.now();
      const totalMigrationTime = migrationEndTime - migrationStartTime;
      
      this.logMigration('💥 === CRITICAL MIGRATION ERROR ===', {
        error: error.message,
        stack: error.stack,
        totalDurationMs: totalMigrationTime,
        timestamp: new Date().toISOString()
      });
      
      return { 
        success: false, 
        error: error.message, 
        criticalError: true,
        migrationDurationMs: totalMigrationTime
      };
    }
  }

  /**
   * Get current migration status for debugging
   */
  getMigrationStatus() {
    const oldDir = this.getOldAppDataDirectory();
    const migrationFlag = path.join(this.currentUserDataDir, '.migration-completed');
    
    return {
      oldAppDirectory: oldDir,
      oldAppDirectoryExists: fs.existsSync(oldDir),
      currentUserDataDir: this.currentUserDataDir,
      currentUserDataDirExists: fs.existsSync(this.currentUserDataDir),
      migrationCompleted: fs.existsSync(migrationFlag),
      migrationFlagPath: migrationFlag,
      migrationLogPath: this.migrationLogFile,
      migrationVersion: 'simplified-v1.0'
    };
  }
}

module.exports = DatabaseMigration;