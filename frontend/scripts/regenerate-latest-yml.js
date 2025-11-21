#!/usr/bin/env node
/**
 * CypherEdge - Regenerate latest.yml After Code Signing
 *
 * CRITICAL: This script must run AFTER signing the .exe file
 * Electron-builder generates latest.yml with pre-signing SHA512
 * After signing, we must recalculate the correct SHA512 hash
 *
 * Usage: node scripts/regenerate-latest-yml.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DIST_DIR = path.join(__dirname, '..', 'dist');

console.log('\n' + '='.repeat(70));
console.log('  CypherEdge - Regenerate latest.yml After Code Signing');
console.log('='.repeat(70) + '\n');

// Find the .exe file
const exeFiles = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.exe'));
if (exeFiles.length === 0) {
  console.error('❌ ERROR: No .exe file found in dist/');
  process.exit(1);
}

const exeFile = exeFiles[0];
const exePath = path.join(DIST_DIR, exeFile);
const exeSize = fs.statSync(exePath).size;
const exeSizeMB = (exeSize / (1024 * 1024)).toFixed(1);

console.log(`📦 Found: ${exeFile} (${exeSizeMB} MB)`);

// Calculate SHA512 hash
console.log('🔒 Calculating SHA512 hash of signed executable...');
const fileBuffer = fs.readFileSync(exePath);
const sha512 = crypto.createHash('sha512').update(fileBuffer).digest('base64');

console.log(`✅ SHA512: ${sha512.substring(0, 32)}...${sha512.substring(sha512.length - 8)}`);

// Extract version from filename (CypherEdge-Setup-2.3.600.exe)
const versionMatch = exeFile.match(/(\d+\.\d+\.\d+)/);
const version = versionMatch ? versionMatch[1] : 'unknown';

console.log(`📌 Version: ${version}`);

// Create new latest.yml structure
const latestYml = {
  version: version,
  files: [
    {
      url: exeFile,
      sha512: sha512,
      size: exeSize
    }
  ],
  path: exeFile,
  sha512: sha512,
  releaseDate: new Date().toISOString()
};

// Write latest.yml
const latestYmlPath = path.join(DIST_DIR, 'latest.yml');
const yamlContent = yaml.dump(latestYml, { lineWidth: -1 });
fs.writeFileSync(latestYmlPath, yamlContent, 'utf8');

console.log('✅ latest.yml regenerated with correct SHA512 hash\n');

// Verification
console.log('Verification:');
console.log(`  File: ${latestYmlPath}`);
console.log(`  Version: ${version}`);
console.log(`  SHA512: ${sha512}`);
console.log(`  Size: ${exeSize} bytes (${exeSizeMB} MB)`);
console.log(`  Date: ${latestYml.releaseDate}\n`);

console.log('='.repeat(70));
console.log('  ✅ Ready for upload to DigitalOcean Spaces');
console.log('='.repeat(70) + '\n');

console.log('Next step: npm run upload:spaces\n');
