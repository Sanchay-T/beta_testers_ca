# DigitalOcean Spaces Configuration Test Script
# This script verifies your Spaces bucket is properly configured for CypherEdge updates

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DigitalOcean Spaces Configuration Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Read .env file to get configuration
$envPath = "frontend\.env"
if (Test-Path $envPath) {
    Write-Host "✓ Found .env file" -ForegroundColor Green

    # Parse .env file
    $envContent = Get-Content $envPath
    $config = @{}

    foreach ($line in $envContent) {
        if ($line -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $config[$key] = $value
        }
    }

    # Extract Spaces configuration
    $accessKey = $config['AWS_ACCESS_KEY_ID']
    $secretKey = $config['AWS_SECRET_ACCESS_KEY']
    $region = $config['SPACES_REGION']
    $bucket = $config['SPACES_BUCKET']
    $endpoint = $config['SPACES_ENDPOINT']
    $updateUrl = $config['UPDATE_SERVER_URL']

    Write-Host ""
    Write-Host "Current Configuration:" -ForegroundColor Yellow
    Write-Host "  Access Key: $accessKey" -ForegroundColor White
    Write-Host "  Region: $region" -ForegroundColor White
    Write-Host "  Bucket: $bucket" -ForegroundColor White
    Write-Host "  Endpoint: $endpoint" -ForegroundColor White
    Write-Host "  Update URL: $updateUrl" -ForegroundColor White
    Write-Host ""

} else {
    Write-Host "✗ .env file not found at: $envPath" -ForegroundColor Red
    exit 1
}

# Step 1: Check if AWS CLI is installed
Write-Host "Step 1: Checking AWS CLI installation..." -ForegroundColor Yellow
try {
    $awsVersion = aws --version 2>&1
    Write-Host "✓ AWS CLI installed: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ AWS CLI not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install AWS CLI:" -ForegroundColor Yellow
    Write-Host "  Option 1: choco install awscli -y" -ForegroundColor White
    Write-Host "  Option 2: Download from https://aws.amazon.com/cli/" -ForegroundColor White
    exit 1
}

Write-Host ""

# Step 2: Configure AWS CLI for Spaces
Write-Host "Step 2: Configuring AWS CLI for DigitalOcean Spaces..." -ForegroundColor Yellow
aws configure set aws_access_key_id $accessKey
aws configure set aws_secret_access_key $secretKey
aws configure set region $region
Write-Host "✓ AWS CLI configured" -ForegroundColor Green
Write-Host ""

# Step 3: Check if bucket exists
Write-Host "Step 3: Checking if bucket exists..." -ForegroundColor Yellow
try {
    $buckets = aws s3 ls --endpoint-url $endpoint 2>&1

    if ($buckets -match $bucket) {
        Write-Host "✓ Bucket '$bucket' found!" -ForegroundColor Green
    } else {
        Write-Host "✗ Bucket '$bucket' not found" -ForegroundColor Red
        Write-Host ""
        Write-Host "Available buckets:" -ForegroundColor Yellow
        Write-Host $buckets -ForegroundColor White
        Write-Host ""
        Write-Host "Create bucket with:" -ForegroundColor Yellow
        Write-Host "  aws s3 mb s3://$bucket --endpoint-url $endpoint" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "✗ Error checking buckets: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Test upload
Write-Host "Step 4: Testing file upload..." -ForegroundColor Yellow
$testFile = "test-upload-$(Get-Date -Format 'yyyyMMddHHmmss').txt"
$testContent = "CypherEdge Update System Test - $(Get-Date)"
Set-Content -Path $testFile -Value $testContent

try {
    aws s3 cp $testFile "s3://$bucket/test/$testFile" --endpoint-url $endpoint --acl public-read
    Write-Host "✓ Test file uploaded successfully" -ForegroundColor Green

    # Clean up local test file
    Remove-Item $testFile
} catch {
    Write-Host "✗ Upload failed: $($_.Exception.Message)" -ForegroundColor Red
    Remove-Item $testFile -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ""

# Step 5: Test CDN access
Write-Host "Step 5: Testing CDN accessibility..." -ForegroundColor Yellow
$cdnTestUrl = $updateUrl.Replace('/releases/windows', "/test/$testFile")

try {
    $response = Invoke-WebRequest -Uri $cdnTestUrl -Method Get -TimeoutSec 10

    if ($response.StatusCode -eq 200) {
        Write-Host "✓ CDN access successful!" -ForegroundColor Green
        Write-Host "  Status: $($response.StatusCode)" -ForegroundColor White
        Write-Host "  Content: $($response.Content)" -ForegroundColor White
    } else {
        Write-Host "✗ Unexpected status code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ CDN access failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "NOTE: Files may take 1-2 minutes to propagate to CDN edge servers" -ForegroundColor Yellow
    Write-Host "Try accessing directly: $cdnTestUrl" -ForegroundColor White
}

Write-Host ""

# Step 6: Create releases/windows directory structure
Write-Host "Step 6: Creating directory structure..." -ForegroundColor Yellow
$dummyFile = "placeholder.txt"
Set-Content -Path $dummyFile -Value "CypherEdge releases directory"

try {
    aws s3 cp $dummyFile "s3://$bucket/releases/windows/$dummyFile" --endpoint-url $endpoint --acl public-read
    Write-Host "✓ Created releases/windows/ directory" -ForegroundColor Green
    Remove-Item $dummyFile
} catch {
    Write-Host "✗ Failed to create directory: $($_.Exception.Message)" -ForegroundColor Red
    Remove-Item $dummyFile -ErrorAction SilentlyContinue
}

Write-Host ""

# Step 7: List bucket contents
Write-Host "Step 7: Bucket contents:" -ForegroundColor Yellow
try {
    $contents = aws s3 ls "s3://$bucket/" --endpoint-url $endpoint --recursive
    Write-Host $contents -ForegroundColor White
} catch {
    Write-Host "✗ Failed to list contents" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration Test Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Verify CDN is enabled in DigitalOcean console" -ForegroundColor White
Write-Host "  2. Update frontend/main.js with new update URL" -ForegroundColor White
Write-Host "  3. Update frontend/package.json publish config" -ForegroundColor White
Write-Host "  4. Add GitHub Secrets for CI/CD" -ForegroundColor White
Write-Host ""
Write-Host "Documentation: docs/UPDATE_SYSTEM_ANALYSIS_AND_S3_MIGRATION.md" -ForegroundColor Cyan
Write-Host ""
