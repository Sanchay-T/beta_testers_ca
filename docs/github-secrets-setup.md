# GitHub Secrets Setup Guide

This guide helps you set up GitHub Secrets for automated builds and CI/CD.

## Required Secrets

Based on your `frontend/.env` file, you need to configure these secrets in GitHub:

### 1. Go to GitHub Repository Settings
1. Navigate to your repo: `https://github.com/Shama-Cyphersol/beta_testers_ca`
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**

### 2. Add These Secrets

| Secret Name | Value | Description |
|-------------|--------|-------------|
| `UUID_SALT` | `cyphersol` | Salt for UUID generation |
| `API_URL` | `https://cyphersol.co.in/validate-offlineapp-login/` | License validation API |
| `GH_TOKEN` | `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` | GitHub personal access token |

### 3. Optional Secrets for Production

| Secret Name | Example Value | Description |
|-------------|---------------|-------------|
| `TELEGRAM_BOT_TOKEN` | `123456:ABC-DEF...` | For build notifications |
| `TELEGRAM_CHAT_ID` | `@your_username` | Your Telegram chat |
| `SMTP_USERNAME` | `your-email@gmail.com` | Email notifications |
| `SMTP_PASSWORD` | `your-password` | Email app password |

## Environment-Specific Configuration

### Development Builds (Current)
- `NODE_ENV`: `development`
- `VALIDATE_LICENSE`: `false`
- `APP_VERSION`: `dev-{build_number}`

### Production Builds (Future)
- `NODE_ENV`: `production`
- `VALIDATE_LICENSE`: `true`
- `APP_VERSION`: `{git_tag}` or `{semantic_version}`

## Version Management Strategy

### Development Versions
- Format: `dev-123` (where 123 is GitHub run number)
- No update prompts for users
- Clearly marked as development builds

### Beta/Pre-release Versions  
- Format: `1.1.0-beta.1`
- Limited update prompts
- For testing team only

### Production Versions
- Format: `1.1.0`
- Full update prompts and notifications
- For end customers

## How to Set Up Secrets (Step by Step)

### Method 1: GitHub Web Interface
```bash
1. Go to: https://github.com/Shama-Cyphersol/beta_testers_ca/settings/secrets/actions
2. Click "New repository secret"
3. Name: UUID_SALT
4. Secret: cyphersol
5. Click "Add secret"
6. Repeat for all secrets above
```

### Method 2: GitHub CLI (if you have it)
```bash
gh secret set UUID_SALT --body "cyphersol"
gh secret set API_URL --body "https://cyphersol.co.in/validate-offlineapp-login/"
gh secret set GH_TOKEN --body "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"
```

## Security Notes

⚠️ **Important Security Considerations:**
- Never commit `.env` files to Git
- Rotate the GH_TOKEN if it's been exposed
- Use environment-specific API URLs
- Keep production secrets separate from development

## Testing the Setup

After adding secrets, push any change to `test/backend-automation` branch to trigger the workflow and verify secrets are working.

The workflow will:
1. ✅ Create `.env` file using secrets
2. ✅ Build with proper environment variables  
3. ✅ Show which variables were set (without values)
4. ✅ Upload debug logs if anything fails