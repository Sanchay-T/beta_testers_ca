'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const packageJson = require('../package.json');
const version = process.env.APP_VERSION || packageJson.version;

if (!version) {
  console.error('APP_VERSION not found. Ensure frontend/.env or package.json has a version value.');
  process.exit(1);
}

const distDir = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.error(`Dist folder not found: ${distDir}`);
  console.error('Run a build before archiving.');
  process.exit(1);
}

const exeName = fs.readdirSync(distDir).find((file) => file.endsWith('.exe'));
if (!exeName) {
  console.error('No installer (.exe) found in dist.');
  process.exit(1);
}

const latestPath = path.join(distDir, 'latest.yml');
if (!fs.existsSync(latestPath)) {
  console.error('latest.yml not found in dist.');
  process.exit(1);
}

const releasesRoot = path.resolve(__dirname, '..', '..', 'releases');
const targetDir = path.join(releasesRoot, version);

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

const copyArtifact = (source, filename) => {
  const target = path.join(targetDir, filename);
  fs.copyFileSync(source, target);
  console.log(`Archived ${filename}`);
};

copyArtifact(path.join(distDir, exeName), exeName);
copyArtifact(latestPath, 'latest.yml');

const optionalFiles = ['builder-debug.yml', 'builder-effective-config.yaml'];
optionalFiles.forEach((fileName) => {
  const source = path.join(distDir, fileName);
  if (fs.existsSync(source)) {
    copyArtifact(source, fileName);
  }
});

console.log(`Release ${version} archived at ${targetDir}`);
