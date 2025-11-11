#!/usr/bin/env python
"""
DigitalOcean Spaces Test Script (Python version)
Tests bucket access and uploads test files
"""

import boto3
import os
from datetime import datetime
from botocore.client import Config

# Configuration
ACCESS_KEY = "DO00V8GXBHB7BYZW2WJJ"
SECRET_KEY = "YG/PmVxCzH0/Um+BQPFXepvOexvyfPBLVN8eXaz2mRc"
REGION = "blr1"
BUCKET = "cypheredge-exe-uat"
ENDPOINT = f"https://{REGION}.digitaloceanspaces.com"
CDN_URL = f"https://{BUCKET}.{REGION}.cdn.digitaloceanspaces.com"

print("\n" + "="*60)
print("  DigitalOcean Spaces Test (Python/boto3)")
print("="*60 + "\n")

print("Configuration:")
print(f"  Region: {REGION} (Bangalore)")
print(f"  Bucket: {BUCKET}")
print(f"  Endpoint: {ENDPOINT}")
print(f"  CDN URL: {CDN_URL}\n")

# Initialize S3 client for DigitalOcean Spaces
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
    print("[1/5] OK - Boto3 client initialized\n")
except Exception as e:
    print(f"[1/5] FAIL - Failed to initialize boto3: {e}\n")
    exit(1)

# Test 1: List bucket contents
print("[2/5] Testing bucket access...")
try:
    response = client.list_objects_v2(Bucket=BUCKET)
    print(f"      OK - Bucket accessible")

    if 'Contents' in response:
        print(f"      Found {len(response['Contents'])} existing files")
    else:
        print(f"      Bucket is empty")
except Exception as e:
    print(f"      FAIL - Bucket access failed: {e}")
    exit(1)

print()

# Test 2: Upload test file
print("[3/5] Uploading test file...")
test_filename = f"test-{datetime.now().strftime('%Y%m%d%H%M%S')}.txt"
test_content = f"CypherEdge Update Test\nTimestamp: {datetime.now()}\nBucket: {BUCKET}\nRegion: {REGION}"

try:
    client.put_object(
        Bucket=BUCKET,
        Key=f"test/{test_filename}",
        Body=test_content.encode('utf-8'),
        ACL='public-read',
        ContentType='text/plain'
    )
    print(f"      OK - Test file uploaded: test/{test_filename}")
except Exception as e:
    print(f"      FAIL - Upload failed: {e}")

print()

# Test 3: Create releases/windows directory
print("[4/5] Creating releases/windows directory...")
placeholder_content = f"CypherEdge releases directory\nCreated: {datetime.now()}"

try:
    client.put_object(
        Bucket=BUCKET,
        Key="releases/windows/placeholder.txt",
        Body=placeholder_content.encode('utf-8'),
        ACL='public-read',
        ContentType='text/plain'
    )
    print(f"      OK - Directory structure created")
except Exception as e:
    print(f"      FAIL - Directory creation failed: {e}")

print()

# Test 4: Create test latest.yml
print("[5/5] Creating test latest.yml...")
latest_yml_content = f"""version: 2.1.999
files:
  - url: CypherEdge-UAT-Setup-2.1.999.exe
    sha512: test-hash-placeholder-{datetime.now().strftime('%Y%m%d')}
    size: 200000000
path: CypherEdge-UAT-Setup-2.1.999.exe
sha512: test-hash-placeholder-{datetime.now().strftime('%Y%m%d')}
releaseDate: '{datetime.now().strftime('%Y-%m-%dT%H:%M:%S.000Z')}'
"""

try:
    client.put_object(
        Bucket=BUCKET,
        Key="releases/windows/latest.yml",
        Body=latest_yml_content.encode('utf-8'),
        ACL='public-read',
        ContentType='text/yaml',
        CacheControl='max-age=0, no-cache, no-store, must-revalidate'
    )
    print(f"      OK - latest.yml uploaded with no-cache headers")
except Exception as e:
    print(f"      FAIL - latest.yml upload failed: {e}")

print()

# Test CDN access
print("Testing CDN accessibility...")
latest_yml_url = f"{CDN_URL}/releases/windows/latest.yml"
print(f"  URL: {latest_yml_url}")

import time
print("  Waiting 3 seconds for CDN propagation...")
time.sleep(3)

try:
    import urllib.request
    response = urllib.request.urlopen(latest_yml_url)
    content = response.read().decode('utf-8')

    print(f"  OK - CDN working! Status: {response.status}")
    print(f"\n  Content:")
    print("  " + "\n  ".join(content.split('\n')))
except Exception as e:
    print(f"  WARN - CDN not accessible yet: {e}")
    print(f"  Note: Files may take 1-2 minutes to propagate to CDN")
    print(f"\n  Try accessing manually:")
    print(f"  {latest_yml_url}")

print()
print("="*60)
print("  Test Complete!")
print("="*60)
print()

# List all bucket contents
print("Bucket Contents:")
try:
    response = client.list_objects_v2(Bucket=BUCKET)
    if 'Contents' in response:
        for obj in response['Contents']:
            size_mb = obj['Size'] / (1024 * 1024)
            print(f"  {obj['Key']} ({size_mb:.2f} MB)")
    else:
        print("  (empty)")
except Exception as e:
    print(f"  Error listing contents: {e}")

print()
print("CDN URLs for testing:")
print(f"  {CDN_URL}/releases/windows/latest.yml")
print()
