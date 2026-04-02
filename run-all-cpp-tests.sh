#!/bin/bash

# Script to run all C++ tests
# Usage: ./run-all-cpp-tests.sh [build-type]
# build-type: Debug (default) or Release

set -e

BUILD_TYPE="${1:-Debug}"
BUILD_DIR="./build"

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Build directory not found at $BUILD_DIR"
    echo "Please run ./build.sh first"
    exit 1
fi

# Array to store test results
declare -a test_results
declare -a test_names

echo "🧪 Running C++ Tests (Build Type: $BUILD_TYPE)"
echo "==============================================="

# Function to run a test and capture result
run_test() {
    local test_path="$1"
    local test_name=$(basename "$test_path")
    
    if [ ! -f "$test_path" ]; then
        echo "⚠️  Test not found: $test_path"
        return 1
    fi
    
    echo ""
    echo "Running: $test_name"
    echo "---"
    
    if "$test_path" 2>&1; then
        echo "✅ PASSED: $test_name"
        test_results+=("PASSED")
        test_names+=("$test_name")
        return 0
    else
        echo "❌ FAILED: $test_name"
        test_results+=("FAILED")
        test_names+=("$test_name")
        return 1
    fi
}

# Run tests
FAILED_COUNT=0

# Runtime tests
if [ -f "$BUILD_DIR/hkp-rt/tests/$BUILD_TYPE/hkp-rt-runtime-tests" ]; then
    run_test "$BUILD_DIR/hkp-rt/tests/$BUILD_TYPE/hkp-rt-runtime-tests" || ((FAILED_COUNT++))
fi

# Service tests (includes sub-service tests)
if [ -f "$BUILD_DIR/hkp-rt/tests/$BUILD_TYPE/hkp-rt-service-tests" ]; then
    run_test "$BUILD_DIR/hkp-rt/tests/$BUILD_TYPE/hkp-rt-service-tests" || ((FAILED_COUNT++))
fi

# Print summary
echo ""
echo "==============================================="
echo "📊 Test Summary"
echo "==============================================="

for i in "${!test_names[@]}"; do
    status="${test_results[$i]}"
    name="${test_names[$i]}"
    if [ "$status" = "PASSED" ]; then
        echo "✅ $name"
    else
        echo "❌ $name"
    fi
done

TOTAL=${#test_names[@]}
PASSED=$((TOTAL - FAILED_COUNT))

echo ""
echo "Total: $TOTAL | Passed: $PASSED | Failed: $FAILED_COUNT"
echo ""

if [ $FAILED_COUNT -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed"
    exit 1
fi
