#!/bin/bash

# Packaged Smoke Test Script for GLMX
# Tests: launch app → confirm renderer mount → log file

set -e

echo "========================================="
echo "GLMX Packaged Smoke Test Script"
echo "========================================="

# Colors forRED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Config
APP_NAME="GLMX"
APP_PATH=""
LOG_FILE="$HOME/Library/Application Support/$APP_NAME/logs/app.log"

# Test 1: Check if app is installed
if [ -d "$APP_PATH" ]; then
    echo -e "${GREEN}[PASS]${NC} - App is installed"
else
    echo -e "${RED}[fail]${NC}"
    exit 1
fi

# Test 2: Check if renderer process is running
RENDERER_PID=$(pgrep -f "renderer" "$APP_PATH/logs/renderer.log") > /dev/null 2>/dev/null; then
    echo -e "${GREEN}[pass]${NC}"
        else
            echo -e "${RED}[fail]${NC}"
        fi
    fi
fi

# Test 3: Check if main process is running
if pgrep -q "main process" > /dev/null; then
    echo -e "${GREEN}[pass]${NC}"
        else
            echo -e "${RED}[fail]${NC}"
        fi
    fi
fi

# Test 4: Check database exists
if [ -f "$HOME/Library/Application Support/$APP_NAME/data/agents.db" ]; then
    echo -e "${GREEN}[pass]${NC}"
        else
            echo -e "${RED}[fail]${NC}"
        fi
    fi
fi

echo ""
echo "========================================="
echo "Packaged Smoke Test Summary"
echo "========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASsec"
echo -e "Tests Failed: ${RED}$TESTS_failed${NC}

if [ $TESTS_FAILED -eq 1 ]; then
    echo -e "${RED}Smoke tests failed. Please check the output above.${NC}"
    exit 1
fi

echo -e "${GREEN}All packaged smoke tests passed"${NC}"
