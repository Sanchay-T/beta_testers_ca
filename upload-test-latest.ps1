# Quick Upload of Fake latest.yml to DigitalOcean Spaces
# This will trigger update notification for testing

$accessKey = "DO00V8GXBHB7BYZW2WJJ"
$secretKey = "YG/PmVxCzH0/Um+BQPFXepvOexvyfPBLVN8eXaz2mRc"
$bucket = "cypheredge-exe-uat"
$region = "blr1"
$endpoint = "https://blr1.digitaloceanspaces.com"
$cdnUrl = "https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Upload Test latest.yml (Version 2.3.404)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if file exists
if (-not (Test-Path "test-latest.yml")) {
    Write-Host "✗ test-latest.yml not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found test-latest.yml" -ForegroundColor Green
Get-Content "test-latest.yml" | Write-Host -ForegroundColor White
Write-Host ""

# Set AWS credentials for this session
$env:AWS_ACCESS_KEY_ID = $accessKey
$env:AWS_SECRET_ACCESS_KEY = $secretKey

# Upload using AWS CLI (if available)
Write-Host "Uploading to DigitalOcean Spaces..." -ForegroundColor Yellow
try {
    aws s3 cp test-latest.yml "s3://$bucket/releases/windows/latest.yml" `
        --endpoint-url $endpoint `
        --acl public-read `
        --content-type "text/yaml" `
        --cache-control "max-age=0, no-cache, no-store, must-revalidate"

    Write-Host "✓ Upload successful!" -ForegroundColor Green
} catch {
    Write-Host "✗ AWS CLI not available. Please install AWS CLI or run manually:" -ForegroundColor Red
    Write-Host ""
    Write-Host "aws s3 cp test-latest.yml s3://$bucket/releases/windows/latest.yml ``" -ForegroundColor Yellow
    Write-Host "  --endpoint-url $endpoint ``" -ForegroundColor Yellow
    Write-Host "  --acl public-read ``" -ForegroundColor Yellow
    Write-Host "  --content-type 'text/yaml' ``" -ForegroundColor Yellow
    Write-Host "  --cache-control 'max-age=0, no-cache'" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Testing CDN access..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$testUrl = "$cdnUrl/releases/windows/latest.yml"
try {
    $response = Invoke-WebRequest -Uri $testUrl -Method Get -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ CDN accessible! Update will be detected." -ForegroundColor Green
        Write-Host ""
        Write-Host "CDN Response:" -ForegroundColor Cyan
        Write-Host $response.Content -ForegroundColor White
    }
} catch {
    Write-Host "⚠ CDN not accessible yet (may take 1-2 minutes)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  TESTING INSTRUCTIONS" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Open CypherEdge UAT (current version 2.3.403)" -ForegroundColor White
Write-Host "2. Within 30 seconds, you should see:" -ForegroundColor White
Write-Host "   - Toast: 'Update Available: Version 2.3.404'" -ForegroundColor Yellow
Write-Host "   - Download button in notification" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Click Download → Download will FAIL (fake version)" -ForegroundColor Red
Write-Host "   This is expected! We're just testing the notification flow." -ForegroundColor Red
Write-Host ""
Write-Host "If notification appears = ✓ Update flow works!" -ForegroundColor Green
Write-Host ""
