#!/bin/bash

# Comprehensive QA Test Suite for Smart Recommendation Engine
# Runs all unit, integration, API, and validation tests with reporting

echo "========================================"
echo "Smart Recommendation Engine - QA Suite"
echo "========================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create results directory
RESULTS_DIR="qa-results"
mkdir -p "$RESULTS_DIR"

# Timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
REPORT_FILE="$RESULTS_DIR/qa-report-$TIMESTAMP.txt"

echo "QA Test Execution Started: $(date)" | tee "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Counters
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

# Function to print headers
print_header() {
    echo "" | tee -a "$REPORT_FILE"
    echo "========================================" | tee -a "$REPORT_FILE"
    echo -e "${BLUE}$1${NC}" | tee -a "$REPORT_FILE"
    echo "========================================" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
}

# Function to check test result
check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2 PASSED${NC}" | tee -a "$REPORT_FILE"
        return 0
    else
        echo -e "${RED}❌ $2 FAILED${NC}" | tee -a "$REPORT_FILE"
        return 1
    fi
}

# 1. Unit Tests - TF-IDF Service
print_header "Phase 1: Unit Tests - TF-IDF Service"
echo "Testing text preprocessing, vectorization, and similarity..." | tee -a "$REPORT_FILE"
npm test -- tests/unit/TFIDFService.test.ts > "$RESULTS_DIR/unit-tfidf-$TIMESTAMP.log" 2>&1
UNIT_RESULT=$?
TOTAL_SUITES=$((TOTAL_SUITES + 1))

if check_result $UNIT_RESULT "Unit Tests (TF-IDF)"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    echo "See details: $RESULTS_DIR/unit-tfidf-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
fi

# 2. Integration Tests - Full Pipeline
print_header "Phase 2: Integration Tests - Recommendation Pipeline"
echo "Testing end-to-end recommendation flow..." | tee -a "$REPORT_FILE"
echo -e "${YELLOW}Note: This may take 2-3 minutes${NC}" | tee -a "$REPORT_FILE"
npm test -- tests/integration/recommendation-pipeline.test.ts --runInBand > "$RESULTS_DIR/integration-$TIMESTAMP.log" 2>&1
INTEGRATION_RESULT=$?
TOTAL_SUITES=$((TOTAL_SUITES + 1))

if check_result $INTEGRATION_RESULT "Integration Tests (Pipeline)"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    echo "See details: $RESULTS_DIR/integration-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
fi

# 3. API Tests - Endpoints
print_header "Phase 3: API Tests - All Endpoints"
echo "Testing REST API endpoints..." | tee -a "$REPORT_FILE"
npm run test:recommendations > "$RESULTS_DIR/api-$TIMESTAMP.log" 2>&1
API_RESULT=$?
TOTAL_SUITES=$((TOTAL_SUITES + 1))

if check_result $API_RESULT "API Tests (Endpoints)"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    echo "See details: $RESULTS_DIR/api-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
fi

# 4. Model Validation Tests
print_header "Phase 4: Model Quality Validation"
echo "Validating ML model accuracy and quality..." | tee -a "$REPORT_FILE"
echo -e "${YELLOW}Note: This may take 2-3 minutes${NC}" | tee -a "$REPORT_FILE"
npm test -- tests/validation/model-quality.test.ts --runInBand > "$RESULTS_DIR/validation-$TIMESTAMP.log" 2>&1
VALIDATION_RESULT=$?
TOTAL_SUITES=$((TOTAL_SUITES + 1))

if check_result $VALIDATION_RESULT "Model Validation Tests"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    echo "See details: $RESULTS_DIR/validation-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
fi

# 5. Generate Coverage Report
print_header "Phase 5: Code Coverage Analysis"
echo "Generating code coverage report..." | tee -a "$REPORT_FILE"
npm run test:coverage > "$RESULTS_DIR/coverage-$TIMESTAMP.log" 2>&1
COVERAGE_RESULT=$?
TOTAL_SUITES=$((TOTAL_SUITES + 1))

if check_result $COVERAGE_RESULT "Coverage Report"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
    echo "Coverage report available at: coverage/index.html" | tee -a "$REPORT_FILE"
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    echo "See details: $RESULTS_DIR/coverage-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
fi

# Final Summary
print_header "QA Test Suite Summary"
echo "Test execution completed: $(date)" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "╔════════════════════════════════════════╗" | tee -a "$REPORT_FILE"
echo "║         TEST RESULTS SUMMARY           ║" | tee -a "$REPORT_FILE"
echo "╠════════════════════════════════════════╣" | tee -a "$REPORT_FILE"
echo "║ Total Test Suites:  $TOTAL_SUITES                   ║" | tee -a "$REPORT_FILE"
echo -e "║ ${GREEN}Passed:${NC}            $PASSED_SUITES                   ║" | tee -a "$REPORT_FILE"
echo -e "║ ${RED}Failed:${NC}            $FAILED_SUITES                   ║" | tee -a "$REPORT_FILE"
echo "╚════════════════════════════════════════╝" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"

