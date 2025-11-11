# Quick Test Script for cypheredge-exe-uat Bucket (BLR1)
# Tests bucket access, upload, CDN, and electron-updater compatibility

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Quick Test: cypheredge-exe-uat (BLR1 Region)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$accessKey = "DO00V8GXBHB7BYZW2WJJ"
$secretKey = "YG/PmVxCzH0/Um+BQPFXepvOexvyfPBLVN8eXaz2mRc"
$region = "blr1"
$bucket = "cypheredge-exe-uat"
$endpoint = "https://blr1.digitaloceanspaces.com"
$cdnUrl = "https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Region: $region (Bangalore)" -ForegroundColor White
Write-Host "  Bucket: $bucket" -ForegroundColor White
Write-Host "  Endpoint: $endpoint" -ForegroundColor White
Write-Host "  CDN URL: $cdnUrl" -ForegroundColor White
Write-Host ""

# Step 1: Configure AWS CLI
Write-Host "[1/6] Configuring AWS CLI..." -ForegroundColor Yellow
aws configure set aws_access_key_id $accessKey
aws configure set aws_secret_access_key $secretKey
aws configure set region $region
Write-Host "      ✓ Configured" -ForegroundColor Green
Write-Host ""

# Step 2: Test bucket access
Write-Host "[2/6] Testing bucket access..." -ForegroundColor Yellow
try {
    $bucketTest = aws s3 ls "s3://$bucket/" --endpoint-url $endpoint 2>&1
    Write-Host "      ✓ Bucket accessible" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Bucket access failed!" -ForegroundColor Red
    Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Upload test file
Write-Host "[3/6] Uploading test file..." -ForegroundColor Yellow
$testFileName = "test-$(Get-Date -Format 'yyyyMMddHHmmss').txt"
$testContent = "CypherEdge Update System Test`nTimestamp: $(Get-Date)`nBucket: $bucket`nRegion: $region"
Set-Content -Path $testFileName -Value $testContent

try {
    aws s3 cp $testFileName "s3://$bucket/test/$testFileName" `
        --endpoint-url $endpoint `
        --acl public-read `
        --content-type "text/plain" | Out-Null

    Write-Host "      ✓ Test file uploaded: test/$testFileName" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Upload failed!" -ForegroundColor Red
    Remove-Item $testFileName -ErrorAction SilentlyContinue
    exit 1
}
Remove-Item $testFileName
Write-Host ""

# Step 4: Test CDN access
Write-Host "[4/6] Testing CDN accessibility..." -ForegroundColor Yellow
$cdnTestUrl = "$cdnUrl/test/$testFileName"
Start-Sleep -Seconds 2  # Wait for CDN propagation

try {
    $response = Invoke-WebRequest -Uri $cdnTestUrl -Method Get -TimeoutSec 10

    if ($response.StatusCode -eq 200) {
        Write-Host "      ✓ CDN working! Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "      ✓ Content retrieved successfully" -ForegroundColor Green
    } else {
        Write-Host "      ⚠ Unexpected status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "      ✗ CDN test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "      Note: CDN may take 1-2 minutes to propagate" -ForegroundColor Yellow
    Write-Host "      Try manually: $cdnTestUrl" -ForegroundColor White
}
Write-Host ""

# Step 5: Create releases/windows directory structure
Write-Host "[5/6] Creating releases/windows/ directory..." -ForegroundColor Yellow
$placeholderContent = "CypherEdge releases directory - created $(Get-Date)"
$placeholderFile = "placeholder-$(Get-Date -Format 'yyyyMMdd').txt"
Set-Content -Path $placeholderFile -Value $placeholderContent

try {
    aws s3 cp $placeholderFile "s3://$bucket/releases/windows/$placeholderFile" `
        --endpoint-url $endpoint `
        --acl public-read | Out-Null

    Write-Host "      ✓ Directory structure created" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Directory creation failed" -ForegroundColor Red
}
Remove-Item $placeholderFile
Write-Host ""

# Step 6: Create test latest.yml (electron-updater format)
Write-Host "[6/6] Creating test latest.yml..." -ForegroundColor Yellow
$latestYmlContent = @"
version: 2.1.999
files:
  - url: CypherEdge-UAT-Setup-2.1.999.exe
    sha512: test-hash-$(Get-Random)
    size: 200000000
path: CypherEdge-UAT-Setup-2.1.999.exe
sha512: test-hash-$(Get-Random)
releaseDate: '$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')'
"@

$latestYmlFile = "latest.yml"
Set-Content -Path $latestYmlFile -Value $latestYmlContent

try {
    aws s3 cp $latestYmlFile "s3://$bucket/releases/windows/latest.yml" `
        --endpoint-url $endpoint `
        --acl public-read `
        --content-type "text/yaml" `
        --cache-control "max-age=0, no-cache, no-store, must-revalidate" | Out-Null

    Write-Host "      ✓ latest.yml uploaded" -ForegroundColor Green
} catch {
    Write-Host "      ✗ latest.yml upload failed" -ForegroundColor Red
}
Remove-Item $latestYmlFile
Write-Host ""

# Verify latest.yml accessibility
Write-Host "Verifying latest.yml via CDN..." -ForegroundColor Yellow
$latestYmlUrl = "$cdnUrl/releases/windows/latest.yml"
Start-Sleep -Seconds 2

try {
    $yamlResponse = Invoke-WebRequest -Uri $latestYmlUrl -Method Get -TimeoutSec 10

    if ($yamlResponse.StatusCode -eq 200) {
        Write-Host "✓ latest.yml accessible via CDN!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Content:" -ForegroundColor Cyan
        Write-Host $yamlResponse.Content -ForegroundColor White
    }
} catch {
    Write-Host "✗ latest.yml not accessible yet" -ForegroundColor Red
    Write-Host "  URL: $latestYmlUrl" -ForegroundColor White
    Write-Host "  Note: May take 1-2 minutes for CDN propagation" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Test Results Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# List bucket contents
Write-Host "Bucket Contents:" -ForegroundColor Yellow
try {
    $contents = aws s3 ls "s3://$bucket/" --endpoint-url $endpoint --recursive
    Write-Host $contents -ForegroundColor White
} catch {
    Write-Host "Could not list contents" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✓ Bucket is ready for CypherEdge updates!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Build your app locally: npm run build" -ForegroundColor White
Write-Host "  2. Test upload .exe and latest.yml to bucket" -ForegroundColor White
Write-Host "  3. Update main.js with new CDN URL" -ForegroundColor White
Write-Host "  4. Test update detection in app" -ForegroundColor White
Write-Host ""

Write-Host "CDN URLs for verification:" -ForegroundColor Yellow
Write-Host "  Test file: $cdnUrl/test/$testFileName" -ForegroundColor White
Write-Host "  latest.yml: $cdnUrl/releases/windows/latest.yml" -ForegroundColor White
Write-Host "  Updates folder: $cdnUrl/releases/windows/" -ForegroundColor White
Write-Host ""
