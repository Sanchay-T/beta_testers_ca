# Simple DigitalOcean Spaces Test for BLR1 Bucket

$ErrorActionPreference = "Continue"

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
Write-Host "[1/5] Configuring AWS CLI..." -ForegroundColor Yellow
aws configure set aws_access_key_id $accessKey 2>&1 | Out-Null
aws configure set aws_secret_access_key $secretKey 2>&1 | Out-Null
aws configure set region $region 2>&1 | Out-Null
Write-Host "      Done" -ForegroundColor Green
Write-Host ""

# Step 2: Test bucket access
Write-Host "[2/5] Testing bucket access..." -ForegroundColor Yellow
$bucketTest = aws s3 ls "s3://$bucket/" --endpoint-url $endpoint 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      Bucket accessible" -ForegroundColor Green
} else {
    Write-Host "      Bucket access failed" -ForegroundColor Red
    Write-Host "      Error: $bucketTest" -ForegroundColor Red
}
Write-Host ""

# Step 3: Upload test file
Write-Host "[3/5] Uploading test file..." -ForegroundColor Yellow
$testFileName = "test-$(Get-Date -Format 'yyyyMMddHHmmss').txt"
$testContent = "CypherEdge Update Test - $(Get-Date)"
Set-Content -Path $testFileName -Value $testContent

$uploadResult = aws s3 cp $testFileName "s3://$bucket/test/$testFileName" --endpoint-url $endpoint --acl public-read 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      Test file uploaded: test/$testFileName" -ForegroundColor Green
} else {
    Write-Host "      Upload failed" -ForegroundColor Red
}
Remove-Item $testFileName -ErrorAction SilentlyContinue
Write-Host ""

# Step 4: Create releases/windows directory
Write-Host "[4/5] Creating releases/windows directory..." -ForegroundColor Yellow
$placeholder = "placeholder.txt"
Set-Content -Path $placeholder -Value "CypherEdge releases directory"

$dirResult = aws s3 cp $placeholder "s3://$bucket/releases/windows/$placeholder" --endpoint-url $endpoint --acl public-read 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      Directory structure created" -ForegroundColor Green
} else {
    Write-Host "      Directory creation failed" -ForegroundColor Red
}
Remove-Item $placeholder -ErrorAction SilentlyContinue
Write-Host ""

# Step 5: Create test latest.yml
Write-Host "[5/5] Creating test latest.yml..." -ForegroundColor Yellow
$latestYml = @"
version: 2.1.999
files:
  - url: CypherEdge-UAT-Setup-2.1.999.exe
    sha512: test-hash-placeholder
    size: 200000000
path: CypherEdge-UAT-Setup-2.1.999.exe
sha512: test-hash-placeholder
releaseDate: '$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')'
"@

$ymlFile = "latest.yml"
Set-Content -Path $ymlFile -Value $latestYml

$ymlResult = aws s3 cp $ymlFile "s3://$bucket/releases/windows/latest.yml" --endpoint-url $endpoint --acl public-read --content-type "text/yaml" --cache-control "max-age=0, no-cache" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      latest.yml uploaded" -ForegroundColor Green
} else {
    Write-Host "      latest.yml upload failed" -ForegroundColor Red
}
Remove-Item $ymlFile -ErrorAction SilentlyContinue
Write-Host ""

# Test CDN access
Write-Host "Testing CDN accessibility..." -ForegroundColor Yellow
$latestYmlUrl = "$cdnUrl/releases/windows/latest.yml"
Write-Host "  URL: $latestYmlUrl" -ForegroundColor White

Start-Sleep -Seconds 3

$response = Invoke-WebRequest -Uri $latestYmlUrl -Method Get -TimeoutSec 10 -ErrorAction SilentlyContinue
if ($response.StatusCode -eq 200) {
    Write-Host "  CDN working! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Content:" -ForegroundColor Cyan
    Write-Host $response.Content -ForegroundColor White
} else {
    Write-Host "  CDN not accessible yet (may take 1-2 minutes)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Test Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Bucket Contents:" -ForegroundColor Yellow
aws s3 ls "s3://$bucket/" --endpoint-url $endpoint --recursive

Write-Host ""
Write-Host "CDN URLs for testing:" -ForegroundColor Yellow
Write-Host "  $cdnUrl/releases/windows/latest.yml" -ForegroundColor Cyan
Write-Host ""
