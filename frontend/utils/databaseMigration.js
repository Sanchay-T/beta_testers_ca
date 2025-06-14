const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const log = require("electron-log");

class DatabaseMigration {
  constructor() {
    this.currentUserDataDir = app.getPath("userData");
    this.migrationLogFile = path.join(
      this.currentUserDataDir,
      "migration-detailed.log"
    );

    // Possible old app names (we'll detect which one exists dynamically)
    this.possibleOldAppNames = [
      "cyphersol-electron-app",
      "cyphersol-ats-electron-app",
      "cyphersol-ats",
    ];

    // Will be set dynamically when we find which old app exists
    this.oldAppName = null;
    this.oldAppDirectory = null;

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
      possibleOldAppNames: this.possibleOldAppNames,
      oldAppName: this.oldAppName || "Will be discovered dynamically",
      processId: process.pid,
      workingDirectory: process.cwd(),
      migrationStrategy:
        "Dynamic old app discovery + simplified file migration",
    };

    this.logMigration("🚀 SIMPLIFIED MIGRATION SYSTEM INITIALIZED", systemInfo);
    this.logMigration("=".repeat(80));
  }

  /**
   * Dynamically discover which old app directory exists and return it
   */
  getOldAppDataDirectory() {
    // If already discovered, return cached result
    if (this.oldAppDirectory && this.oldAppName) {
      this.logMigration("📁 USING CACHED OLD APP DIRECTORY", {
        oldAppName: this.oldAppName,
        oldAppDirectory: this.oldAppDirectory,
      });
      return this.oldAppDirectory;
    }

    const appDataRoot = path.dirname(this.currentUserDataDir);

    this.logMigration("🔍 STARTING DYNAMIC OLD APP DIRECTORY DISCOVERY", {
      appDataRoot: appDataRoot,
      possibleOldAppNames: this.possibleOldAppNames,
      searchStrategy: "Find first existing directory with critical files",
    });

    // Check each possible old app name to see which one exists
    for (const possibleName of this.possibleOldAppNames) {
      const possibleDir = path.join(appDataRoot, possibleName);

      this.logMigration(`🔍 CHECKING POSSIBLE OLD APP: ${possibleName}`, {
        path: possibleDir,
        exists: fs.existsSync(possibleDir),
      });

      if (fs.existsSync(possibleDir)) {
        // Check if this directory has critical files (database AND license - both required)
        const dbPath = path.join(possibleDir, "db.sqlite3");
        const licensePath = path.join(possibleDir, "clientLicense.enc");

        const hasDb = fs.existsSync(dbPath);
        const hasLicense = fs.existsSync(licensePath);

        this.logMigration(`📊 DIRECTORY CONTENT ANALYSIS: ${possibleName}`, {
          path: possibleDir,
          hasDatabase: hasDb,
          hasLicense: hasLicense,
          dbPath: dbPath,
          licensePath: licensePath,
        });

        // Both critical files are required - database AND license must both exist
        if (hasDb && hasLicense) {
          this.oldAppName = possibleName;
          this.oldAppDirectory = possibleDir;

          this.logMigration("✅ OLD APP DIRECTORY DISCOVERED!", {
            detectedOldAppName: this.oldAppName,
            detectedOldAppDirectory: this.oldAppDirectory,
            hasDatabase: hasDb,
            hasLicense: hasLicense,
            validationReason: "Contains both database and license files",
          });

          return this.oldAppDirectory;
        } else {
          this.logMigration(
            `⚠️ DIRECTORY EXISTS BUT MISSING CRITICAL FILES: ${possibleName}`,
            {
              path: possibleDir,
              hasDatabase: hasDb,
              hasLicense: hasLicense,
              note: "Skipping - requires BOTH db.sqlite3 AND clientLicense.enc",
            }
          );
        }
      }
    }

    // No old app directory found
    this.logMigration("🆕 NO OLD APP DIRECTORY FOUND", {
      checkedDirectories: this.possibleOldAppNames.map((name) => ({
        name: name,
        path: path.join(appDataRoot, name),
        exists: fs.existsSync(path.join(appDataRoot, name)),
      })),
      conclusion: "Fresh installation - no previous app data to migrate",
    });

    return null;
  }

  /**
   * Check if migration has already been performed for this installation
   */
  isMigrationCompleted() {
    const migrationFlagFile = path.join(
      this.currentUserDataDir,
      ".migration-completed"
    );
    const exists = fs.existsSync(migrationFlagFile);

    this.logMigration("🔍 CHECKING MIGRATION STATUS", {
      flagFile: migrationFlagFile,
      exists: exists,
      currentUserDataDirExists: fs.existsSync(this.currentUserDataDir),
    });

    if (exists) {
      try {
        const content = fs.readFileSync(migrationFlagFile, "utf8");
        const migrationInfo = JSON.parse(content);
        this.logMigration("📄 EXISTING MIGRATION INFO FOUND", migrationInfo);
      } catch (error) {
        this.logMigration("❌ ERROR READING MIGRATION FLAG", {
          error: error.message,
        });
      }
    }

    return exists;
  }

  /**
   * Mark migration as completed with detailed information
   */
  markMigrationCompleted(migrationResults = []) {
    const migrationFlagFile = path.join(
      this.currentUserDataDir,
      ".migration-completed"
    );
    const migrationInfo = {
      completedAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: process.platform,
      oldAppName: this.oldAppName,
      oldDirectory: this.oldAppDirectory || this.getOldAppDataDirectory(),
      currentDirectory: this.currentUserDataDir,
      migratedFiles: migrationResults,
      possibleOldAppNames: this.possibleOldAppNames,
      migrationStrategy: "Dynamic discovery",
      note: this.oldAppName
        ? "Original files preserved in old location"
        : "Fresh installation - no old files to preserve",
      migrationLogFile: this.migrationLogFile,
      processId: process.pid,
      migrationVersion: "dynamic-v1.0",
    };

    try {
      fs.writeFileSync(
        migrationFlagFile,
        JSON.stringify(migrationInfo, null, 2)
      );
      this.logMigration("✅ MIGRATION COMPLETION FLAG CREATED", {
        flagFile: migrationFlagFile,
        migrationInfo: migrationInfo,
      });
    } catch (error) {
      this.logMigration("❌ FAILED TO CREATE MIGRATION FLAG", {
        error: error.message,
        flagFile: migrationFlagFile,
      });
    }
  }

  /**
   * Enhanced logging with multiple outputs and detailed context
   */
  logMigration(message, data = null) {
    const timestamp = new Date().toISOString();
    const formattedEntry = `[${timestamp}] [PID:${process.pid}] ${message}${
      data ? "\n" + JSON.stringify(data, null, 2) : ""
    }\n`;

    // 1. Log to electron-log (appears in main app logs)
    if (data) {
      log.info(`[SIMPLE-MIGRATION] ${message}`, data);
    } else {
      log.info(`[SIMPLE-MIGRATION] ${message}`);
    }

    // 2. Log to console for immediate visibility during development
    console.log(`[SIMPLE-MIGRATION] ${message}`, data || "");

    // 3. Log to dedicated migration file for detailed audit trail
    try {
      // Ensure current userData directory exists
      if (!fs.existsSync(this.currentUserDataDir)) {
        fs.mkdirSync(this.currentUserDataDir, { recursive: true });
        console.log(
          `[SIMPLE-MIGRATION] Created userData directory: ${this.currentUserDataDir}`
        );
      }

      fs.appendFileSync(this.migrationLogFile, formattedEntry);
    } catch (error) {
      console.error(
        "[SIMPLE-MIGRATION] CRITICAL: Failed to write to migration log file:",
        error
      );
      log.error(
        "[SIMPLE-MIGRATION] CRITICAL: Failed to write to migration log file:",
        error
      );
    }

    // 4. Also write to a backup log in temp directory as failsafe
    try {
      const tempLogFile = path.join(
        app.getPath("temp"),
        "cyphersol-migration-backup.log"
      );
      fs.appendFileSync(tempLogFile, formattedEntry);
    } catch (error) {
      console.error("[SIMPLE-MIGRATION] Failed to write backup log:", error);
    }
  }

  /**
   * Find critical user data files (simplified to only essential files)
   */
  findOldUserDataFiles() {
    const oldDir = this.getOldAppDataDirectory();
    const foundFiles = [];

    this.logMigration("🔍 === STARTING SIMPLIFIED USER DATA SEARCH ===");
    this.logMigration("SEARCH PARAMETERS", {
      oldAppDirectory: oldDir,
      newAppDirectory: this.currentUserDataDir,
      oldAppName: this.oldAppName,
      possibleOldAppNames: this.possibleOldAppNames,
      strategy: "DYNAMIC DISCOVERY + SIMPLIFIED - Only Critical Files",
    });

    if (!oldDir || !fs.existsSync(oldDir)) {
      this.logMigration(
        "🆕 NO OLD APP DATA FOUND - FRESH INSTALLATION DETECTED",
        {
          checkedPossibleNames: this.possibleOldAppNames,
          discoveredOldAppName: this.oldAppName,
          discoveredOldDirectory: oldDir,
        }
      );
      return foundFiles;
    }

    // SIMPLIFIED FILES LIST - Only the absolutely critical files
    const criticalFiles = [
      {
        name: "db.sqlite3",
        description: "Main application database",
        priority: "CRITICAL",
      },
      {
        name: "clientLicense.enc",
        description: "Encrypted license file",
        priority: "CRITICAL",
      },
    ];

    this.logMigration("📋 SEARCHING FOR CRITICAL FILES ONLY", {
      totalFiles: criticalFiles.length,
      files: criticalFiles.map((f) => f.name),
    });

    // Check for critical files
    for (const fileInfo of criticalFiles) {
      const filePath = path.join(oldDir, fileInfo.name);

      this.logMigration(
        `🔍 Checking ${fileInfo.priority} file: ${fileInfo.name}`,
        {
          path: filePath,
          description: fileInfo.description,
          priority: fileInfo.priority,
        }
      );

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
            priority: fileInfo.priority,
          });

          // Only migrate files that have content
          if (stats.size > 0) {
            foundFiles.push({
              type: "file",
              oldPath: filePath,
              fileName: fileInfo.name,
              description: fileInfo.description,
              priority: fileInfo.priority,
              size: stats.size,
              lastModified: stats.mtime,
              sourceDirectory: oldDir,
            });

            this.logMigration(
              `✅ ADDED TO MIGRATION LIST: ${fileInfo.name} (${fileInfo.priority})`
            );
          } else {
            this.logMigration(`⚠️ SKIPPING EMPTY FILE: ${fileInfo.name}`, {
              path: filePath,
            });
          }
        } catch (error) {
          this.logMigration(`❌ ERROR ANALYZING FILE: ${fileInfo.name}`, {
            path: filePath,
            error: error.message,
          });
        }
      } else {
        this.logMigration(`❌ CRITICAL FILE NOT FOUND: ${fileInfo.name}`, {
          path: filePath,
        });
      }
    }

    this.logMigration("📊 === SIMPLIFIED SEARCH SUMMARY ===", {
      totalItemsFound: foundFiles.length,
      criticalItemsFound: foundFiles.length,
      foundItems: foundFiles.map((f) => ({
        name: f.fileName,
        type: f.type,
        priority: f.priority,
        description: f.description,
      })),
    });

    return foundFiles;
  }

  /**
   * Copy a single file with extensive verification and logging
   */
  copyFile(sourceInfo) {
    const { oldPath, fileName, description, priority } = sourceInfo;
    const newPath = path.join(this.currentUserDataDir, fileName);

    this.logMigration(
      `📄 === STARTING FILE COPY: ${fileName} (${priority}) ===`,
      {
        description: description,
        priority: priority,
        source: oldPath,
        destination: newPath,
      }
    );

    try {
      // Pre-copy analysis
      const sourceStats = fs.statSync(oldPath);
      this.logMigration(`📊 SOURCE FILE ANALYSIS: ${fileName}`, {
        path: oldPath,
        size: sourceStats.size,
        sizeKB: (sourceStats.size / 1024).toFixed(2),
        created: sourceStats.birthtime,
        modified: sourceStats.mtime,
        priority: priority,
      });

      // Check if destination already exists
      if (fs.existsSync(newPath)) {
        const existingStats = fs.statSync(newPath);
        this.logMigration(`⚠️ DESTINATION FILE EXISTS: ${fileName}`, {
          path: newPath,
          existingSize: existingStats.size,
          existingSizeKB: (existingStats.size / 1024).toFixed(2),
          existingModified: existingStats.mtime,
        });

        if (existingStats.size > 0) {
          // Create backup
          const backupDir = path.join(
            this.currentUserDataDir,
            "pre-migration-backups"
          );
          const timestamp = Date.now();
          const backupPath = path.join(
            backupDir,
            `${fileName}.backup.${timestamp}`
          );

          this.logMigration(
            `💾 CREATING BACKUP OF EXISTING FILE: ${fileName}`,
            {
              backupPath: backupPath,
            }
          );

          if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
            this.logMigration(`📁 CREATED BACKUP DIRECTORY: ${backupDir}`);
          }

          fs.copyFileSync(newPath, backupPath);
          const backupStats = fs.statSync(backupPath);

          this.logMigration(`✅ BACKUP CREATED SUCCESSFULLY: ${fileName}`, {
            backupPath: backupPath,
            backupSize: backupStats.size,
            verified: backupStats.size === existingStats.size,
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
        copySpeedKBps:
          sourceStats.size > 0
            ? (sourceStats.size / 1024 / (copyDuration / 1000)).toFixed(2)
            : 0,
        priority: priority,
      };

      if (verificationResult.sizesMatch) {
        this.logMigration(
          `✅ FILE COPY SUCCESSFUL: ${fileName} (${priority})`,
          {
            source: oldPath,
            destination: newPath,
            verification: verificationResult,
          }
        );
        return true;
      } else {
        throw new Error(
          `File size mismatch after copy. Original: ${sourceStats.size}, Copy: ${newStats.size}`
        );
      }
    } catch (error) {
      this.logMigration(`❌ FILE COPY FAILED: ${fileName} (${priority})`, {
        error: error.message,
        stack: error.stack,
        source: oldPath,
        destination: newPath,
        priority: priority,
      });
      return false;
    }
  }

  /**
   * Perform the simplified migration process
   */
  async performMigration() {
    const migrationStartTime = Date.now();

    this.logMigration("🚀 === STARTING DYNAMIC MIGRATION PROCESS ===");
    this.logMigration("MIGRATION STRATEGY", {
      approach: "DYNAMIC DISCOVERY + SIMPLIFIED",
      possibleOldApps: this.possibleOldAppNames,
      targetFiles: ["db.sqlite3", "clientLicense.enc"],
      preserveOriginal: true,
      oneTimeOnly: true,
      discoveryStrategy:
        "Auto-detect which old app directory exists with critical files",
    });

    try {
      // Step 1: Check if migration already completed
      this.logMigration("📋 STEP 1: CHECKING MIGRATION STATUS");
      if (this.isMigrationCompleted()) {
        const result = {
          alreadyCompleted: true,
          success: true,
          message: "Migration already completed previously",
        };
        this.logMigration("✅ MIGRATION ALREADY COMPLETED - SKIPPING", result);
        return result;
      }

      // Step 2: Ensure current directory exists
      this.logMigration("📋 STEP 2: ENSURING CURRENT USER DATA DIRECTORY");
      if (!fs.existsSync(this.currentUserDataDir)) {
        fs.mkdirSync(this.currentUserDataDir, { recursive: true });
        this.logMigration("📁 CREATED CURRENT USER DATA DIRECTORY", {
          path: this.currentUserDataDir,
        });
      }

      // Step 3: Find old user data
      this.logMigration("📋 STEP 3: SEARCHING FOR OLD USER DATA");
      const oldUserData = this.findOldUserDataFiles();

      if (oldUserData.length === 0) {
        const result = {
          freshInstall: true,
          success: true,
          message: "No old user data found - fresh installation",
        };
        this.logMigration("🆕 FRESH INSTALLATION DETECTED", result);
        this.markMigrationCompleted([]);
        return result;
      }

      // Step 4: Perform migration
      this.logMigration("📋 STEP 4: PERFORMING SIMPLIFIED DATA MIGRATION", {
        itemsToMigrate: oldUserData.length,
        items: oldUserData.map((item) => ({
          name: item.fileName,
          type: item.type,
          priority: item.priority,
          description: item.description,
        })),
      });

      const migrationResults = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < oldUserData.length; i++) {
        const item = oldUserData[i];
        const itemStartTime = Date.now();

        this.logMigration(
          `🔄 MIGRATING ITEM ${i + 1}/${oldUserData.length}: ${
            item.fileName
          } (${item.priority})`,
          {
            type: item.type,
            description: item.description,
            priority: item.priority,
          }
        );

        let success = false;

        try {
          success = this.copyFile(item);
        } catch (error) {
          this.logMigration(`❌ MIGRATION ERROR FOR ITEM: ${item.fileName}`, {
            error: error.message,
            stack: error.stack,
            priority: item.priority,
          });
          success = false;
        }

        const itemEndTime = Date.now();
        const itemDuration = itemEndTime - itemStartTime;

        const result = {
          ...item,
          migrationSuccess: success,
          newPath: path.join(this.currentUserDataDir, item.fileName),
          migrationDurationMs: itemDuration,
        };

        migrationResults.push(result);

        if (success) {
          successCount++;
          this.logMigration(
            `✅ ITEM MIGRATION SUCCESS: ${item.fileName} (${item.priority})`,
            {
              durationMs: itemDuration,
            }
          );
        } else {
          failureCount++;
          this.logMigration(
            `❌ ITEM MIGRATION FAILED: ${item.fileName} (${item.priority})`,
            {
              durationMs: itemDuration,
            }
          );
        }
      }

      // Step 5: Complete migration
      this.logMigration("📋 STEP 5: COMPLETING MIGRATION PROCESS");
      
      // ONLY mark migration as complete if ALL critical files were successfully migrated
      if (successCount === oldUserData.length && failureCount === 0) {
        this.markMigrationCompleted(migrationResults);
        this.logMigration("✅ ALL FILES MIGRATED - MARKING AS COMPLETE");
      } else {
        this.logMigration("⚠️ PARTIAL MIGRATION - NOT MARKING AS COMPLETE", {
          totalFiles: oldUserData.length,
          successCount: successCount,
          failureCount: failureCount,
          willRetryOnNextStart: true
        });
      }

      const migrationEndTime = Date.now();
      const totalMigrationTime = migrationEndTime - migrationStartTime;

      const finalResult = {
        success: successCount === oldUserData.length && failureCount === 0,  // Fixed: ALL files must succeed
        totalItems: oldUserData.length,
        successfulMigrations: successCount,
        failedMigrations: failureCount,
        migratedItems: migrationResults,
        discoveryStrategy: "Dynamic old app detection",
        possibleOldAppNames: this.possibleOldAppNames,
        discoveredOldAppName: this.oldAppName,
        oldDirectory: this.oldAppDirectory,
        preservedOriginal: true,
        migrationDurationMs: totalMigrationTime,
        migrationDurationSeconds: (totalMigrationTime / 1000).toFixed(2),
        migrationVersion: "dynamic-v1.0",
      };

      if (finalResult.success) {
        this.logMigration(
          "🎉 === DYNAMIC MIGRATION COMPLETED SUCCESSFULLY ===",
          {
            summary: `${successCount}/${oldUserData.length} critical files migrated successfully`,
            discoveredOldApp: this.oldAppName,
            fromDirectory: this.oldAppDirectory,
            toDirectory: this.currentUserDataDir,
            totalDuration: `${finalResult.migrationDurationSeconds} seconds`,
            note: "Original files preserved in old app directory",
          }
        );
      } else {
        this.logMigration(
          "⚠️ === DYNAMIC MIGRATION COMPLETED WITH FAILURES ===",
          finalResult
        );
      }

      this.logMigration("=".repeat(80));

      return finalResult;
    } catch (error) {
      const migrationEndTime = Date.now();
      const totalMigrationTime = migrationEndTime - migrationStartTime;

      this.logMigration("💥 === CRITICAL MIGRATION ERROR ===", {
        error: error.message,
        stack: error.stack,
        totalDurationMs: totalMigrationTime,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: error.message,
        criticalError: true,
        migrationDurationMs: totalMigrationTime,
      };
    }
  }

  /**
   * Get current migration status for debugging
   */
  getMigrationStatus() {
    const oldDir = this.getOldAppDataDirectory();
    const migrationFlag = path.join(
      this.currentUserDataDir,
      ".migration-completed"
    );

    return {
      migrationStrategy: "Dynamic old app discovery",
      possibleOldAppNames: this.possibleOldAppNames,
      discoveredOldAppName: this.oldAppName,
      oldAppDirectory: oldDir,
      oldAppDirectoryExists: oldDir ? fs.existsSync(oldDir) : false,
      currentUserDataDir: this.currentUserDataDir,
      currentUserDataDirExists: fs.existsSync(this.currentUserDataDir),
      migrationCompleted: fs.existsSync(migrationFlag),
      migrationFlagPath: migrationFlag,
      migrationLogPath: this.migrationLogFile,
      migrationVersion: "dynamic-v1.0",
    };
  }
}

module.exports = DatabaseMigration;
