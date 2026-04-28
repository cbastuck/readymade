#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

declare -a TEST_NAMES=()
declare -a TEST_RESULTS=()
FAILED_COUNT=0

run_step() {
  local name="$1"
  local directory="$2"
  shift 2

  echo
  echo "Running ${name}"
  echo "----------------------------------------"

  if (cd "${REPO_ROOT}/${directory}" && "$@"); then
    echo "PASS: ${name}"
    TEST_NAMES+=("${name}")
    TEST_RESULTS+=("PASS")
  else
    echo "FAIL: ${name}"
    TEST_NAMES+=("${name}")
    TEST_RESULTS+=("FAIL")
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
}

echo "Running all project test suites"
echo "Repository: ${REPO_ROOT}"

echo
echo "Preparing Node dependencies"
(cd "${REPO_ROOT}/hkp-node" && npm install)

echo
echo "Preparing frontend dependencies"
(cd "${REPO_ROOT}/hkp-frontend" && npm install)

run_step "hkp-python" "hkp-python" ./run_tests.sh
run_step "hkp-node" "hkp-node" npm test
run_step "hkp-rt" "hkp-rt" ./run-tests.sh
run_step "hkp-frontend demo boards" "hkp-frontend" npm run test -- src/runtime/browser/tests/demo-boards.regression.test.tsx
run_step "hkp-frontend" "hkp-frontend" npm run test -- --exclude src/runtime/browser/tests/demo-boards.regression.test.tsx

echo
echo "========================================"
echo "Test summary"
echo "========================================"

for i in "${!TEST_NAMES[@]}"; do
  echo "${TEST_RESULTS[$i]}: ${TEST_NAMES[$i]}"
done

TOTAL=${#TEST_NAMES[@]}
PASSED=$((TOTAL - FAILED_COUNT))

echo
echo "Total: ${TOTAL} | Passed: ${PASSED} | Failed: ${FAILED_COUNT}"

if [[ ${FAILED_COUNT} -eq 0 ]]; then
  echo "All test suites passed."
  exit 0
fi

echo "One or more test suites failed."
exit 1
