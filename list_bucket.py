#!/usr/bin/env python
"""List files in DigitalOcean Spaces bucket"""

import boto3
import os
from pathlib import Path
from botocore.client import Config
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / 'frontend' / '.env'
load_dotenv(env_path)

ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
REGION = 'blr1'
BUCKET = 'cypheredge-exe-uat'
ENDPOINT = f'https://{REGION}.digitaloceanspaces.com'

# Initialize S3 client
session = boto3.session.Session()
client = session.client(
    's3',
    region_name=REGION,
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=Config(signature_version='s3v4')
)

print("\nFiles in cypheredge-exe-uat bucket (releases/windows/):\n")

response = client.list_objects_v2(Bucket=BUCKET, Prefix='releases/windows/')

if 'Contents' in response:
    for obj in response['Contents']:
        size_mb = obj['Size'] / (1024 * 1024)
        print(f"  {obj['Key']}")
        print(f"    Size: {size_mb:.1f} MB")
        print(f"    Last Modified: {obj['LastModified']}")
        print()
else:
    print("  No files found")
