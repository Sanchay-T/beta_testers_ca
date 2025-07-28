#!/usr/bin/env python3
"""
GitHub Actions Workflow Validator
Validates YAML syntax and common issues before pushing
"""

import json
import sys
import os
from pathlib import Path

def validate_yaml_syntax(file_path):
    """Basic YAML syntax validation (without yaml module)"""
    print(f"🔍 Checking basic YAML syntax: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Basic checks
        issues = []
        
        # Check for obvious issues
        if 'uses:' in content and 'run:' in content:
            # Check if they're in the same step (very basic check)
            lines = content.split('\n')
            current_step = None
            for i, line in enumerate(lines):
                if '- name:' in line:
                    current_step = i
                elif current_step and 'uses:' in line:
                    # Look for 'run:' in the next few lines of the same step
                    for j in range(i+1, min(len(lines), i+10)):
                        if lines[j].strip().startswith('- name:'):
                            break
                        if 'run:' in lines[j]:
                            issues.append(f"Line {j+1}: Step has both 'uses' and 'run'")
        
        if issues:
            print("❌ Potential syntax issues:")
            for issue in issues:
                print(f"   - {issue}")
            return False
        else:
            print("✅ Basic syntax looks good")
            return True
            
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return False

def validate_workflow_structure(file_path):
    """Basic workflow structure validation"""
    print(f"🔍 Checking basic workflow structure: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        issues = []
        
        # Check required fields (basic text search)
        if 'name:' not in content:
            issues.append("Missing 'name:' field")
        
        if 'on:' not in content:
            issues.append("Missing 'on:' field")
        
        if 'jobs:' not in content:
            issues.append("Missing 'jobs:' field")
        
        if 'runs-on:' not in content:
            issues.append("Missing 'runs-on:' field")
        
        if 'steps:' not in content:
            issues.append("Missing 'steps:' field")
        
        if issues:
            print("❌ Basic structure issues found:")
            for issue in issues:
                print(f"   - {issue}")
            return False
        else:
            print("✅ Basic workflow structure looks good")
            return True
            
    except Exception as e:
        print(f"❌ Error validating structure: {e}")
        return False

def validate_secrets_usage(file_path):
    """Check for potential secrets issues"""
    print(f"🔍 Checking secrets usage: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        warnings = []
        
        # Check for hardcoded secrets (common patterns)
        secret_patterns = [
            'ghp_',  # GitHub personal access token
            'sk_',   # Various API keys
            'pk_',   # Public keys that might be paired with secrets
        ]
        
        for pattern in secret_patterns:
            if pattern in content and 'secrets.' not in content:
                warnings.append(f"Potential hardcoded secret pattern: {pattern}")
        
        # Check for proper secrets usage
        if '${{ secrets.' in content:
            print("✅ Using GitHub Secrets properly")
        
        if warnings:
            print("⚠️ Potential issues found:")
            for warning in warnings:
                print(f"   - {warning}")
        else:
            print("✅ No secrets issues found")
            
        return True
        
    except Exception as e:
        print(f"❌ Error checking secrets: {e}")
        return False

def main():
    """Main validation function"""
    print("🚀 GitHub Actions Workflow Validator")
    print("=" * 50)
    
    # Find workflow files
    workflows_dir = Path('.github/workflows')
    if not workflows_dir.exists():
        print("❌ .github/workflows directory not found")
        sys.exit(1)
    
    workflow_files = list(workflows_dir.glob('*.yml')) + list(workflows_dir.glob('*.yaml'))
    
    if not workflow_files:
        print("❌ No workflow files found")
        sys.exit(1)
    
    print(f"📁 Found {len(workflow_files)} workflow file(s)")
    
    all_valid = True
    
    for workflow_file in workflow_files:
        print(f"\n📄 Validating: {workflow_file.name}")
        print("-" * 30)
        
        # Run all validations
        yaml_valid = validate_yaml_syntax(workflow_file)
        structure_valid = validate_workflow_structure(workflow_file)
        secrets_valid = validate_secrets_usage(workflow_file)
        
        file_valid = yaml_valid and structure_valid and secrets_valid
        all_valid = all_valid and file_valid
        
        if file_valid:
            print(f"✅ {workflow_file.name} is valid")
        else:
            print(f"❌ {workflow_file.name} has issues")
    
    print("\n" + "=" * 50)
    if all_valid:
        print("🎉 All workflows are valid!")
        print("🚀 Safe to commit and push!")
        sys.exit(0)
    else:
        print("❌ Some workflows have issues")
        print("🔧 Please fix the issues before pushing")
        sys.exit(1)

if __name__ == "__main__":
    main()