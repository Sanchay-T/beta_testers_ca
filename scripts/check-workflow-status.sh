#!/bin/bash
# Quick script to check GitHub Actions status
# Usage: ./scripts/check-workflow-status.sh

echo "🔍 Checking GitHub Actions status..."
echo "========================================"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not installed"
    echo "🔧 Install with: winget install GitHub.cli (Windows) or brew install gh (macOS)"
    exit 1
fi

# Check authentication
echo "🔐 Checking GitHub authentication..."
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub"
    echo "🔧 Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI ready"
echo ""

# List recent workflow runs
echo "📊 Recent workflow runs:"
echo "------------------------"
gh run list --limit 5 --json displayTitle,status,conclusion,createdAt,databaseId --template '{{range .}}{{.displayTitle | truncate 50}} | {{.status}} | {{.conclusion}} | {{timeago .createdAt}} | ID: {{.databaseId}}
{{end}}'

echo ""
echo "🎯 Quick Commands:"
echo "• Watch latest run: gh run watch \$(gh run list -L 1 -q '.[0].databaseId')"
echo "• View logs: gh run view --log"
echo "• Download artifacts: gh run download <run-id>"
echo "• Trigger manually: gh workflow run simple-backend-test.yml --ref test/backend-automation"
echo ""

# Check if there's a running workflow
RUNNING=$(gh run list --status in_progress --limit 1 --json databaseId --jq '.[0].databaseId // empty')
if [ ! -z "$RUNNING" ]; then
    echo "🏃 Workflow currently running (ID: $RUNNING)"
    echo "🔴 Watch live: gh run watch $RUNNING"
    
    # Optionally watch it automatically
    read -p "🤔 Watch the running workflow now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh run watch $RUNNING
    fi
else
    echo "💤 No workflows currently running"
fi