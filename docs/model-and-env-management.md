# Model Files & Environment Management

## 🤖 **PaddleOCR Model Files**

### **The Problem**
- PaddleOCR models are large binary files (4.5MB - 84MB)
- GitHub rejects files over 100MB, warns at 50MB+
- CI/CD needs these models to build executables

### **Solution: Git LFS + Download Fallback**

#### **Git LFS Setup (For Repository)**
```bash
# Initialize Git LFS (if not already done)
git lfs install

# Track model files
git lfs track "backend/models/**/*.pdiparams"
git lfs track "backend/models/**/*.safetensors"

# Add and commit
git add .gitattributes
git add backend/models/
git commit -m "Add PaddleOCR models via Git LFS"
git push
```

#### **Model Files Included**
- `backend/models/PP-OCRv5_mobile_det_infer/` (4.5MB)
- `backend/models/PP-OCRv5_mobile_rec_infer/` (16MB)  
- `backend/models/PP-OCRv5_server_det_infer/` (84MB)
- `backend/models/PP-OCRv5_server_rec_infer/` (80MB)
- `backend/models/local_model/` (transformer models)

#### **CI/CD Handling**
The GitHub Actions workflow now:
1. ✅ **Downloads models** via Git LFS automatically
2. ✅ **Includes models** in PyInstaller with `--add-data`
3. ✅ **Falls back** to downloading if LFS fails

## 🔐 **Environment Variable Management**

### **The Problem**
- `.env` files contain secrets (API keys, tokens, etc.)
- Cannot push sensitive data to public repositories
- CI/CD needs environment variables to build/test

### **Solution: GitHub Secrets + Dynamic .env Creation**

#### **What's Ignored**
```gitignore
# Environment files (use GitHub Secrets instead)
.env
frontend/.env
backend/.env
*.env.local
*.env.production
```

#### **GitHub Secrets Configuration**
In your repository settings → Secrets and variables → Actions:

| Secret Name | Example Value | Description |
|-------------|---------------|-------------|
| `DB_FILE_NAME` | `file:db.sqlite3` | Database file path |
| `UUID_SALT` | `cyphersol` | Salt for UUID generation |
| `API_URL` | `https://cyphersol.co.in/validate-offlineapp-login/` | License API endpoint |
| `GH_TOKEN` | `ghp_...` | GitHub personal access token |

#### **Dynamic .env Creation**
GitHub Actions automatically creates `frontend/.env`:

```yaml
$envContent = @"
DB_FILE_NAME=${{ secrets.DB_FILE_NAME }}
NODE_ENV=${{ env.NODE_ENV }}
UUID_SALT=${{ secrets.UUID_SALT }}
VALIDATE_LICENSE=${{ env.VALIDATE_LICENSE }}
API_URL=${{ secrets.API_URL }}
FOR_ATS=${{ env.FOR_ATS }}
GH_TOKEN=${{ secrets.GH_TOKEN }}
APP_VERSION=${{ env.APP_VERSION }}
"@

$envContent | Out-File -FilePath "frontend/.env" -Encoding UTF8
```

#### **Local Development**
For local development, create your own `.env` files:

```bash
# Create local .env (this stays on your machine)
echo "DB_FILE_NAME=file:db.sqlite3" > frontend/.env
echo "NODE_ENV=development" >> frontend/.env
echo "UUID_SALT=cyphersol" >> frontend/.env
# ... add other variables
```

## 🚀 **Benefits of This Approach**

### **Model Management**
- ✅ **Large files handled** via Git LFS
- ✅ **CI gets models** automatically  
- ✅ **No manual downloads** needed
- ✅ **Version controlled** model updates

### **Environment Management**
- ✅ **Secrets stay secure** (never in repository)
- ✅ **Different environments** (dev, CI, production)
- ✅ **Easy rotation** of API keys/tokens
- ✅ **Team collaboration** without sharing secrets

## 🛠️ **Setup Commands**

### **One-time Git LFS Setup**
```bash
# Install Git LFS (if not already installed)
git lfs install

# Add model files to LFS tracking
git add .gitattributes
git add backend/models/
git commit -m "Add models to Git LFS"
git push
```

### **Verify Setup**
```bash
# Check LFS files
git lfs ls-files

# Check ignored files
git status --ignored

# Verify models exist in CI
# (Check GitHub Actions logs for "Models directory exists")
```

## 🔧 **Troubleshooting**

### **Git LFS Issues**
```bash
# If LFS files aren't downloading
git lfs pull

# If LFS quota exceeded
# Use model download fallback in CI
```

### **Environment Issues**
```bash
# If secrets aren't working in CI
# Check GitHub repo settings → Secrets and variables → Actions

# If local .env missing
# Create manually (don't commit it!)
```

This setup ensures both large model files and sensitive environment variables are handled properly in development and CI/CD! 🎯