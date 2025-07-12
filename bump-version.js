#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Version Bumping Script for CypherEdge
 * 
 * Usage:
 *   node bump-version.js <new-version>
 *   node bump-version.js 2.0.2
 * 
 * This script updates version numbers across all relevant files:
 * - package.json files
 * - splash.html
 * - MainDashboard.js
 * - main.js
 */

// Get the new version from command line arguments
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('❌ Error: Please provide a version number');
  console.log('Usage: node bump-version.js <version>');
  console.log('Example: node bump-version.js 2.0.2');
  process.exit(1);
}

// Validate version format (basic semver check)
const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(newVersion)) {
  console.error('❌ Error: Invalid version format. Use semantic versioning (e.g., 2.0.2)');
  process.exit(1);
}

console.log(`🚀 Bumping version to ${newVersion}...`);

// Define all files that need version updates
const filesToUpdate = [
  {
    path: 'frontend/package.json',
    type: 'json',
    field: 'version',
    description: 'Frontend package.json'
  },
  {
    path: 'frontend/react-app/package.json',
    type: 'json',
    field: 'version',
    description: 'React app package.json'
  },
  {
    path: 'frontend/react-app/splash.html',
    type: 'html',
    pattern: /Version \d+\.\d+\.\d+/g,
    replacement: `Version ${newVersion}`,
    description: 'Splash screen version badge'
  },
  {
    path: 'frontend/react-app/src/components/MainDashboardComponents/MainDashboard.js',
    type: 'js',
    pattern: /v\d+\.\d+\.\d+/g,
    replacement: `v${newVersion}`,
    description: 'Dashboard version display'
  },
  {
    path: 'frontend/main.js',
    type: 'js',
    patterns: [
      {
        pattern: /🚀 COMPREHENSIVE AUTO-UPDATE LOGGING SYSTEM v\d+\.\d+\.\d+/g,
        replacement: `🚀 COMPREHENSIVE AUTO-UPDATE LOGGING SYSTEM v${newVersion}`
      },
      {
        pattern: /🚀 CYPHERSOL AUTO-UPDATE LOGGING SYSTEM v\d+\.\d+\.\d+ INITIALIZED/g,
        replacement: `🚀 CYPHERSOL AUTO-UPDATE LOGGING SYSTEM v${newVersion} INITIALIZED`
      }
    ],
    description: 'Main.js logging system version'
  }
];

let updatedFiles = 0;
let errors = 0;

// Function to update JSON files
function updateJsonFile(filePath, field, newValue) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    const oldVersion = json[field];
    
    json[field] = newValue;
    
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
    console.log(`✅ ${filePath}: ${oldVersion} → ${newValue}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Function to update text files with regex patterns
function updateTextFile(filePath, patterns, description) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    let changeLog = [];

    // Handle single pattern or array of patterns
    const patternArray = Array.isArray(patterns) ? patterns : [{ pattern: patterns.pattern, replacement: patterns.replacement }];

    patternArray.forEach(({ pattern, replacement }) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          changeLog.push(`${match} → ${replacement}`);
        });
        content = content.replace(pattern, replacement);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ ${filePath}: ${changeLog.join(', ')}`);
      return true;
    } else {
      console.log(`⚠️  ${filePath}: No version patterns found to update`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Process each file
filesToUpdate.forEach(file => {
  console.log(`\n📝 Updating ${file.description}...`);
  
  // Check if file exists
  if (!fs.existsSync(file.path)) {
    console.error(`❌ File not found: ${file.path}`);
    errors++;
    return;
  }

  let success = false;

  switch (file.type) {
    case 'json':
      success = updateJsonFile(file.path, file.field, newVersion);
      break;
    
    case 'html':
    case 'js':
      if (file.patterns) {
        success = updateTextFile(file.path, file.patterns, file.description);
      } else {
        success = updateTextFile(file.path, { pattern: file.pattern, replacement: file.replacement }, file.description);
      }
      break;
    
    default:
      console.error(`❌ Unknown file type: ${file.type}`);
      errors++;
      return;
  }

  if (success) {
    updatedFiles++;
  } else {
    errors++;
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 VERSION BUMP SUMMARY');
console.log('='.repeat(50));
console.log(`🎯 Target Version: ${newVersion}`);
console.log(`✅ Files Updated: ${updatedFiles}`);
console.log(`❌ Errors: ${errors}`);

if (errors === 0) {
  console.log('\n🎉 Version bump completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Review the changes with git diff');
  console.log('2. Test the application');
  console.log('3. Commit and push the changes');
  console.log('4. Build and release the new version');
} else {
  console.log('\n⚠️  Version bump completed with errors. Please review the issues above.');
  process.exit(1);
} 