# Calculate success rate
if [ $TOTAL_SUITES -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_SUITES * 100 / TOTAL_SUITES))
    echo "Success Rate: $SUCCESS_RATE%" | tee -a "$REPORT_FILE"

    if [ $SUCCESS_RATE -eq 100 ]; then
        echo -e "${GREEN}✅ ALL TESTS PASSED - PRODUCTION READY${NC}" | tee -a "$REPORT_FILE"
    elif [ $SUCCESS_RATE -ge 80 ]; then
        echo -e "${YELLOW}⚠️  MOSTLY PASSED - REVIEW FAILURES${NC}" | tee -a "$REPORT_FILE"
    else
        echo -e "${RED}❌ TESTS FAILED - DO NOT DEPLOY${NC}" | tee -a "$REPORT_FILE"
    fi
fi

echo "" | tee -a "$REPORT_FILE"

# Detailed Reports
echo "Detailed Test Reports:" | tee -a "$REPORT_FILE"
echo "---------------------" | tee -a "$REPORT_FILE"
echo "Unit Tests:       $RESULTS_DIR/unit-tfidf-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
echo "Integration:      $RESULTS_DIR/integration-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
echo "API Tests:        $RESULTS_DIR/api-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
echo "Validation:       $RESULTS_DIR/validation-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
echo "Coverage:         $RESULTS_DIR/coverage-$TIMESTAMP.log" | tee -a "$REPORT_FILE"
echo "Summary:          $REPORT_FILE" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Extract coverage summary
if [ -f "coverage/coverage-summary.json" ]; then
    echo "Coverage Summary:" | tee -a "$REPORT_FILE"
    echo "-----------------" | tee -a "$REPORT_FILE"
    # Parse JSON and display (requires jq)
    if command -v jq &> /dev/null; then
        jq -r '.total | "Statements: \(.statements.pct)%\nBranches: \(.branches.pct)%\nFunctions: \(.functions.pct)%\nLines: \(.lines.pct)%"' coverage/coverage-summary.json | tee -a "$REPORT_FILE"
    else
        echo "Install 'jq' to see coverage summary" | tee -a "$REPORT_FILE"
    fi
    echo "" | tee -a "$REPORT_FILE"
fi

# Performance Metrics (if available)
if [ -f "$RESULTS_DIR/api-$TIMESTAMP.log" ]; then
    echo "Performance Highlights:" | tee -a "$REPORT_FILE"
    echo "----------------------" | tee -a "$REPORT_FILE"

    # Extract performance data from logs
    grep -E "(within|faster than|completed in)" "$RESULTS_DIR/api-$TIMESTAMP.log" | head -5 | tee -a "$REPORT_FILE" || echo "No performance data available" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
fi

# Database Health Check
echo "Database Health Check:" | tee -a "$REPORT_FILE"
echo "---------------------" | tee -a "$REPORT_FILE"
psql -h localhost -U harikrishna -d ogon_db -c "SELECT 'Vectors: ' || COUNT(*) FROM media_vectors;" 2>&1 | grep -v "psql:" | tee -a "$REPORT_FILE"
psql -h localhost -U harikrishna -d ogon_db -c "SELECT 'Interactions: ' || COUNT(*) FROM user_interactions;" 2>&1 | grep -v "psql:" | tee -a "$REPORT_FILE"
psql -h localhost -U harikrishna -d ogon_db -c "SELECT 'Cache Entries: ' || COUNT(*) FROM recommendation_cache WHERE expires_at > CURRENT_TIMESTAMP;" 2>&1 | grep -v "psql:" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Recommendations
if [ $FAILED_SUITES -gt 0 ]; then
    echo "❗ Next Steps:" | tee -a "$REPORT_FILE"
    echo "1. Review failed test logs in $RESULTS_DIR/" | tee -a "$REPORT_FILE"
    echo "2. Fix failing tests before deployment" | tee -a "$REPORT_FILE"
    echo "3. Re-run: ./run-qa-suite.sh" | tee -a "$REPORT_FILE"
else
    echo "✅ Next Steps:" | tee -a "$REPORT_FILE"
    echo "1. Review full QA report: QA_REPORT.md" | tee -a "$REPORT_FILE"
    echo "2. Enable rate limiting in production" | tee -a "$REPORT_FILE"
    echo "3. Set up monitoring & alerts" | tee -a "$REPORT_FILE"
    echo "4. Schedule nightly reindexing (cron)" | tee -a "$REPORT_FILE"
    echo "5. Deploy to production 🚀" | tee -a "$REPORT_FILE"
fi

echo "" | tee -a "$REPORT_FILE"
echo "========================================" | tee -a "$REPORT_FILE"
echo "QA Suite execution complete!" | tee -a "$REPORT_FILE"
echo "========================================" | tee -a "$REPORT_FILE"

# Exit with appropriate code
if [ $FAILED_SUITES -eq 0 ]; then
    exit 0
else
    exit 1
fi
