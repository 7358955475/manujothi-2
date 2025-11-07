#!/bin/bash

# Analytics Dashboard Test Suite Execution Script
# This script runs all tests for the Dynamic Admin Analytics Dashboard

echo "========================================"
echo "Analytics Dashboard Test Suite"
echo "========================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create test results directory
RESULTS_DIR="test-results"
mkdir -p "$RESULTS_DIR"

# Timestamp for the test run
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
REPORT_FILE="$RESULTS_DIR/test-report-$TIMESTAMP.txt"

echo "Test execution started at: $(date)" | tee "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Function to print section headers
print_header() {
    echo "" | tee -a "$REPORT_FILE"
    echo "========================================" | tee -a "$REPORT_FILE"
    echo -e "${BLUE}$1${NC}" | tee -a "$REPORT_FILE"
    echo "========================================" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
}

# Function to check if test passed
check_test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2 PASSED${NC}" | tee -a "$REPORT_FILE"
        return 0
    else
        echo -e "${RED}✗ $2 FAILED${NC}" | tee -a "$REPORT_FILE"
        return 1
    fi
}

# Initialize counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Step 1: Run API Endpoint Validation Tests
print_header "Step 1: API Endpoint Validation Tests"
echo "Running API tests..." | tee -a "$REPORT_FILE"
npm run test:api > "$RESULTS_DIR/api-tests-$TIMESTAMP.log" 2>&1
API_RESULT=$?
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if check_test_result $API_RESULT "API Endpoint Tests"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo "See detailed logs in: $RESULTS_DIR/api-tests-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
fi

# Step 2: Run Performance Benchmark Tests
print_header "Step 2: Performance Benchmark Tests"
echo "Running performance tests..." | tee -a "$REPORT_FILE"
echo -e "${YELLOW}Note: Performance tests may take several minutes${NC}" | tee -a "$REPORT_FILE"
npm run test:performance > "$RESULTS_DIR/performance-tests-$TIMESTAMP.log" 2>&1
PERF_RESULT=$?
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if check_test_result $PERF_RESULT "Performance Benchmark Tests"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo "See detailed logs in: $RESULTS_DIR/performance-tests-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
fi

# Step 3: Generate Coverage Report
print_header "Step 3: Generating Test Coverage Report"
echo "Generating code coverage report..." | tee -a "$REPORT_FILE"
npm run test:coverage > "$RESULTS_DIR/coverage-$TIMESTAMP.log" 2>&1
COVERAGE_RESULT=$?
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if check_test_result $COVERAGE_RESULT "Coverage Report Generation"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo "Coverage report available in: coverage/index.html" | tee -a "$REPORT_FILE"
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo "See detailed logs in: $RESULTS_DIR/coverage-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
fi

# Final Summary
print_header "Test Execution Summary"
echo "Test execution completed at: $(date)" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"
echo "Results:" | tee -a "$REPORT_FILE"
echo "--------" | tee -a "$REPORT_FILE"
echo "Total Test Suites: $TOTAL_TESTS" | tee -a "$REPORT_FILE"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}" | tee -a "$REPORT_FILE"
echo -e "${RED}Failed: $FAILED_TESTS${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "Success Rate: $SUCCESS_RATE%" | tee -a "$REPORT_FILE"
fi

echo "" | tee -a "$REPORT_FILE"
echo "Detailed Reports:" | tee -a "$REPORT_FILE"
echo "----------------" | tee -a "$REPORT_FILE"
echo "API Tests: $RESULTS_DIR/api-tests-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
echo "Performance Tests: $RESULTS_DIR/performance-tests-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
echo "Coverage Report: $RESULTS_DIR/coverage-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
echo "Summary Report: $REPORT_FILE" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Display test artifacts
if [ -f "coverage/lcov.info" ]; then
    echo "Code Coverage Summary:" | tee -a "$REPORT_FILE"
    echo "---------------------" | tee -a "$REPORT_FILE"
    # Extract coverage summary (last few lines typically contain the summary)
    tail -20 "$RESULTS_DIR/coverage-$TIMESTAMP.log" | grep -E "Statements|Branches|Functions|Lines" | tee -a "$REPORT_FILE"
fi

echo "" | tee -a "$REPORT_FILE"
echo "========================================"
echo -e "${BLUE}Test suite execution complete!${NC}"
echo "========================================"

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    exit 0
else
    exit 1
fi
