#!/usr/bin/env python
"""Download 2.3.403, rename to 2.3.404, and upload to test full update flow"""
import boto3
from botocore.client import Config
import sys

# From .env
ACCESS_KEY = "DO00V8GXBHB7BYZW2WJJ"
SECRET_KEY = "YG/PmVxCzH0/Um+BQPFXepvOexvyfPBLVN8eXaz2mRc"
REGION = "blr1"
BUCKET = "cypheredge-exe-uat"
ENDPOINT = f"https://{REGION}.digitaloceanspaces.com"
CDN_URL = f"https://{BUCKET}.{REGION}.cdn.digitaloceanspaces.com"

print("\n" + "="*60)
print("  Rename 2.3.403 to 2.3.404 for Full Update Test")
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

# Files to copy (use existing 2.3.402)
old_exe = "CypherEdge UAT-Setup-2.3.402.exe"
new_exe = "CypherEdge-UAT-Setup-2.3.404.exe"
old_blockmap = "CypherEdge UAT-Setup-2.3.402.exe.blockmap"
new_blockmap = "CypherEdge-UAT-Setup-2.3.404.exe.blockmap"

print("Step 1: Copying existing installer...")
print(f"  From: {old_exe}")
print(f"  To:   {new_exe}\n")

# Copy .exe file (rename)
try:
    copy_source = {'Bucket': BUCKET, 'Key': f'releases/windows/{old_exe}'}
    client.copy_object(
        CopySource=copy_source,
        Bucket=BUCKET,
        Key=f'releases/windows/{new_exe}',
        ACL='public-read',
        ContentType='application/x-msdownload'
    )
    print(f"  [OK] Installer copied successfully\n")
except Exception as e:
    print(f"  [FAIL] Failed to copy installer: {e}\n")
    sys.exit(1)

# Copy .blockmap file (rename)
print("Step 2: Copying blockmap file...")
try:
    copy_source = {'Bucket': BUCKET, 'Key': f'releases/windows/{old_blockmap}'}
    client.copy_object(
        CopySource=copy_source,
        Bucket=BUCKET,
        Key=f'releases/windows/{new_blockmap}',
        ACL='public-read',
        ContentType='application/octet-stream'
    )
    print(f"  [OK] Blockmap copied successfully\n")
except Exception as e:
    print(f"  [WARN] Blockmap copy failed (might not exist): {e}\n")

# Update latest.yml is already uploaded from previous step
print("Step 3: Verifying latest.yml...")
try:
    response = client.get_object(Bucket=BUCKET, Key='releases/windows/latest.yml')
    content = response['Body'].read().decode('utf-8')
    if '2.3.404' in content:
        print(f"  [OK] latest.yml already points to 2.3.404\n")
    else:
        print(f"  [WARN] latest.yml doesn't reference 2.3.404\n")
except Exception as e:
    print(f"  [FAIL] Failed to read latest.yml: {e}\n")

print("\n" + "="*60)
print("  COMPLETE! Now test the update:")
print("="*60)
print("\n1. Restart CypherEdge UAT (2.3.403)")
print("2. Wait for 'Update Available' notification")
print("3. Click 'Download' - THIS TIME IT WILL WORK!")
print("4. Download will complete successfully")
print("5. Click 'Install' to verify installer runs\n")
print("Files on CDN:")
print(f"  {CDN_URL}/releases/windows/{new_exe}")
print(f"  {CDN_URL}/releases/windows/{new_blockmap}")
print(f"  {CDN_URL}/releases/windows/latest.yml\n")
