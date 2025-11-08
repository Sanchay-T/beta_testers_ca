#!/usr/bin/env python
"""
CypherEdge Deployment Script
Uploads built .exe and latest.yml to DigitalOcean Spaces

Usage: python upload.py
"""

import boto3
import os
import sys
from pathlib import Path
from datetime import datetime
from botocore.client import Config
from dotenv import load_dotenv

# Load environment variables from frontend/.env
env_path = Path(__file__).parent / 'frontend' / '.env'
load_dotenv(env_path)

# Configuration from .env
ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
REGION = os.getenv('SPACES_REGION', 'blr1')
BUCKET = os.getenv('SPACES_BUCKET', 'cypheredge-exe-uat')
ENDPOINT = os.getenv('SPACES_ENDPOINT', f'https://{REGION}.digitaloceanspaces.com')
CDN_URL = f"https://{BUCKET}.{REGION}.cdn.digitaloceanspaces.com"
SPACES_PATH = "releases/windows"

# Build directory
DIST_DIR = Path(__file__).parent / 'frontend' / 'dist'

print("\n" + "="*70)
print("  CypherEdge Deployment to DigitalOcean Spaces")
print("="*70 + "\n")

# Validate configuration
if not ACCESS_KEY or not SECRET_KEY:
    print("❌ ERROR: Spaces credentials not found!")
    print("   Please ensure frontend/.env contains:")
    print("   - AWS_ACCESS_KEY_ID")
    print("   - AWS_SECRET_ACCESS_KEY")
    sys.exit(1)

print("Configuration:")
print(f"  Region: {REGION} (Bangalore)")
print(f"  Bucket: {BUCKET}")
print(f"  Path: {SPACES_PATH}")
print(f"  CDN: {CDN_URL}")
print(f"  Build Dir: {DIST_DIR}\n")

# Check if dist directory exists
if not DIST_DIR.exists():
    print(f"ERROR: Build directory not found: {DIST_DIR}")
    print("   Please run 'npm run build' in frontend/ first")
    sys.exit(1)

# Find .exe file
exe_files = list(DIST_DIR.glob("*.exe"))
if not exe_files:
    print(f"ERROR: No .exe file found in {DIST_DIR}")
    print("   Please build the app first: cd frontend && npm run build")
    sys.exit(1)

exe_file = exe_files[0]
exe_size_mb = exe_file.stat().st_size / (1024 * 1024)

print(f"Found installer:")
print(f"  {exe_file.name} ({exe_size_mb:.1f} MB)\n")

# Find latest.yml
latest_yml = DIST_DIR / 'latest.yml'
if not latest_yml.exists():
    print(f"ERROR: latest.yml not found in {DIST_DIR}")
    print("   This file is required for electron-updater")
    sys.exit(1)

# Read version from latest.yml
with open(latest_yml, 'r') as f:
    yml_content = f.read()
    for line in yml_content.split('\n'):
        if line.startswith('version:'):
            version = line.split(':')[1].strip()
            print(f"Version detected: {version}\n")
            break
    else:
        version = "unknown"

print("Files to upload:")
print(f"  1. {exe_file.name}")
print(f"  2. latest.yml\n")

# Confirmation
confirm = input("Upload to DigitalOcean Spaces? (y/n): ")
if confirm.lower() != 'y':
    print("Upload cancelled.")
    sys.exit(0)

print()

# Initialize S3 client
try:
    session = boto3.session.Session()
    client = session.client(
        's3',
        region_name=REGION,
        endpoint_url=ENDPOINT,
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        config=Config(signature_version='s3v4')
    )
    print("[1/3] OK - Connected to DigitalOcean Spaces")
except Exception as e:
    print(f"[1/3] FAIL - Failed to connect: {e}")
    sys.exit(1)

# Upload .exe file
print(f"[2/3] Uploading {exe_file.name}...")
try:
    def upload_progress(bytes_transferred):
        percent = (bytes_transferred / exe_file.stat().st_size) * 100
        print(f"      Progress: {percent:.1f}%", end='\r')

    client.upload_file(
        str(exe_file),
        BUCKET,
        f"{SPACES_PATH}/{exe_file.name}",
        ExtraArgs={
            'ACL': 'public-read',
            'ContentType': 'application/x-msdownload',
            'Metadata': {
                'version': version,
                'uploaded': datetime.now().isoformat()
            }
        },
        Callback=upload_progress
    )
    print(f"      OK - {exe_file.name} uploaded ({exe_size_mb:.1f} MB)      ")
except Exception as e:
    print(f"\n      FAIL - Upload failed: {e}")
    sys.exit(1)

# Upload latest.yml
print(f"[3/3] Uploading latest.yml...")
try:
    client.upload_file(
        str(latest_yml),
        BUCKET,
        f"{SPACES_PATH}/latest.yml",
        ExtraArgs={
            'ACL': 'public-read',
            'ContentType': 'text/yaml',
            'CacheControl': 'max-age=0, no-cache, no-store, must-revalidate'
        }
    )
    print(f"      OK - latest.yml uploaded (with no-cache headers)")
except Exception as e:
    print(f"      FAIL - Upload failed: {e}")
    sys.exit(1)

print()
print("="*70)
print("  Deployment Successful!")
print("="*70)
print()

# Verification
print("Verification:")
print(f"  Installer: {CDN_URL}/{SPACES_PATH}/{exe_file.name}")
print(f"  Manifest:  {CDN_URL}/{SPACES_PATH}/latest.yml")
print()

print("Testing CDN accessibility...")
import time
import urllib.request

time.sleep(2)  # Wait for CDN propagation

latest_url = f"{CDN_URL}/{SPACES_PATH}/latest.yml"
try:
    response = urllib.request.urlopen(latest_url)
    if response.status == 200:
        print(f"  OK - CDN accessible! (HTTP {response.status})")
        print(f"  OK - Update server is live")
    else:
        print(f"  WARN - Unexpected status: {response.status}")
except Exception as e:
    print(f"  WARN - CDN not accessible yet: {e}")
    print(f"  Note: May take 1-2 minutes to propagate")
    print(f"  Manual check: {latest_url}")

print()
print("Next steps:")
print("  1. All installed CypherEdge apps will detect this update")
print("  2. Users will see 'Update Available' notification")
print("  3. Update will download from BLR1 CDN (fast for Indian users!)")
print()
