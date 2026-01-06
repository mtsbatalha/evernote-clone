#!/bin/bash

# ==============================================================================
# Evernote Clone - Stop Script
# Stops all application services
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo ""
echo "========================================"
echo "  Evernote Clone - Stopping Services"
echo "========================================"
echo ""

FORCE_STOP=false
STOP_DOCKER=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE_STOP=true
            shift
            ;;
        -d|--docker)
            STOP_DOCKER=true
            shift
            ;;
        -a|--all)
            STOP_DOCKER=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# ==============================================================================
# Stop API Server
# ==============================================================================

if is_process_running "$API_PID_FILE"; then
    API_PID=$(get_process_pid "$API_PID_FILE")
    log_info "Stopping API server (PID: $API_PID)..."
    
    if [ "$FORCE_STOP" = true ]; then
        kill -9 "$API_PID" 2>/dev/null
    else
        kill "$API_PID" 2>/dev/null
        
        # Wait for graceful shutdown
        for i in {1..10}; do
            if ! ps -p "$API_PID" > /dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if ps -p "$API_PID" > /dev/null 2>&1; then
            log_warning "Graceful shutdown failed, forcing..."
            kill -9 "$API_PID" 2>/dev/null
        fi
    fi
    
    rm -f "$API_PID_FILE"
    log_success "API server stopped"
else
    log_info "API server is not running"
fi

# ==============================================================================
# Stop Web Server
# ==============================================================================

if is_process_running "$WEB_PID_FILE"; then
    WEB_PID=$(get_process_pid "$WEB_PID_FILE")
    log_info "Stopping Web server (PID: $WEB_PID)..."
    
    if [ "$FORCE_STOP" = true ]; then
        kill -9 "$WEB_PID" 2>/dev/null
    else
        kill "$WEB_PID" 2>/dev/null
        
        # Wait for graceful shutdown
        for i in {1..10}; do
            if ! ps -p "$WEB_PID" > /dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if ps -p "$WEB_PID" > /dev/null 2>&1; then
            log_warning "Graceful shutdown failed, forcing..."
            kill -9 "$WEB_PID" 2>/dev/null
        fi
    fi
    
    rm -f "$WEB_PID_FILE"
    log_success "Web server stopped"
else
    log_info "Web server is not running"
fi

# ==============================================================================
# Stop Docker Services (optional)
# ==============================================================================

if [ "$STOP_DOCKER" = true ]; then
    log_info "Stopping Docker services..."
    
    DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yml"
    
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        cd "$PROJECT_ROOT/docker"
        
        if docker compose version &>/dev/null 2>&1; then
            docker compose down
        else
            docker-compose down
        fi

        # Ensure cleanup of containers by name (handle old project name)
        CONTAINERS=("evernote-postgres" "evernote-redis" "evernote-minio" "evernote-meilisearch" "evernote-minio-setup")
        for container in "${CONTAINERS[@]}"; do
            if docker ps -aq -f name="^/${container}$" | grep -q .; then
                log_info "Force removing container $container..."
                docker stop "$container" >/dev/null 2>&1
                docker rm "$container" >/dev/null 2>&1
            fi
        done
        
        log_success "Docker services stopped"
    fi
fi

# ==============================================================================
# Clean up
# ==============================================================================

rm -f "$RUNTIME_CONFIG"

echo ""
echo "========================================"
echo "  Services Stopped"
echo "========================================"
echo ""

if [ "$STOP_DOCKER" = false ]; then
    log_info "Docker services are still running"
    log_info "Use './stop.sh --docker' to stop them too"
fi

echo ""
