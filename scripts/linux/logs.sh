#!/bin/bash

# ==============================================================================
# Evernote Clone - Logs Script
# View and tail application logs
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Default options
SERVICE="all"
LINES=50
FOLLOW=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--service)
            SERVICE="$2"
            shift 2
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        api|web|docker|all)
            SERVICE="$1"
            shift
            ;;
        -h|--help)
            echo ""
            echo "Usage: logs.sh [OPTIONS] [SERVICE]"
            echo ""
            echo "Services:"
            echo "  api      - API server logs"
            echo "  web      - Web server logs"
            echo "  docker   - Docker services logs"
            echo "  all      - All logs (default)"
            echo ""
            echo "Options:"
            echo "  -s, --service  Service to show logs for"
            echo "  -n, --lines    Number of lines to show (default: 50)"
            echo "  -f, --follow   Follow log output (tail -f)"
            echo "  -h, --help     Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./logs.sh api              # Show API logs"
            echo "  ./logs.sh -f web           # Follow Web logs"
            echo "  ./logs.sh -n 100 all       # Show last 100 lines of all logs"
            echo ""
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

show_log() {
    local name=$1
    local file=$2
    
    if [ -f "$file" ]; then
        echo ""
        echo "========================================"
        echo "  $name Logs"
        echo "========================================"
        echo ""
        
        if [ "$FOLLOW" = true ]; then
            tail -f -n "$LINES" "$file"
        else
            tail -n "$LINES" "$file"
        fi
    else
        log_warning "$name log file not found: $file"
    fi
}

show_docker_logs() {
    echo ""
    echo "========================================"
    echo "  Docker Services Logs"
    echo "========================================"
    echo ""
    
    cd "$PROJECT_ROOT/docker"
    
    if docker compose version &>/dev/null 2>&1; then
        if [ "$FOLLOW" = true ]; then
            docker compose logs -f --tail="$LINES"
        else
            docker compose logs --tail="$LINES"
        fi
    else
        if [ "$FOLLOW" = true ]; then
            docker-compose logs -f --tail="$LINES"
        else
            docker-compose logs --tail="$LINES"
        fi
    fi
}

case "$SERVICE" in
    api)
        show_log "API" "$API_LOG_FILE"
        ;;
    web)
        show_log "Web" "$WEB_LOG_FILE"
        ;;
    docker)
        show_docker_logs
        ;;
    all)
        if [ "$FOLLOW" = false ]; then
            show_log "API" "$API_LOG_FILE"
            show_log "Web" "$WEB_LOG_FILE"
            echo ""
            echo "For Docker logs, run: ./logs.sh docker"
            echo "For live logs, use: ./logs.sh -f <service>"
        else
            # For follow mode, we need to pick one
            echo "Cannot follow all logs at once. Choose a service:"
            echo "  ./logs.sh -f api"
            echo "  ./logs.sh -f web"
            echo "  ./logs.sh -f docker"
        fi
        ;;
    *)
        log_error "Unknown service: $SERVICE"
        echo "Use: api, web, docker, or all"
        exit 1
        ;;
esac
