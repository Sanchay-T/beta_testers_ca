#!/usr/bin/env python3
"""
Auto-detect PyInstaller dependencies by actually importing the modules
and seeing what breaks. Run this on the target machine to get the exact
list of hidden imports needed.
"""

import sys
import os
import importlib
import traceback
from pathlib import Path

def test_import(module_name):
    """Test if a module can be imported"""
    try:
        importlib.import_module(module_name)
        return True, None
    except Exception as e:
        return False, str(e)

def find_missing_modules():
    """Find all missing modules by trying to import the main backend"""
    print("🔍 Auto-detecting PyInstaller dependencies...")
    print("=" * 60)
    
    # Add current directory to Python path
    sys.path.insert(0, '.')
    
    missing_modules = []
    
    # Test main backend import
    print("📋 Testing main backend import...")
    try:
        # Set environment to skip heavy model loading
        os.environ['SKIP_MODEL_LOADING'] = 'true'
        
        import backend.main
        print("✅ Backend main imported successfully")
    except Exception as e:
        print(f"❌ Backend import failed: {e}")
        
        # Parse the error to find missing modules
        error_str = str(e)
        tb = traceback.format_exc()
        
        print("\n🔍 Analyzing error for missing modules...")
        print("-" * 40)
        
        # Common patterns for missing modules
        patterns_to_check = [
            "No module named",
            "ModuleNotFoundError",
            "ImportError"
        ]
        
        lines = tb.split('\n')
        for line in lines:
            if any(pattern in line for pattern in patterns_to_check):
                print(f"🔴 {line.strip()}")
                
                # Extract module name from error
                if "No module named" in line:
                    module_name = line.split("No module named")[-1].strip().strip("'\"")
                    if module_name and module_name not in missing_modules:
                        missing_modules.append(module_name)
    
    return missing_modules

def generate_pyinstaller_command(missing_modules):
    """Generate PyInstaller command with all detected dependencies"""
    print("\n🛠️ Recommended PyInstaller command:")
    print("=" * 60)
    
    base_cmd = "pyinstaller --onedir backend/main.py"
    
    # Add hidden imports
    hidden_imports = []
    
    # Add detected missing modules
    for module in missing_modules:
        hidden_imports.append(f"--hidden-import={module}")
    
    # Add known problematic modules for ML libraries
    known_problematic = [
        "scipy._cyutility",
        "scipy.sparse._matrix", 
        "scipy.sparse.csgraph._validation",
        "scipy.special._ufuncs_cxx",
        "scipy.linalg.cython_blas",
        "scipy.linalg.cython_lapack",
        "sklearn.utils._cython_blas",
        "sklearn.neighbors.typedefs",
        "sklearn.neighbors.quad_tree",
        "sklearn.tree._utils",
        "transformers.models.auto.modeling_auto",
        "transformers.models.auto.tokenization_auto"
    ]
    
    for module in known_problematic:
        hidden_imports.append(f"--hidden-import={module}")
    
    # Add collect-all for major packages
    collect_all = [
        "--collect-all=scipy",
        "--collect-all=sklearn", 
        "--collect-all=transformers",
        "--collect-all=paddleocr",
        "--collect-all=paddlex",
        "--collect-all=numpy",
        "--collect-all=pandas"
    ]
    
    # Build complete command
    full_cmd = base_cmd + " \\\n    " + " \\\n    ".join(hidden_imports + collect_all)
    
    print(full_cmd)
    print("\n" + "=" * 60)
    
    return full_cmd

def main():
    """Main function"""
    print("🚀 PyInstaller Dependency Auto-Detector")
    print("This script will find exactly what's missing for your backend\n")
    
    # Find missing modules
    missing = find_missing_modules()
    
    print(f"\n📊 Found {len(missing)} potentially missing modules:")
    for module in missing:
        print(f"  - {module}")
    
    # Generate PyInstaller command
    cmd = generate_pyinstaller_command(missing)
    
    # Save to file
    with open("pyinstaller_command.txt", "w") as f:
        f.write(cmd)
    
    print(f"\n💾 Command saved to: pyinstaller_command.txt")
    print("🎯 Use this command in your GitHub Actions workflow!")

if __name__ == "__main__":
    main()