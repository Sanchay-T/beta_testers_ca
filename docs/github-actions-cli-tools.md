# GitHub Actions CLI Tools & Management

Complete guide to managing GitHub Actions via command line tools.

## 🚀 Essential CLI Tools

### 1. **GitHub CLI (gh)** - Official Tool
**Installation:**
```bash
# Windows (via winget)
winget install GitHub.cli

# macOS (via Homebrew)
brew install gh

# Linux (via apt)
sudo apt install gh
```

**Key Commands:**
```bash
# Authentication
gh auth login

# View workflows
gh workflow list
gh workflow view simple-backend-test.yml

# Run workflows manually
gh workflow run simple-backend-test.yml

# Check workflow runs
gh run list
gh run view <run-id>
gh run watch <run-id>  # Live monitoring!

# Download artifacts
gh run download <run-id>

# View logs
gh run view <run-id> --log
```

### 2. **act** - Local GitHub Actions Runner
**Run GitHub Actions locally on your machine!**

**Installation:**
```bash
# Windows (via choco)
choco install act-cli

# macOS (via Homebrew)  
brew install act

# Linux (via curl)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

**Usage:**
```bash
# Run all workflows locally
act

# Run specific workflow
act -W .github/workflows/simple-backend-test.yml

# Run with secrets
act --secret-file .secrets

# List workflows
act -l

# Dry run (see what would happen)
act -n
```

### 3. **actionlint** - Workflow Validation
**Validates GitHub Actions syntax before pushing!**

**Installation:**
```bash
# Windows
go install github.com/rhymond/actionlint/cmd/actionlint@latest

# macOS
brew install actionlint

# Linux
curl -L https://github.com/rhymond/actionlint/releases/latest/download/actionlint_linux_amd64.tar.gz | tar xz
```

**Usage:**
```bash
# Validate all workflows
actionlint

# Validate specific file
actionlint .github/workflows/simple-backend-test.yml

# Auto-fix some issues
actionlint -format '{{.Message}}'
```

## 🛠️ Complete Workflow Management Setup

### Step 1: Install Tools
```powershell
# Run this in PowerShell as Administrator
winget install GitHub.cli
choco install act-cli
go install github.com/rhymond/actionlint/cmd/actionlint@latest
```

### Step 2: Authenticate GitHub CLI
```bash
gh auth login
# Follow prompts to authenticate with your GitHub account
```

### Step 3: Validate Your Workflow
```bash
# Navigate to your project
cd /path/to/beta_testers_ca

# Validate workflow syntax
actionlint .github/workflows/simple-backend-test.yml

# List all workflows
gh workflow list

# Check latest runs
gh run list --limit 5
```

### Step 4: Local Testing Setup
```bash
# Test workflow locally (requires Docker)
act -j build-and-test-backend

# Test with secrets
echo "UUID_SALT=cyphersol" > .secrets
echo "API_URL=https://cyphersol.co.in/validate-offlineapp-login/" >> .secrets
act --secret-file .secrets
```

## 📊 Monitoring & Debugging Commands

### Live Monitoring
```bash
# Watch workflow execution in real-time
gh workflow run simple-backend-test.yml --ref test/backend-automation
gh run watch $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
```

### Debug Failed Runs
```bash
# Get latest failed run
gh run list --status failure --limit 1

# View detailed logs
gh run view <run-id> --log --log-failed

# Download debug artifacts
gh run download <run-id> --name debug-logs-*
```

### Workflow Management
```bash
# Cancel running workflow
gh run cancel <run-id>

# Re-run failed workflow
gh run rerun <run-id>

# Delete old workflow runs
gh run list --status completed --limit 50 --json databaseId --jq '.[].databaseId' | xargs -I {} gh api repos/:owner/:repo/actions/runs/{} -X DELETE
```

## 🔧 Fix Current Workflow Issue

Let me create a script to identify and fix the YAML syntax error:

### Workflow Validator Script
```bash
#!/bin/bash
# Save as validate-workflow.sh

echo "🔍 Validating GitHub Actions workflow..."

# Check if actionlint is installed
if command -v actionlint &> /dev/null; then
    echo "✅ Running actionlint validation..."
    actionlint .github/workflows/simple-backend-test.yml
else
    echo "⚠️ actionlint not installed. Install with: go install github.com/rhymond/actionlint/cmd/actionlint@latest"
fi

# Check YAML syntax with Python
python3 -c "
import yaml
import sys

try:
    with open('.github/workflows/simple-backend-test.yml', 'r') as file:
        yaml.safe_load(file)
    print('✅ YAML syntax is valid')
except yaml.YAMLError as e:
    print(f'❌ YAML syntax error: {e}')
    sys.exit(1)
except Exception as e:
    print(f'❌ Error reading file: {e}')
    sys.exit(1)
"

echo "🎉 Validation complete!"
```

## 🚨 Current Issue Fix

The error "a step cannot have both the `uses` and `run` keys" suggests a formatting issue. Let me check your specific workflow file and provide a corrected version.

## 📱 Quick Commands for Daily Use

**Most Used Commands:**
```bash
# Check status
gh run list --limit 3

# Trigger build  
gh workflow run simple-backend-test.yml --ref test/backend-automation

# Watch live
gh run watch $(gh run list -L 1 -q '.[0].databaseId')

# Get logs
gh run view --log

# Download artifacts
gh run download
```

**Add these aliases to your shell:**
```bash
alias ghw="gh workflow"
alias ghr="gh run" 
alias ghrw="gh run watch"
alias ghrl="gh run list"
```

This gives you complete command-line control over your GitHub Actions! 🚀