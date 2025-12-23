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

# ==============================================================================
# Check Docker Services
# ==============================================================================

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
    
    if [ "$RUNNING" -lt 4 ]; then
        log_warning "Docker services not fully running. Starting..."
        if docker compose version &>/dev/null 2>&1; then
            docker compose up -d
        else
            docker-compose up -d
        fi
        log_info "Waiting for services to be ready..."
        sleep 5
    else
        log_success "Docker services are running"
    fi
fi

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
    log_warning "Use ./stop.sh first or ./restart.sh"
    exit 1
fi

if is_process_running "$WEB_PID_FILE"; then
    log_warning "Web is already running (PID: $(get_process_pid $WEB_PID_FILE))"
    log_warning "Use ./stop.sh first or ./restart.sh"
    exit 1
fi

# ==============================================================================
# Start API Server
# ==============================================================================

log_info "Starting API server on port $API_PORT..."

cd "$PROJECT_ROOT/apps/api"

# Export environment variables
export PORT=$API_PORT
export WS_PORT=$WS_PORT
export NEXT_PUBLIC_API_URL="http://localhost:$API_PORT/api"

# Start API in background
nohup node dist/main.js > "$API_LOG_FILE" 2>&1 &
API_PID=$!
echo $API_PID > "$API_PID_FILE"

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
export NEXT_PUBLIC_API_URL="http://localhost:$API_PORT/api"

# Start Web in background
nohup npx next start -p $WEB_PORT > "$WEB_LOG_FILE" 2>&1 &
WEB_PID=$!
echo $WEB_PID > "$WEB_PID_FILE"

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
echo "  Web App:      http://localhost:$WEB_PORT"
echo "  API:          http://localhost:$API_PORT"
echo "  API Docs:     http://localhost:$API_PORT/api/docs"
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
