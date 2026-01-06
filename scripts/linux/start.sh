#!/bin/bash

# ==============================================================================
# Evernote Clone - Start Script
# Starts all application services with port fallback
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo ""
echo "========================================"
echo "  Evernote Clone - Starting Services"
echo "========================================"
echo ""

ensure_directories

# Check dependencies
if ! check_command "pnpm"; then
    log_error "pnpm is not installed or not in PATH."
    log_info "Try running: npm install -g pnpm"
    exit 1
fi

# Ensure log files exist
touch "$API_LOG_FILE" "$WEB_LOG_FILE"
log_info "Logging to:"
log_info "  API: $API_LOG_FILE"
log_info "  Web: $WEB_LOG_FILE"

# ==============================================================================
# Check if using remote services
# ==============================================================================

USE_REMOTE_SERVICES=false

if [ -f "$PROJECT_ROOT/.env" ]; then
    # Check USE_REMOTE_SERVICES flag
    if grep -qE 'USE_REMOTE_SERVICES\s*=\s*"?true"?' "$PROJECT_ROOT/.env"; then
        USE_REMOTE_SERVICES=true
        log_info "USE_REMOTE_SERVICES=true detected - skipping all Docker containers"
    fi
fi

# ==============================================================================
# Check Docker Services
# ==============================================================================

if [ "$USE_REMOTE_SERVICES" = false ]; then
    log_info "Checking Docker services..."

    DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yml"

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        cd "$PROJECT_ROOT/docker"
        
        # Check if containers are running
        if docker compose version &>/dev/null 2>&1; then
            RUNNING=$(docker compose ps --status running -q 2>/dev/null | wc -l)
        else
            RUNNING=$(docker-compose ps -q 2>/dev/null | wc -l)
        fi
        
        # Get list of services to start for hybrid setup
        SERVICES_TO_START=$(get_docker_services "$PROJECT_ROOT/.env")
        
        log_info "Ensuring Docker services are running: $SERVICES_TO_START"
        if docker compose version &>/dev/null 2>&1; then
            docker compose up -d $SERVICES_TO_START
        else
            docker-compose up -d $SERVICES_TO_START
        fi
        
        log_info "Waiting for services to be ready..."
        sleep 5
    fi
else
    log_warning "Skipping Docker containers (using remote services)"
    log_info "Make sure your remote MySQL, Redis, S3, and Meilisearch are accessible!"
fi


# ==============================================================================
# Cleanup Orphan Processes
# ==============================================================================

log_info "Cleaning up orphan processes..."

# Kill any orphan Node.js processes from previous runs
if [ -n "$(pgrep -f 'node.*evernote-clone/apps/api')" ]; then
    pkill -9 -f 'node.*evernote-clone/apps/api' 2>/dev/null || true
    log_warning "Killed orphan API processes"
fi

if [ -n "$(pgrep -f 'node.*evernote-clone/apps/web')" ]; then
    pkill -9 -f 'node.*evernote-clone/apps/web' 2>/dev/null || true
    log_warning "Killed orphan Web processes"
fi

# Clean up stale PID files
rm -f "$API_PID_FILE" "$WEB_PID_FILE" 2>/dev/null || true

# Wait for ports to be released
sleep 1

# ==============================================================================
# Find Available Ports
# ==============================================================================

log_info "Finding available ports..."

# API Port
API_PORT=$(find_available_port API_PORT_RANGE)
if [ -z "$API_PORT" ]; then
    log_error "No available port for API (tried: ${API_PORT_RANGE[*]})"
    exit 1
fi
log_success "API port: $API_PORT"

# Web Port
WEB_PORT=$(find_available_port WEB_PORT_RANGE)
if [ -z "$WEB_PORT" ]; then
    log_error "No available port for Web (tried: ${WEB_PORT_RANGE[*]})"
    exit 1
fi
log_success "Web port: $WEB_PORT"

# WebSocket Port
WS_PORT=$(find_available_port WS_PORT_RANGE)
if [ -z "$WS_PORT" ]; then
    log_error "No available port for WebSocket (tried: ${WS_PORT_RANGE[*]})"
    exit 1
fi
log_success "WebSocket port: $WS_PORT"

# Save runtime configuration
save_runtime_config

# ==============================================================================
# Check if already running
# ==============================================================================

if is_process_running "$API_PID_FILE"; then
    log_warning "API is already running (PID: $(get_process_pid $API_PID_FILE))"
    log_warning "Use ./scripts/linux/stop.sh first or ./scripts/linux/restart.sh"
    exit 1
fi

if is_process_running "$WEB_PID_FILE"; then
    log_warning "Web is already running (PID: $(get_process_pid $WEB_PID_FILE))"
    log_warning "Use ./scripts/linux/stop.sh first or ./scripts/linux/restart.sh"
    exit 1
fi

# ==============================================================================
# Start API Server
# ==============================================================================

