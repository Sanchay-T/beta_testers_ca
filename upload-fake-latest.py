#!/usr/bin/env python
"""Upload fake latest.yml to test update notification"""
import boto3
from botocore.client import Config

# From .env
ACCESS_KEY = "DO00V8GXBHB7BYZW2WJJ"
SECRET_KEY = "YG/PmVxCzH0/Um+BQPFXepvOexvyfPBLVN8eXaz2mRc"
REGION = "blr1"
BUCKET = "cypheredge-exe-uat"
ENDPOINT = f"https://{REGION}.digitaloceanspaces.com"
CDN_URL = f"https://{BUCKET}.{REGION}.cdn.digitaloceanspaces.com"

print("\n" + "="*60)
print("  Upload Fake latest.yml (Version 2.3.404)")
print("="*60 + "\n")

# Read test-latest.yml
with open('test-latest.yml', 'r') as f:
    content = f.read()

print("Content to upload:")
print(content)
print()

# Initialize S3 client
client = boto3.session.Session().client(
    's3',
    region_name=REGION,
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=Config(signature_version='s3v4')
)

# Upload
print("Uploading to DigitalOcean Spaces...")
try:
    client.put_object(
        Bucket=BUCKET,
        Key="releases/windows/latest.yml",
        Body=content.encode('utf-8'),
        ACL='public-read',
        ContentType='text/yaml',
        CacheControl='max-age=0, no-cache, no-store, must-revalidate'
    )
    print("✓ Upload successful!\n")
except Exception as e:
    print(f"✗ Upload failed: {e}\n")
    exit(1)

# Test CDN
print("Testing CDN access...")
import time
time.sleep(2)

try:
    import urllib.request
    url = f"{CDN_URL}/releases/windows/latest.yml"
    response = urllib.request.urlopen(url)
    cdn_content = response.read().decode('utf-8')
    print(f"✓ CDN accessible!\n")
    print("CDN Content:")
    print(cdn_content)
except Exception as e:
    print(f"⚠ CDN not ready yet (wait 1-2 minutes)")
    print(f"URL: {CDN_URL}/releases/windows/latest.yml\n")

print("\n" + "="*60)
print("  READY TO TEST!")
print("="*60)
print("\n1. Open CypherEdge UAT (version 2.3.403)")
print("2. Wait ~30 seconds")
print("3. Look for: 'Update Available: Version 2.3.404'\n")
