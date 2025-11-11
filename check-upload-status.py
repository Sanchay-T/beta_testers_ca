#!/usr/bin/env python
"""Check if 2.3.404 files are uploaded to DigitalOcean Spaces"""
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
print("  Checking Upload Status for 2.3.404")
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

files_to_check = [
    ("releases/windows/CypherEdge-UAT-Setup-2.3.404.exe", "Installer", True),
    ("releases/windows/CypherEdge-UAT-Setup-2.3.404.exe.blockmap", "Blockmap", False),
    ("releases/windows/latest.yml", "latest.yml", True)
]

all_good = True

for key, name, required in files_to_check:
    try:
        response = client.head_object(Bucket=BUCKET, Key=key)
        size = response['ContentLength']
        size_mb = size / (1024 * 1024)
        print(f"[OK] {name}: {size_mb:.2f} MB")

        if name == "latest.yml":
            # Show latest.yml content
            obj = client.get_object(Bucket=BUCKET, Key=key)
            content = obj['Body'].read().decode('utf-8')
            print(f"\nlatest.yml content:")
            print(content)

    except Exception as e:
        if required:
            print(f"[FAIL] {name}: NOT FOUND (required)")
            all_good = False
        else:
            print(f"[WARN] {name}: NOT FOUND (optional)")

print("\n" + "="*60)
if all_good:
    print("  STATUS: ALL FILES UPLOADED SUCCESSFULLY!")
    print("="*60)
    print("\nCDN URLs:")
    print(f"  {CDN_URL}/releases/windows/CypherEdge-UAT-Setup-2.3.404.exe")
    print(f"  {CDN_URL}/releases/windows/latest.yml")
    print("\nREADY TO TEST UPDATE!")
    print("\nTest Instructions:")
    print("  1. Launch CypherEdge UAT 2.3.403")
    print("  2. Wait 30-60 seconds")
    print("  3. Update notification should appear")
    print("  4. Download -> Install -> Look for GREEN badge!\n")
else:
    print("  STATUS: UPLOAD NOT COMPLETE")
    print("="*60)
    print("\nRun the upload script:")
    print("  python upload-real-2.3.404.py")
    print("\nOr wait if upload is in progress...\n")

sys.exit(0 if all_good else 1)
