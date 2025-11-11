#!/usr/bin/env python
"""List all files in DigitalOcean Spaces bucket"""
import boto3
from botocore.client import Config

ACCESS_KEY = "DO00V8GXBHB7BYZW2WJJ"
SECRET_KEY = "YG/PmVxCzH0/Um+BQPFXepvOexvyfPBLVN8eXaz2mRc"
REGION = "blr1"
BUCKET = "cypheredge-exe-uat"
ENDPOINT = f"https://{REGION}.digitaloceanspaces.com"

client = boto3.session.Session().client(
    's3',
    region_name=REGION,
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=Config(signature_version='s3v4')
)

print("\nFiles in bucket:", BUCKET)
print("="*60)

try:
    response = client.list_objects_v2(Bucket=BUCKET)
    if 'Contents' in response:
        for obj in response['Contents']:
            size_mb = obj['Size'] / (1024 * 1024)
            print(f"{obj['Key']:60s} {size_mb:10.2f} MB")
    else:
        print("(bucket is empty)")
except Exception as e:
    print(f"Error: {e}")
