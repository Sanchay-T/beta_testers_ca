# Upload CypherEdge Build to DigitalOcean Spaces
# This script uploads your built installer to the update server

param(
    [string]$buildPath = "frontend\dist",
    [switch]$dryRun = $false
)

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Upload Build to DigitalOcean Spaces (BLR1)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration from .env
$region = "blr1"
$bucket = "cypheredge-exe-uat"
$endpoint = "https://blr1.digitaloceanspaces.com"
$cdnUrl = "https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com"
$spacesPath = "releases/windows"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Build Path: $buildPath" -ForegroundColor White
Write-Host "  Bucket: $bucket" -ForegroundColor White
Write-Host "  Region: $region (Bangalore)" -ForegroundColor White
Write-Host "  Upload Path: $spacesPath" -ForegroundColor White
Write-Host "  Dry Run: $dryRun" -ForegroundColor White
Write-Host ""

# Check if build directory exists
if (-not (Test-Path $buildPath)) {
    Write-Host "✗ Build directory not found: $buildPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Run these commands first:" -ForegroundColor Yellow
    Write-Host "  cd frontend" -ForegroundColor White
    Write-Host "  npm run sync-version" -ForegroundColor White
    Write-Host "  npm run build" -ForegroundColor White
    exit 1
}

Write-Host "✓ Found build directory: $buildPath" -ForegroundColor Green
Write-Host ""

# Find installer (.exe)
Write-Host "Searching for installer..." -ForegroundColor Yellow
$installer = Get-ChildItem -Path $buildPath -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $installer) {
    Write-Host "✗ No .exe installer found in $buildPath" -ForegroundColor Red
    exit 1
}

$installerSize = [math]::Round($installer.Length / 1MB, 2)
Write-Host "✓ Found installer: $($installer.Name) ($installerSize MB)" -ForegroundColor Green

# Find blockmap file
$blockmap = Get-ChildItem -Path $buildPath -Filter "*.exe.blockmap" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($blockmap) {
    Write-Host "✓ Found blockmap: $($blockmap.Name)" -ForegroundColor Green
} else {
    Write-Host "⚠ No blockmap found (differential updates won't work)" -ForegroundColor Yellow
}

# Find latest.yml
$latestYml = Get-ChildItem -Path $buildPath -Filter "latest.yml" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($latestYml) {
    Write-Host "✓ Found update manifest: latest.yml" -ForegroundColor Green

    # Display latest.yml content
    Write-Host ""
    Write-Host "latest.yml content:" -ForegroundColor Cyan
    Get-Content $latestYml.FullName | Write-Host -ForegroundColor White
} else {
    Write-Host "✗ No latest.yml found (CRITICAL for updates!)" -ForegroundColor Red
    exit 1
}

Write-Host ""

if ($dryRun) {
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host "  DRY RUN - No files will be uploaded" -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Files that would be uploaded:" -ForegroundColor Yellow
    Write-Host "  1. $($installer.Name) → $spacesPath/$($installer.Name)" -ForegroundColor White
    if ($blockmap) {
        Write-Host "  2. $($blockmap.Name) → $spacesPath/$($blockmap.Name)" -ForegroundColor White
    }
    Write-Host "  3. latest.yml → $spacesPath/latest.yml" -ForegroundColor White
    Write-Host ""
    Write-Host "Run without -dryRun to actually upload" -ForegroundColor Yellow
    exit 0
}

# Confirm upload
Write-Host "Ready to upload to:" -ForegroundColor Yellow
Write-Host "  $cdnUrl/$spacesPath/" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Upload cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# Upload installer
Write-Host "[1/3] Uploading installer..." -ForegroundColor Yellow
try {
    aws s3 cp $installer.FullName "s3://$bucket/$spacesPath/$($installer.Name)" `
        --endpoint-url $endpoint `
        --acl public-read `
        --content-type "application/x-msdownload" `
        --metadata "version=$($installer.BaseName),uploaded=$(Get-Date -Format 'yyyy-MM-dd')"

    Write-Host "      ✓ Uploaded: $($installer.Name) ($installerSize MB)" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Upload failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Upload blockmap (if exists)
if ($blockmap) {
    Write-Host "[2/3] Uploading blockmap..." -ForegroundColor Yellow
    try {
        aws s3 cp $blockmap.FullName "s3://$bucket/$spacesPath/$($blockmap.Name)" `
            --endpoint-url $endpoint `
            --acl public-read `
            --content-type "application/octet-stream"

        Write-Host "      ✓ Uploaded: $($blockmap.Name)" -ForegroundColor Green
    } catch {
        Write-Host "      ✗ Blockmap upload failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "[2/3] Skipping blockmap (not found)" -ForegroundColor Yellow
}

# Upload latest.yml (CRITICAL)
Write-Host "[3/3] Uploading latest.yml..." -ForegroundColor Yellow
try {
    aws s3 cp $latestYml.FullName "s3://$bucket/$spacesPath/latest.yml" `
        --endpoint-url $endpoint `
        --acl public-read `
        --content-type "text/yaml" `
        --cache-control "max-age=0, no-cache, no-store, must-revalidate"

    Write-Host "      ✓ Uploaded: latest.yml (with no-cache headers)" -ForegroundColor Green
} catch {
    Write-Host "      ✗ latest.yml upload failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Upload Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Verify upload
Write-Host "Verifying upload..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$latestYmlUrl = "$cdnUrl/$spacesPath/latest.yml"
try {
    $response = Invoke-WebRequest -Uri $latestYmlUrl -Method Get -TimeoutSec 10

    if ($response.StatusCode -eq 200) {
        Write-Host "✓ latest.yml accessible via CDN!" -ForegroundColor Green
        Write-Host ""
        Write-Host "CDN Content:" -ForegroundColor Cyan
        Write-Host $response.Content -ForegroundColor White
    }
} catch {
    Write-Host "⚠ CDN not accessible yet (may take 1-2 minutes to propagate)" -ForegroundColor Yellow
    Write-Host "  URL: $latestYmlUrl" -ForegroundColor White
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Update URLs" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "CDN URLs:" -ForegroundColor Yellow
Write-Host "  Installer: $cdnUrl/$spacesPath/$($installer.Name)" -ForegroundColor White
Write-Host "  latest.yml: $cdnUrl/$spacesPath/latest.yml" -ForegroundColor White
Write-Host ""
Write-Host "Test in browser:" -ForegroundColor Yellow
Write-Host "  $cdnUrl/$spacesPath/latest.yml" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Update frontend/main.js with CDN URL" -ForegroundColor White
Write-Host "  2. Update frontend/package.json publish config" -ForegroundColor White
Write-Host "  3. Install old version of app and test update" -ForegroundColor White
Write-Host ""
