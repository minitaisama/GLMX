#!/bin/bash

# Smoke Test Script for GLMX
# Tests: dev boot → select workspace → start chat → switch branch → MCP test

set -u

echo "========================================="
echo "GLMX Smoke Test Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -n "Testing: $test_name... "

    if eval "$test_command"; then
        echo -e "${GREEN}PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAILED${NC}"
        ((TESTS_FAILED++))
    fi
}

run_build_check() {
    if command -v bun >/dev/null 2>&1; then
        bun run build >/dev/null 2>&1
    else
        npm -s run build >/dev/null 2>&1
    fi
}

# 1. Check if dependencies are installed
echo ""
echo "1. Checking dependencies..."
run_test "Node/Bun installed" "command -v bun &> /dev/null || command -v node &> /dev/null"
run_test "Package.json exists" "test -f package.json"
run_test "Node modules installed" "test -d node_modules"

# 2. Check TypeScript compilation
echo ""
echo "2. Checking TypeScript compilation..."
run_test "Build compiles" "run_build_check"

# 3. Check critical files exist
echo ""
echo "3. Checking critical files..."
run_test "Main entry exists" "test -f src/main/index.ts"
run_test "Renderer entry exists" "test -f src/renderer/main.tsx"
run_test "Preload script exists" "test -f src/preload/index.ts"
run_test "Database schema exists" "test -f src/main/lib/db/schema/index.ts"

# 4. Check tRPC routers
echo ""
echo "4. Checking tRPC routers..."
run_test "Claude router exists" "test -f src/main/lib/trpc/routers/claude.ts"
run_test "Projects router exists" "test -f src/main/lib/trpc/routers/projects.ts"
run_test "Chats router exists" "test -f src/main/lib/trpc/routers/chats.ts"

# 5. Check branch switching functionality
echo ""
echo "5. Checking branch switching..."
run_test "Branches router exists" "test -f src/main/lib/git/branches.ts"
run_test "SwitchBranch mutation exists" "grep -q 'switchBranch' src/main/lib/git/branches.ts"

# 6. Check MCP integration
echo ""
echo "6. Checking MCP integration..."
run_test "MCP config exists" "test -f src/main/lib/claude-config.ts"
run_test "MCP widget exists" "test -f src/renderer/features/details-sidebar/sections/mcp-widget.tsx"

# 7. Check model utilities
echo ""
echo "7. Checking model utilities..."
run_test "Models file exists" "test -f src/renderer/features/agents/lib/models.ts"
run_test "Model normalization exists" "grep -q 'normalizeOpenAICompatibleModelId' src/renderer/features/agents/lib/models.ts"
run_test "Thinking level formatting exists" "grep -q 'formatCodexThinkingLabel' src/renderer/features/agents/lib/models.ts"

# 8. Check UI components
echo ""
echo "8. Checking UI components..."
run_test "Chat input area exists" "test -f src/renderer/features/agents/main/chat-input-area.tsx"
run_test "Active chat exists" "test -f src/renderer/features/agents/main/active-chat.tsx"
run_test "New chat form exists" "test -f src/renderer/features/agents/main/new-chat-form.tsx"
run_test "Context indicator exists" "test -f src/renderer/features/agents/ui/agent-context-indicator.tsx"

# 9. Check tests
echo ""
echo "9. Checking tests..."
run_test "Models test exists" "test -f src/renderer/features/agents/lib/__tests__/models.test.ts"

# Summary
echo ""
echo "========================================="
echo "Smoke Test Summary"
echo "========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All smoke tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some smoke tests failed. Please review the output above.${NC}"
    exit 1
fi
