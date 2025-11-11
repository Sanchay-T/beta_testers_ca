#!/usr/bin/env python
"""Upload REAL 2.3.404 installer to DigitalOcean Spaces with correct SHA512"""
import boto3
from botocore.client import Config
import hashlib
import base64
import sys
import os

# From .env
ACCESS_KEY = "DO00V8GXBHB7BYZW2WJJ"
SECRET_KEY = "YG/PmVxCzH0/Um+BQPFXepvOexvyfPBLVN8eXaz2mRc"
REGION = "blr1"
BUCKET = "cypheredge-exe-uat"
ENDPOINT = f"https://{REGION}.digitaloceanspaces.com"
CDN_URL = f"https://{BUCKET}.{REGION}.cdn.digitaloceanspaces.com"

print("\n" + "="*70)
print("  Upload Real CypherEdge UAT 2.3.404 to DigitalOcean Spaces")
print("="*70 + "\n")

# Initialize S3 client
client = boto3.session.Session().client(
    's3',
    region_name=REGION,
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=Config(signature_version='s3v4')
)

# Path to the built installer
installer_path = "frontend/dist/CypherEdge-UAT-Setup-2.3.404.exe"
blockmap_path = "frontend/dist/CypherEdge-UAT-Setup-2.3.404.exe.blockmap"

# Check if installer exists
if not os.path.exists(installer_path):
    print(f"[FAIL] Installer not found at: {installer_path}")
    print("\nMake sure you ran: cd frontend && npm run build")
    sys.exit(1)

print("Step 1: Calculating SHA512 hash of installer...")
print(f"  File: {installer_path}")

sha512 = hashlib.sha512()
file_size = 0

with open(installer_path, 'rb') as f:
    while True:
        data = f.read(65536)  # 64KB chunks
        if not data:
            break
        sha512.update(data)
        file_size += len(data)

hash_bytes = sha512.digest()
hash_base64 = base64.b64encode(hash_bytes).decode('utf-8')

print(f"  [OK] File size: {file_size:,} bytes ({file_size / (1024**2):.2f} MB)")
print(f"  [OK] SHA512: {hash_base64}\n")

# Upload installer
print("Step 2: Uploading installer to Spaces...")
print(f"  Destination: releases/windows/CypherEdge-UAT-Setup-2.3.404.exe")

try:
    with open(installer_path, 'rb') as f:
        client.put_object(
            Bucket=BUCKET,
            Key='releases/windows/CypherEdge-UAT-Setup-2.3.404.exe',
            Body=f,
            ACL='public-read',
            ContentType='application/x-msdownload',
            Metadata={
                'version': '2.3.404',
                'upload-date': '2025-01-11'
            }
        )
    print(f"  [OK] Installer uploaded successfully ({file_size / (1024**2):.2f} MB)\n")
except Exception as e:
    print(f"  [FAIL] Upload failed: {e}\n")
    sys.exit(1)

# Upload blockmap if exists
print("Step 3: Uploading blockmap (if exists)...")
if os.path.exists(blockmap_path):
    try:
        with open(blockmap_path, 'rb') as f:
            client.put_object(
                Bucket=BUCKET,
                Key='releases/windows/CypherEdge-UAT-Setup-2.3.404.exe.blockmap',
                Body=f,
                ACL='public-read',
                ContentType='application/octet-stream'
            )
        print(f"  [OK] Blockmap uploaded\n")
    except Exception as e:
        print(f"  [WARN] Blockmap upload failed: {e}\n")
else:
    print(f"  [INFO] Blockmap not found (optional)\n")

# Create latest.yml with correct hash
print("Step 4: Creating and uploading latest.yml...")

latest_yml_content = f"""version: 2.3.404
files:
  - url: CypherEdge-UAT-Setup-2.3.404.exe
    sha512: {hash_base64}
    size: {file_size}
path: CypherEdge-UAT-Setup-2.3.404.exe
sha512: {hash_base64}
releaseDate: '2025-01-11T10:00:00.000Z'
"""

print("Content:")
print(latest_yml_content)

try:
    client.put_object(
        Bucket=BUCKET,
        Key='releases/windows/latest.yml',
        Body=latest_yml_content.encode('utf-8'),
        ACL='public-read',
        ContentType='text/yaml',
        CacheControl='max-age=0, no-cache, no-store, must-revalidate'
    )
    print("  [OK] latest.yml uploaded\n")
except Exception as e:
    print(f"  [FAIL] latest.yml upload failed: {e}\n")
    sys.exit(1)

print("\n" + "="*70)
print("  UPLOAD COMPLETE! Ready to Test Update")
print("="*70)
print("\n[SUCCESS] All files uploaded successfully!\n")

print("Files on CDN:")
print(f"  {CDN_URL}/releases/windows/CypherEdge-UAT-Setup-2.3.404.exe")
print(f"  {CDN_URL}/releases/windows/CypherEdge-UAT-Setup-2.3.404.exe.blockmap")
print(f"  {CDN_URL}/releases/windows/latest.yml\n")

print("Testing Instructions:")
print("  1. Launch CypherEdge UAT version 2.3.403")
print("  2. Wait ~30 seconds for update notification")
print("  3. You should see: 'Update Available: Version 2.3.404'")
print("  4. Click 'Download' -> should complete successfully")
print("  5. Click 'Install Now' -> 'Installing update...' window appears")
print("  6. App restarts automatically")
print("  7. Look for GREEN badge 'v2.3.404 - UPDATED!' in dashboard\n")

print("What's Different in 2.3.404:")
print("  - Version badge is now GREEN (was blue)")
print("  - Text shows 'v2.3.404 - UPDATED!' (was just 'v2.3.404')")
print("  - Badge is bigger and bolder with shadow\n")
