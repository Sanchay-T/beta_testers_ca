#!/usr/bin/env python
"""Download 2.3.404 installer, calculate real SHA512, and update latest.yml"""
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

print("\n" + "="*60)
print("  Fix latest.yml with Correct SHA512 Hash")
print("="*60 + "\n")

# Initialize S3 client
client = boto3.session.Session().client(
    's3',
    region_name=REGION,
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=Config(signature_version='s3v4')
)

exe_key = "releases/windows/CypherEdge-UAT-Setup-2.3.404.exe"
temp_file = "temp_installer.exe"

print("Step 1: Downloading installer to calculate hash...")
print(f"  File: {exe_key}")

try:
    client.download_file(BUCKET, exe_key, temp_file)
    file_size = os.path.getsize(temp_file)
    print(f"  [OK] Downloaded {file_size:,} bytes\n")
except Exception as e:
    print(f"  [FAIL] Download failed: {e}\n")
    sys.exit(1)

print("Step 2: Calculating SHA512 hash...")
sha512 = hashlib.sha512()
with open(temp_file, 'rb') as f:
    while True:
        data = f.read(65536)  # 64KB chunks
        if not data:
            break
        sha512.update(data)

hash_bytes = sha512.digest()
hash_base64 = base64.b64encode(hash_bytes).decode('utf-8')
print(f"  [OK] SHA512: {hash_base64}\n")

# Clean up temp file
os.remove(temp_file)

print("Step 3: Creating corrected latest.yml...")
latest_yml_content = f"""version: 2.3.404
files:
  - url: CypherEdge-UAT-Setup-2.3.404.exe
    sha512: {hash_base64}
    size: {file_size}
path: CypherEdge-UAT-Setup-2.3.404.exe
sha512: {hash_base64}
releaseDate: '2025-01-11T10:00:00.000Z'
"""

print("Content to upload:")
print(latest_yml_content)

print("\nStep 4: Uploading corrected latest.yml...")
try:
    client.put_object(
        Bucket=BUCKET,
        Key='releases/windows/latest.yml',
        Body=latest_yml_content.encode('utf-8'),
        ACL='public-read',
        ContentType='text/yaml',
        CacheControl='max-age=0, no-cache, no-store, must-revalidate'
    )
    print("  [OK] Upload successful!\n")
except Exception as e:
    print(f"  [FAIL] Upload failed: {e}\n")
    sys.exit(1)

print("\n" + "="*60)
print("  COMPLETE! Update should work now:")
print("="*60)
print("\n1. Restart CypherEdge UAT (2.3.403)")
print("2. Wait for 'Update Available' notification")
print("3. Click 'Download' - should complete without checksum error")
print("4. Click 'Install' to verify installer runs\n")
print(f"CDN URL: {CDN_URL}/releases/windows/latest.yml\n")
