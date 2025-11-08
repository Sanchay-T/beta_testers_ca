# S3 Migration Quick Start Guide

**🎯 Goal:** Migrate CypherEdge update system from GitHub to AWS S3 in 3 days

---

## Prerequisites

**Required:**
- [ ] AWS Account (create at aws.amazon.com)
- [ ] AWS CLI installed ([Download](https://aws.amazon.com/cli/))
- [ ] Access to GitHub repository settings
- [ ] Code signing certificate (recommended)

**Verify AWS CLI:**
```bash
aws --version
# Should show: aws-cli/2.x.x or higher
```

---

## Day 1: AWS Infrastructure Setup (2-3 hours)

### Step 1: Create S3 Bucket (15 min)

**Option A: AWS Console**
1. Go to https://console.aws.amazon.com/s3/
2. Click "Create bucket"
3. Bucket name: `cypheredge-updates`
4. Region: `us-east-1` (or closest to your users)
5. **Block Public Access:** Keep ALL checked (we'll use CloudFront)
6. **Versioning:** Enable
7. **Encryption:** Enable (AES-256)
8. Click "Create bucket"

**Option B: AWS CLI**
```bash
# Create bucket
aws s3api create-bucket --bucket cypheredge-updates --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning --bucket cypheredge-updates \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption --bucket cypheredge-updates \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### Step 2: Create IAM User for GitHub Actions (10 min)

**AWS Console:**
1. Go to https://console.aws.amazon.com/iam/
2. Click "Users" → "Create user"
3. Username: `github-actions-cypheredge`
4. Attach policies: Create custom policy

**Custom Policy JSON:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::cypheredge-updates",
        "arn:aws:s3:::cypheredge-updates/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "*"
    }
  ]
}
```

5. Create user → Click "Create access key"
6. Select "Third-party service"
7. **IMPORTANT:** Copy `Access Key ID` and `Secret Access Key` - you'll need these!

### Step 3: Create CloudFront Distribution (20 min)

**AWS Console:**
1. Go to https://console.aws.amazon.com/cloudfront/
2. Click "Create Distribution"

**Origin Settings:**
- Origin domain: Select your S3 bucket (`cypheredge-updates.s3.us-east-1.amazonaws.com`)
- Origin access: **Origin Access Control (OAC)** - Recommended
- Click "Create new OAC" → Use defaults → Create

**Default Cache Behavior:**
- Viewer protocol: Redirect HTTP to HTTPS
- Allowed HTTP methods: GET, HEAD, OPTIONS
- Cache policy: CachingOptimized
- Compress objects: Yes

**Settings:**
- Price class: Use all edge locations (or customize based on users)
- Click "Create distribution"

3. **Copy the Distribution Domain Name** (e.g., `d1234abcd.cloudfront.net`)
4. **Copy the Distribution ID** (e.g., `E1234ABCDEFGHI`)

### Step 4: Update S3 Bucket Policy for CloudFront (5 min)

1. Go back to S3 → `cypheredge-updates` → Permissions
2. Scroll to "Bucket policy" → Edit
3. Paste this (replace `YOUR_ACCOUNT_ID` and `YOUR_DISTRIBUTION_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::cypheredge-updates/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

**How to find YOUR_ACCOUNT_ID:**
```bash
aws sts get-caller-identity --query Account --output text
```

4. Save changes

### Step 5: Test CloudFront Access (5 min)

**Upload a test file:**
```bash
# Create test file
echo "CypherEdge Update System - Test" > test.txt

# Upload to S3
aws s3 cp test.txt s3://cypheredge-updates/test.txt

# Test CloudFront access (replace with your CloudFront domain)
curl https://d1234abcd.cloudfront.net/test.txt

# Should output: "CypherEdge Update System - Test"
```

**✅ Day 1 Complete!** You now have:
- S3 bucket for storing updates
- IAM user for GitHub Actions
- CloudFront CDN for fast global distribution

---

## Day 2: Update Application Configuration (2-3 hours)

### Step 1: Add GitHub Secrets (5 min)

1. Go to your GitHub repo: `https://github.com/Shama-Cyphersol/ca-offline-suite`
2. Settings → Secrets and variables → Actions → "New repository secret"
3. Add these secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `AWS_ACCESS_KEY_ID` | From IAM user creation | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | From IAM user creation | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | Your bucket region | `us-east-1` |
| `S3_BUCKET` | Your bucket name | `cypheredge-updates` |
| `CLOUDFRONT_DISTRIBUTION_ID` | From CloudFront console | `E1234ABCDEFGHI` |
| `CLOUDFRONT_URL` | CloudFront domain | `https://d1234abcd.cloudfront.net` |

### Step 2: Update `.env` File (2 min)

**File:** `frontend/.env`

**Add these lines:**
```env
# S3 Update Server Configuration
UPDATE_SERVER_URL=https://d1234abcd.cloudfront.net/releases/windows
UPDATE_CHANNEL=latest

# Optional: Keep GH_TOKEN as fallback during transition
# GH_TOKEN=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
```

### Step 3: Update `package.json` (10 min)

**File:** `frontend/package.json`

**Find the `publish` section (around line 55):**
```json
"publish": {
  "provider": "github",
  "owner": "Shama-Cyphersol",
  "repo": "ca-offline-suite",
  "private": true,
  "releaseType": "release"
}
```

**Replace with:**
```json
"publish": {
  "provider": "generic",
  "url": "https://d1234abcd.cloudfront.net/releases/windows",
  "channel": "latest"
}
```

**Important:** Update the NSIS section to enable differential updates:
```json
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": false,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "shortcutName": "CypherEdge",
  "deleteAppDataOnUninstall": false,
  "artifactName": "${productName}-Setup-${version}.${ext}",
  "uninstallDisplayName": "${productName}",
  "differentialPackage": true,  // ← CHANGE THIS TO true
  "warningsAsErrors": false
}
```

### Step 4: Update `main.js` (15 min)

**File:** `frontend/main.js`

**Find this section (around line 178):**
```javascript
// Configure autoUpdater for GitHub repository
autoUpdater.setFeedURL({
  provider: "github",
  owner: "Shama-Cyphersol",
  repo: "ca-offline-suite",
  token: process.env.GH_TOKEN,
});
```

**Replace with:**
```javascript
// Configure autoUpdater for S3 + CloudFront
const updateServerUrl = process.env.UPDATE_SERVER_URL || "https://d1234abcd.cloudfront.net/releases/windows";

autoUpdater.setFeedURL({
  provider: "generic",
  url: updateServerUrl,
  channel: process.env.UPDATE_CHANNEL || "latest"
});

log.info("Update Configuration (S3 + CloudFront):", {
  provider: "generic",
  updateUrl: updateServerUrl,
  channel: process.env.UPDATE_CHANNEL || "latest",
  platform: process.platform
});
```

**Optional: Add fallback mechanism (recommended during transition):**
```javascript
// Dual provider setup for safe transition
let updateProviders = [
  {
    name: "S3 + CloudFront",
    config: {
      provider: "generic",
      url: process.env.UPDATE_SERVER_URL || "https://d1234abcd.cloudfront.net/releases/windows"
    }
  }
];

// Keep GitHub as fallback during transition period
if (process.env.GH_TOKEN) {
  updateProviders.push({
    name: "GitHub (Fallback)",
    config: {
      provider: "github",
      owner: "Shama-Cyphersol",
      repo: "ca-offline-suite",
      token: process.env.GH_TOKEN
    }
  });
}

// Try S3 first, fallback to GitHub if needed
async function setupUpdateProvider() {
  for (const provider of updateProviders) {
    try {
      log.info(`Setting up update provider: ${provider.name}`);
      autoUpdater.setFeedURL(provider.config);

      // Test the connection
      const checkResult = await autoUpdater.checkForUpdates();
      log.info(`✅ Update provider successful: ${provider.name}`, checkResult);
      return true;
    } catch (error) {
      log.warn(`❌ Update provider failed: ${provider.name}`, error.message);
      continue;
    }
  }

  log.error("All update providers failed!");
  return false;
}

// Call this during app initialization
app.on("ready", async () => {
  await setupUpdateProvider();
  // ... rest of your app initialization
});
```

### Step 5: Update GitHub Actions Workflow (30 min)

**File:** `.github/workflows/release.yml`

**Add AWS configuration step after "Setup Node.js":**
```yaml
      # Configure AWS credentials
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
```

**Add S3 upload step after "Build Frontend for Production":**
```yaml
      # Upload to S3
      - name: Upload Release to S3
        run: |
          Write-Host "☁️ Uploading release artifacts to S3..." -ForegroundColor Yellow

          $s3Bucket = "${{ secrets.S3_BUCKET }}"
          $version = "${{ steps.version.outputs.version }}"
          $s3Path = "releases/windows"

          # Upload Windows installer
          $installer = Get-ChildItem -Path "frontend/dist" -Filter "*.exe" | Select-Object -First 1
          if ($installer) {
            Write-Host "📦 Uploading: $($installer.Name)"
            aws s3 cp $installer.FullName "s3://$s3Bucket/$s3Path/$($installer.Name)"
          }

          # Upload blockmap (for differential updates)
          $blockmap = Get-ChildItem -Path "frontend/dist" -Filter "*.exe.blockmap" | Select-Object -First 1
          if ($blockmap) {
            Write-Host "📦 Uploading blockmap: $($blockmap.Name)"
            aws s3 cp $blockmap.FullName "s3://$s3Bucket/$s3Path/$($blockmap.Name)"
          }

          # Upload latest.yml (CRITICAL for electron-updater)
          $latest = Get-ChildItem -Path "frontend/dist" -Filter "latest.yml" | Select-Object -First 1
          if ($latest) {
            Write-Host "📦 Uploading update manifest: latest.yml"
            aws s3 cp $latest.FullName "s3://$s3Bucket/$s3Path/latest.yml" --cache-control "max-age=0, no-cache"
          }

          Write-Host "✅ Upload complete!" -ForegroundColor Green
        shell: pwsh

      # Invalidate CloudFront cache
      - name: Invalidate CloudFront Cache
        run: |
          Write-Host "🔄 Invalidating CloudFront cache..." -ForegroundColor Yellow

          aws cloudfront create-invalidation `
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} `
            --paths "/releases/windows/*"

          Write-Host "✅ Cache invalidated" -ForegroundColor Green
        shell: pwsh
```

**✅ Day 2 Complete!** Your application is now configured for S3 updates.

---

## Day 3: Testing & Deployment (2-3 hours)

### Step 1: Create Staging Environment (30 min)

**Create staging S3 bucket:**
```bash
aws s3api create-bucket --bucket cypheredge-updates-staging --region us-east-1
aws s3api put-bucket-versioning --bucket cypheredge-updates-staging --versioning-configuration Status=Enabled
```

**Update `.env` for testing:**
```env
UPDATE_SERVER_URL=https://staging-cloudfront-url/releases/windows
UPDATE_CHANNEL=staging
```

### Step 2: Manual Test Build (30 min)

**Build the app locally:**
```bash
cd frontend

# Sync version
npm run sync-version

# Build
npm run build
```

**Upload to staging S3:**
```bash
cd dist

# Upload installer
aws s3 cp "CypherEdge-Setup-2.1.200.exe" s3://cypheredge-updates-staging/releases/windows/

# Upload blockmap
aws s3 cp "CypherEdge-Setup-2.1.200.exe.blockmap" s3://cypheredge-updates-staging/releases/windows/

# Upload latest.yml
aws s3 cp latest.yml s3://cypheredge-updates-staging/releases/windows/ --cache-control "max-age=0, no-cache"
```

**Verify files:**
```bash
aws s3 ls s3://cypheredge-updates-staging/releases/windows/
```

### Step 3: Test Update Detection (30 min)

**Method 1: Test with older version**
1. Install current production version (e.g., 2.1.199)
2. Update `.env` to point to staging S3
3. Launch app
4. Check for updates
5. Should detect version 2.1.200

**Method 2: Test with DevTools**
```javascript
// In Electron DevTools console
const { ipcRenderer } = require('electron');

// Trigger update check
ipcRenderer.send('check-for-updates');

// Listen for update events
ipcRenderer.on('update-available', (event, info) => {
  console.log('Update available:', info);
});
```

### Step 4: GitHub Actions Test (30 min)

**Create test branch:**
```bash
git checkout -b s3-update-test
git add .
git commit -m "Test S3 update deployment"
git push origin s3-update-test
```

**Manually trigger workflow:**
1. Go to GitHub Actions
2. Select your workflow
3. Click "Run workflow"
4. Select branch: `s3-update-test`
5. Run workflow

**Verify:**
- [ ] Build completes successfully
- [ ] Files uploaded to S3
- [ ] CloudFront cache invalidated
- [ ] Files accessible via CloudFront URL

### Step 5: Production Deployment (30 min)

**If all tests pass:**

1. **Merge to main:**
```bash
git checkout main
git merge s3-update-test
git push origin main
```

2. **Create release tag:**
```bash
git tag -a v2.1.201 -m "First S3-based release"
git push origin v2.1.201
```

3. **Monitor deployment:**
- Watch GitHub Actions
- Check S3 bucket
- Verify CloudFront

4. **Test with real app:**
- Install previous version
- Check for updates
- Download and install

**✅ Day 3 Complete!** You're now live on S3!

---

## Post-Migration Monitoring (Ongoing)

### Week 1: Close Monitoring

**Check daily:**
- [ ] Update success rate (should be >95%)
- [ ] Download speed (should be 3-5x faster than GitHub)
- [ ] Error logs in CloudWatch
- [ ] AWS costs

**Monitor:**
```bash
# S3 Metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name NumberOfObjects \
  --dimensions Name=BucketName,Value=cypheredge-updates \
  --start-time 2025-11-01T00:00:00Z \
  --end-time 2025-11-04T00:00:00Z \
  --period 86400 \
  --statistics Average

# CloudFront Requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=YOUR_DISTRIBUTION_ID \
  --start-time 2025-11-01T00:00:00Z \
  --end-time 2025-11-04T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Week 2-4: Optimization

- [ ] Enable differential updates if not done
- [ ] Analyze download patterns
- [ ] Adjust cache settings
- [ ] Optimize CloudFront regions
- [ ] Review costs

---

## Troubleshooting

### Update not detected

**Check:**
```bash
# 1. Verify latest.yml exists and is accessible
curl https://your-cloudfront-url/releases/windows/latest.yml

# 2. Check version in latest.yml
cat frontend/dist/latest.yml

# 3. Verify CloudFront cache
aws cloudfront get-distribution --id YOUR_DIST_ID | grep -i status
```

**Fix:**
```bash
# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/releases/windows/latest.yml"
```

### Download fails

**Check:**
```bash
# Test direct download
curl -I https://your-cloudfront-url/releases/windows/CypherEdge-Setup-2.1.200.exe

# Should return: HTTP/2 200
```

**Fix:**
- Verify S3 bucket policy
- Check CloudFront OAC settings
- Ensure file was uploaded correctly

### Slow downloads

**Check CloudFront edge location:**
```bash
# Test from different regions
curl -w "Time: %{time_total}s\n" -o /dev/null https://your-cloudfront-url/releases/windows/test.txt
```

**Fix:**
- Enable compression in CloudFront
- Use all edge locations (not regional)
- Enable differential updates

---

## Success Metrics

**After 1 week, you should see:**
- ✅ 95%+ update success rate
- ✅ 3-5x faster downloads vs GitHub
- ✅ No GitHub rate limit errors
- ✅ Global availability
- ✅ <$20 monthly cost for 1000 users

**After 1 month:**
- ✅ Decommission GitHub releases
- ✅ Optimized cache settings
- ✅ Stable costs
- ✅ Happy users with fast updates

---

## Next Steps

1. **Complete Day 1** (AWS setup)
2. **Complete Day 2** (app configuration)
3. **Complete Day 3** (testing & deployment)
4. **Monitor for 1 week**
5. **Optimize based on metrics**
6. **Decommission GitHub updates**

**Questions?**
- Check the full migration guide: `docs/S3_MIGRATION_GUIDE.md`
- AWS Support: https://console.aws.amazon.com/support/
- electron-updater docs: https://www.electron.build/auto-update

---

**Good luck with your migration! 🚀**
