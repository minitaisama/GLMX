#!/bin/bash

# Packaged Smoke Test Script for GLMX
# Tests: app bundle exists → can launch → logs/data paths become available

set -u

echo "========================================="
echo "GLMX Packaged Smoke Test Script"
echo "========================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

APP_NAME="GLMX"
APP_PATH="/Applications/${APP_NAME}.app"
APP_BIN="${APP_PATH}/Contents/MacOS/${APP_NAME}"
ASAR_PATH="${APP_PATH}/Contents/Resources/app.asar"
DATA_DIR="$HOME/Library/Application Support/glmx"
LOG_DIR_CANDIDATES=(
  "$HOME/Library/Logs/GLMX"
  "$HOME/Library/Logs/glmx"
  "$HOME/Library/Application Support/glmx/logs"
)

run_test() {
  local test_name="$1"
  local test_command="$2"
  echo -n "Testing: ${test_name}... "
  if eval "$test_command"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
  fi
}

resolve_log_dir() {
  for dir in "${LOG_DIR_CANDIDATES[@]}"; do
    if [ -d "$dir" ]; then
      echo "$dir"
      return 0
    fi
  done
  # Fallback to first candidate when none exists yet.
  echo "${LOG_DIR_CANDIDATES[0]}"
}

echo ""
echo "1. Checking packaged app artifacts..."
run_test "App bundle exists" "test -d \"$APP_PATH\""
run_test "App binary exists" "test -x \"$APP_BIN\""
run_test "asar exists" "test -f \"$ASAR_PATH\""

echo ""
echo "2. Launching packaged app..."
"$APP_BIN" >/tmp/glmx-smoke.out 2>/tmp/glmx-smoke.err &
APP_PID=$!
sleep 6

run_test "Process started" "ps -p $APP_PID >/dev/null 2>&1"

echo ""
echo "3. Checking runtime outputs..."
LOG_DIR="$(resolve_log_dir)"
run_test "Data directory exists" "test -d \"$DATA_DIR\""
run_test "Logs directory exists" "test -d \"$LOG_DIR\""

if [ -d "$LOG_DIR" ]; then
  run_test "Main log exists or was created" "ls \"$LOG_DIR\" | grep -Eiq 'main\\.log|renderer\\.log|model\\.log|quality\\.log'"
fi

echo ""
echo "4. Stopping launched app process..."
if ps -p $APP_PID >/dev/null 2>&1; then
  kill $APP_PID >/dev/null 2>&1 || true
fi

echo ""
echo "========================================="
echo "Packaged Smoke Test Summary"
echo "========================================="
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Packaged smoke tests failed. Inspect /tmp/glmx-smoke.err and app logs.${NC}"
  exit 1
fi

echo -e "${GREEN}All packaged smoke tests passed!${NC}"
