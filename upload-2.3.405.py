#!/usr/bin/env python
"""Upload 2.3.405 to test update flow from 2.3.404 → 2.3.405"""
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
print("  Upload CypherEdge UAT 2.3.405 (Update Test)")
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
installer_path = "frontend/dist/CypherEdge-UAT-Setup-2.3.405.exe"

# Check if installer exists
if not os.path.exists(installer_path):
    print(f"[FAIL] Installer not found at: {installer_path}")
    print("\nMake sure you ran: cd frontend && npm run build")
    sys.exit(1)

print("Step 1: Calculating SHA512 hash...")
sha512 = hashlib.sha512()
file_size = 0

with open(installer_path, 'rb') as f:
    while True:
        data = f.read(65536)
        if not data:
            break
        sha512.update(data)
        file_size += len(data)

hash_base64 = base64.b64encode(sha512.digest()).decode('utf-8')
print(f"  [OK] Size: {file_size:,} bytes ({file_size / (1024**2):.2f} MB)")
print(f"  [OK] SHA512: {hash_base64}\n")

# Upload installer
print("Step 2: Uploading installer...")
try:
    with open(installer_path, 'rb') as f:
        client.put_object(
            Bucket=BUCKET,
            Key='releases/windows/CypherEdge-UAT-Setup-2.3.405.exe',
            Body=f,
            ACL='public-read',
            ContentType='application/x-msdownload'
        )
    print(f"  [OK] Uploaded ({file_size / (1024**2):.2f} MB)\n")
except Exception as e:
    print(f"  [FAIL] {e}\n")
    sys.exit(1)

# Create and upload latest.yml
print("Step 3: Creating latest.yml...")
latest_yml = f"""version: 2.3.405
files:
  - url: CypherEdge-UAT-Setup-2.3.405.exe
    sha512: {hash_base64}
    size: {file_size}
path: CypherEdge-UAT-Setup-2.3.405.exe
sha512: {hash_base64}
releaseDate: '2025-01-11T12:00:00.000Z'
"""

print(latest_yml)

try:
    client.put_object(
        Bucket=BUCKET,
        Key='releases/windows/latest.yml',
        Body=latest_yml.encode('utf-8'),
        ACL='public-read',
        ContentType='text/yaml',
        CacheControl='max-age=0, no-cache, no-store, must-revalidate'
    )
    print("  [OK] latest.yml uploaded\n")
except Exception as e:
    print(f"  [FAIL] {e}\n")
    sys.exit(1)

print("="*70)
print("  UPLOAD COMPLETE! Ready to Test Update")
print("="*70)
print("\nCDN URLs:")
print(f"  {CDN_URL}/releases/windows/CypherEdge-UAT-Setup-2.3.405.exe")
print(f"  {CDN_URL}/releases/windows/latest.yml\n")

print("Testing Instructions:")
print("  1. Launch your installed CypherEdge UAT 2.3.404")
print("  2. Wait 30-60 seconds for update notification")
print("  3. Should see: 'Update Available: Version 2.3.405'")
print("  4. Click 'Download' -> Should download the REAL file from S3")
print("  5. Click 'Install Now' -> Purple 'Installing update...' window")
print("  6. App restarts automatically")
print("  7. Look for PURPLE/PINK badge 'v2.3.405 ✨' (with sparkle!)\n")

print("Visual Difference:")
print("  Current (2.3.404): Blue badge 'v2.3.404'")
print("  Updated (2.3.405): PURPLE/PINK badge 'v2.3.405 ✨'\n")