log_info "Starting API server on port $API_PORT..."

cd "$PROJECT_ROOT"

# Export environment variables
export PORT=$API_PORT
export WS_PORT=$WS_PORT

# Determine Public URLs
# Priority: 1. Environment Variable, 2. .env file, 3. Auto-detect LAN IP, 4. Localhost

# Helper to read from .env if variable not set
read_env_var() {
    local var_name=$1
    if [ -f "$PROJECT_ROOT/.env" ]; then
        grep "^$var_name=" "$PROJECT_ROOT/.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'"
    fi
}

if [ -z "$API_PUBLIC_URL" ]; then API_PUBLIC_URL=$(read_env_var "API_PUBLIC_URL"); fi
if [ -z "$APP_URL" ]; then APP_URL=$(read_env_var "APP_URL"); fi

# Auto-detect if still empty
if [ -z "$API_PUBLIC_URL" ] || [ -z "$APP_URL" ]; then
    LAN_IP=$(get_lan_ip)
    if [ -n "$LAN_IP" ]; then
        log_info "Auto-detected LAN IP: $LAN_IP"
        if [ -z "$API_PUBLIC_URL" ]; then API_PUBLIC_URL="http://$LAN_IP:$API_PORT"; fi
        if [ -z "$APP_URL" ]; then APP_URL="http://$LAN_IP:$WEB_PORT"; fi
    fi
fi

# Note: Frontend uses hardcoded '/api' which is proxied by Nginx to the API server.
# No NEXT_PUBLIC_API_URL export needed since it's handled at the Nginx/proxy level.
if [ -n "$API_PUBLIC_URL" ]; then
    export API_PUBLIC_URL
    log_info "API accessible at: $API_PUBLIC_URL"
else
    log_info "API accessible at: http://localhost:$API_PORT"
fi

# Export APP_URL for NextAuth if needed (NextAuth usually mimics the request host, but good to be explicit)
if [ -n "$APP_URL" ]; then
    export NEXTAUTH_URL="$APP_URL"
    log_info "Using App URL: $APP_URL"
else
    # Default fallback
    export NEXTAUTH_URL="http://localhost:$WEB_PORT"
fi

# Start API in background using pnpm to resolve node_modules correctly
log_info "Executing pnpm run start for API..."
nohup pnpm --filter @evernote-clone/api run start > "$API_LOG_FILE" 2>&1 &
API_PID=$!
echo $API_PID > "$API_PID_FILE"

# Wait and verify
sleep 2
if ! ps -p "$API_PID" > /dev/null; then
    log_error "API process died immediately!"
    log_error "Check logs below:"
    echo "--- Last 20 lines of $API_LOG_FILE ---"
    tail -n 20 "$API_LOG_FILE"
    echo "--------------------------------------"
    exit 1
fi

# Wait and verify
sleep 2
if is_process_running "$API_PID_FILE"; then
    log_success "API started (PID: $API_PID)"
else
    log_error "API failed to start. Check logs: $API_LOG_FILE"
    exit 1
fi

# ==============================================================================
# Start Web Server
# ==============================================================================

log_info "Starting Web server on port $WEB_PORT..."

cd "$PROJECT_ROOT/apps/web"

# Export environment variables
export PORT=$WEB_PORT

# Start Web in background (listen on all interfaces for Docker/proxy access)
log_info "Executing next start for Web..."
nohup pnpm exec next start -p $WEB_PORT -H 0.0.0.0 > "$WEB_LOG_FILE" 2>&1 &
WEB_PID=$!
echo $WEB_PID > "$WEB_PID_FILE"

# Wait and verify
sleep 3
if ! ps -p "$WEB_PID" > /dev/null; then
    log_error "Web process died immediately!"
    log_error "Check logs below:"
    echo "--- Last 20 lines of $WEB_LOG_FILE ---"
    tail -n 20 "$WEB_LOG_FILE"
    echo "--------------------------------------"
    exit 1
fi

# Wait and verify
sleep 3
if is_process_running "$WEB_PID_FILE"; then
    log_success "Web started (PID: $WEB_PID)"
else
    log_error "Web failed to start. Check logs: $WEB_LOG_FILE"
    exit 1
fi

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "========================================"
echo "  All Services Started!"
echo "========================================"
echo ""
echo "  Web App:      $APP_URL"
echo "  API:          $API_PUBLIC_URL"
echo "  API Docs:     ${API_PUBLIC_URL}/docs"
echo ""
echo "  MinIO:        http://localhost:$MINIO_CONSOLE_PORT"
echo "  Meilisearch:  http://localhost:$MEILISEARCH_PORT"
echo ""
echo "Commands:"
echo "  Status:  ./scripts/linux/status.sh"
echo "  Logs:    ./scripts/linux/logs.sh"
echo "  Stop:    ./scripts/linux/stop.sh"
echo "  Restart: ./scripts/linux/restart.sh"
echo ""
