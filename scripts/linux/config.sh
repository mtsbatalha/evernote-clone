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
API_PORT_RANGE=(4000)
WEB_PORT_RANGE=(3000)
WS_PORT_RANGE=(1234)

# Docker service ports (shouldn't conflict usually)
MYSQL_PORT=3306
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

# Check if a command exists
check_command() {
    local cmd=$1
    if ! command -v "$cmd" &> /dev/null; then
        log_error "Command not found: $cmd"
        return 1
    fi
    return 0
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
        if ps -p "$pid" > /dev/null; then
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

# Check if a service is remote based on its environment variable
# Returns 0 if remote, 1 if local
check_is_remote() {
    local var_name=$1
    local env_file=$2
    
    if [ ! -f "$env_file" ]; then return 1; fi
    
    # Get the line, excluding comments
    local line=$(grep "^$var_name=" "$env_file" | head -n 1)
    if [ -z "$line" ]; then return 1; fi
    
    # Local patterns (matches hostnames: //host or @host)
    local local_patterns="(@|//)(localhost|127\\.0\\.0\\.1|mysql|mariadb|postgres|postgresql|redis|minio|meilisearch)(:|/|$)"
    
    if echo "$line" | grep -qE "$local_patterns"; then
        return 1 # Local
    fi
    
    return 0 # Remote
}

# Get docker scale arguments based on remote services detection
get_docker_scale_args() {
    local env_file=$1
    local scale_args=""
    
    if [ ! -f "$env_file" ]; then echo ""; return; fi
    
    if check_is_remote "DATABASE_URL" "$env_file"; then
        scale_args="$scale_args --scale mysql=0"
    fi
    
    if check_is_remote "REDIS_URL" "$env_file"; then
        scale_args="$scale_args --scale redis=0"
    fi
    
    if check_is_remote "S3_ENDPOINT" "$env_file"; then
        scale_args="$scale_args --scale minio=0 --scale minio-setup=0"
    fi
    
    if check_is_remote "MEILISEARCH_HOST" "$env_file"; then
        scale_args="$scale_args --scale meilisearch=0"
    fi
    
    echo "$scale_args"
}

# Get list of services to start based on local/remote detection
get_docker_services() {
    local env_file=$1
    local services=""
    
    if [ ! -f "$env_file" ]; then 
        echo "mysql redis minio minio-setup meilisearch"
        return
    fi
    
    if ! check_is_remote "DATABASE_URL" "$env_file"; then
        services="$services mysql"
    fi
    
    if ! check_is_remote "REDIS_URL" "$env_file"; then
        services="$services redis"
    fi
    
    if ! check_is_remote "S3_ENDPOINT" "$env_file"; then
        services="$services minio minio-setup"
    fi
    
    if ! check_is_remote "MEILISEARCH_HOST" "$env_file"; then
        services="$services meilisearch"
    fi
    
    echo "$services"
}

# Try to detect LAN IP address (priority: valid non-local IPv4)
get_lan_ip() {
    # Try hostname -I first (common on Linux)
    if command -v hostname &> /dev/null; then
        local ips=$(hostname -I 2>/dev/null)
        for ip in $ips; do
            # Filter for likely LAN IPs (192.168, 10., 172.16-31)
            if [[ "$ip" =~ ^192\.168\. ]] || [[ "$ip" =~ ^10\. ]] || [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]; then
                echo "$ip"
                return 0
            fi
        done
        # Fallback to first non-loopback if no specific LAN range found
        if [ -n "$ips" ]; then 
            echo "$ips" | awk '{print $1}'
            return 0
        fi
    fi
    
    return 1
}

# Export common variables
export PROJECT_ROOT
export PID_DIR
export LOG_DIR
export SCRIPT_DIR
export COMPOSE_PROJECT_NAME="evernote-clone"
