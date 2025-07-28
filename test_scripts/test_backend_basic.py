#!/usr/bin/env python3
"""
Simple backend health check script for GitHub Actions
Tests if the main.exe server is working properly
"""

import requests
import time
import sys
import json

def test_backend_health():
    """Test if backend server is responding"""
    print("🔍 Testing backend health...")
    
    try:
        response = requests.get("http://localhost:7500/", timeout=10)
        print(f"✅ Health check passed - Status: {response.status_code}")
        print(f"📄 Response: {response.text[:200]}...")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_basic_endpoints():
    """Test basic FastAPI endpoints"""
    print("🧪 Testing basic endpoints...")
    
    endpoints_to_test = [
        "/",
        "/health",  # If you have this
        "/docs",    # FastAPI docs
    ]
    
    results = {}
    for endpoint in endpoints_to_test:
        try:
            response = requests.get(f"http://localhost:7500{endpoint}", timeout=5)
            results[endpoint] = {
                "status": response.status_code,
                "success": response.status_code < 400
            }
            print(f"✅ {endpoint} - Status: {response.status_code}")
        except requests.exceptions.RequestException as e:
            results[endpoint] = {
                "status": "ERROR",
                "success": False,
                "error": str(e)
            }
            print(f"❌ {endpoint} - Error: {e}")
    
    return results

def main():
    """Main test function"""
    print("🚀 Starting backend tests...")
    print("=" * 50)
    
    # Wait a bit for server to be fully ready
    print("⏳ Waiting for server to be ready...")
    time.sleep(5)
    
    # Test 1: Basic health check
    health_ok = test_backend_health()
    if not health_ok:
        print("❌ Backend health check failed!")
        sys.exit(1)
    
    # Test 2: Basic endpoints
    endpoint_results = test_basic_endpoints()
    
    # Summary
    print("=" * 50)
    print("📊 Test Results Summary:")
    
    successful_tests = sum(1 for result in endpoint_results.values() if result['success'])
    total_tests = len(endpoint_results)
    
    print(f"✅ Successful: {successful_tests}/{total_tests}")
    
    if successful_tests == total_tests:
        print("🎉 All tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()