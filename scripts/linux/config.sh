#!/bin/bash

# ==============================================================================
# Evernote Clone - Configuration
# This file contains all environment variables and configuration
# ==============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Default ports
DEFAULT_API_PORT=4000
DEFAULT_WEB_PORT=3000
DEFAULT_WS_PORT=1234

# Port fallback ranges
API_PORT_RANGE=(4000 4001 4002 4003 4004 4005)
WEB_PORT_RANGE=(3000 3001 3002 3003 3004 3005)
WS_PORT_RANGE=(1234 1235 1236 1237 1238 1239)

# Docker service ports (shouldn't conflict usually)
POSTGRES_PORT=5432
REDIS_PORT=6379
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MEILISEARCH_PORT=7700

# PID file locations
PID_DIR="$PROJECT_ROOT/.pids"
API_PID_FILE="$PID_DIR/api.pid"
WEB_PID_FILE="$PID_DIR/web.pid"

# Log file locations
LOG_DIR="$PROJECT_ROOT/logs"
API_LOG_FILE="$LOG_DIR/api.log"
WEB_LOG_FILE="$LOG_DIR/web.log"

# Runtime configuration file (stores found free ports)
RUNTIME_CONFIG="$PID_DIR/runtime.conf"

# ==============================================================================
# Helper Functions
# ==============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if a port is available
is_port_available() {
    local port=$1
    if command -v ss &> /dev/null; then
        ! ss -tuln | grep -q ":$port "
    elif command -v netstat &> /dev/null; then
        ! netstat -tuln | grep -q ":$port "
    else
        # Fallback using /dev/tcp
        (echo >/dev/tcp/localhost/$port) 2>/dev/null && return 1 || return 0
    fi
}

# Find an available port from a list
find_available_port() {
    local -n ports=$1
    for port in "${ports[@]}"; do
        if is_port_available "$port"; then
            echo "$port"
            return 0
        fi
    done
    return 1
}

# Ensure directories exist
ensure_directories() {
    mkdir -p "$PID_DIR"
    mkdir -p "$LOG_DIR"
}

# Load runtime configuration
load_runtime_config() {
    if [ -f "$RUNTIME_CONFIG" ]; then
        source "$RUNTIME_CONFIG"
    fi
}

# Save runtime configuration
save_runtime_config() {
    cat > "$RUNTIME_CONFIG" << EOF
# Runtime configuration - auto-generated
API_PORT=$API_PORT
WEB_PORT=$WEB_PORT
WS_PORT=$WS_PORT
EOF
}

# Check if process is running
is_process_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Get process PID
get_process_pid() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        cat "$pid_file"
    fi
}

# Export common variables
export PROJECT_ROOT
export PID_DIR
export LOG_DIR
export SCRIPT_DIR
export COMPOSE_PROJECT_NAME="evernote-clone"
