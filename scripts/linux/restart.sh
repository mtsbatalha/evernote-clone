#!/bin/bash

# ==============================================================================
# Evernote Clone - Restart Script
# Restarts all application services
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "========================================"
echo "  Evernote Clone - Restarting Services"
echo "========================================"
echo ""

# Stop services
"$SCRIPT_DIR/stop.sh" "$@"

# Small delay
sleep 2

# Start services
"$SCRIPT_DIR/start.sh"
