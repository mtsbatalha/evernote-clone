#!/bin/bash

# ==============================================================================
# Evernote Clone - Status Script
# Shows the status of all services
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo ""
echo "========================================"
echo "  Evernote Clone - Service Status"
echo "========================================"
echo ""

load_runtime_config

# ==============================================================================
# Application Services
# ==============================================================================

echo "Application Services:"
echo "---------------------"

# API Status
if is_process_running "$API_PID_FILE"; then
    API_PID=$(get_process_pid "$API_PID_FILE")
    API_PORT_DISPLAY=${API_PORT:-$DEFAULT_API_PORT}
    echo -e "  API:     ${GREEN}● Running${NC} (PID: $API_PID, Port: $API_PORT_DISPLAY)"
else
    echo -e "  API:     ${RED}○ Stopped${NC}"
fi

# Web Status
if is_process_running "$WEB_PID_FILE"; then
    WEB_PID=$(get_process_pid "$WEB_PID_FILE")
    WEB_PORT_DISPLAY=${WEB_PORT:-$DEFAULT_WEB_PORT}
    echo -e "  Web:     ${GREEN}● Running${NC} (PID: $WEB_PID, Port: $WEB_PORT_DISPLAY)"
else
    echo -e "  Web:     ${RED}○ Stopped${NC}"
fi

echo ""

# ==============================================================================
# Docker Services
# ==============================================================================

echo "Docker Services:"
echo "----------------"

DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yml"

if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    cd "$PROJECT_ROOT/docker"
    
    check_docker_service() {
        local service=$1
        local container=$2
        local port=$3
        
        if docker ps --format '{{.Names}}' | grep -q "$container"; then
            echo -e "  $service:${NC}\t${GREEN}● Running${NC} (Port: $port)"
        else
            echo -e "  $service:${NC}\t${RED}○ Stopped${NC}"
        fi
    }
    
    check_docker_service "PostgreSQL" "evernote-postgres" "$POSTGRES_PORT"
    check_docker_service "Redis" "evernote-redis" "$REDIS_PORT"
    check_docker_service "MinIO" "evernote-minio" "$MINIO_PORT/$MINIO_CONSOLE_PORT"
    check_docker_service "Meilisearch" "evernote-meilisearch" "$MEILISEARCH_PORT"
else
    echo -e "  ${YELLOW}Docker compose file not found${NC}"
fi

echo ""

# ==============================================================================
# Health Checks
# ==============================================================================

echo "Health Checks:"
echo "--------------"

# Check API health
if is_process_running "$API_PID_FILE"; then
    API_PORT_CHECK=${API_PORT:-$DEFAULT_API_PORT}
    if curl -s "http://localhost:$API_PORT_CHECK/api/health" > /dev/null 2>&1; then
        echo -e "  API Health:        ${GREEN}● Healthy${NC}"
    else
        echo -e "  API Health:        ${YELLOW}● Unhealthy${NC}"
    fi
else
    echo -e "  API Health:        ${RED}○ N/A${NC}"
fi

# Check Web health
if is_process_running "$WEB_PID_FILE"; then
    WEB_PORT_CHECK=${WEB_PORT:-$DEFAULT_WEB_PORT}
    if curl -s "http://localhost:$WEB_PORT_CHECK" > /dev/null 2>&1; then
        echo -e "  Web Health:        ${GREEN}● Healthy${NC}"
    else
        echo -e "  Web Health:        ${YELLOW}● Unhealthy${NC}"
    fi
else
    echo -e "  Web Health:        ${RED}○ N/A${NC}"
fi

# Check Meilisearch health
if curl -s "http://localhost:$MEILISEARCH_PORT/health" > /dev/null 2>&1; then
    echo -e "  Meilisearch:       ${GREEN}● Healthy${NC}"
else
    echo -e "  Meilisearch:       ${RED}○ Unavailable${NC}"
fi

echo ""

# ==============================================================================
# URLs
# ==============================================================================

if is_process_running "$API_PID_FILE" || is_process_running "$WEB_PID_FILE"; then
    echo "Access URLs:"
    echo "------------"
    
    if is_process_running "$WEB_PID_FILE"; then
        WEB_PORT_URL=${WEB_PORT:-$DEFAULT_WEB_PORT}
        echo "  Web App:     http://localhost:$WEB_PORT_URL"
    fi
    
    if is_process_running "$API_PID_FILE"; then
        API_PORT_URL=${API_PORT:-$DEFAULT_API_PORT}
        echo "  API:         http://localhost:$API_PORT_URL"
        echo "  API Docs:    http://localhost:$API_PORT_URL/api/docs"
    fi
    
    echo "  MinIO:       http://localhost:$MINIO_CONSOLE_PORT"
    echo "  Meilisearch: http://localhost:$MEILISEARCH_PORT"
    echo ""
fi

# ==============================================================================
# Resource Usage
# ==============================================================================

echo "Resource Usage:"
echo "---------------"

if is_process_running "$API_PID_FILE"; then
    API_PID=$(get_process_pid "$API_PID_FILE")
    API_MEM=$(ps -o rss= -p "$API_PID" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
    API_CPU=$(ps -o %cpu= -p "$API_PID" 2>/dev/null | awk '{print $1"%"}')
    echo "  API:  CPU: $API_CPU, Memory: $API_MEM"
fi

if is_process_running "$WEB_PID_FILE"; then
    WEB_PID=$(get_process_pid "$WEB_PID_FILE")
    WEB_MEM=$(ps -o rss= -p "$WEB_PID" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
    WEB_CPU=$(ps -o %cpu= -p "$WEB_PID" 2>/dev/null | awk '{print $1"%"}')
    echo "  Web:  CPU: $WEB_CPU, Memory: $WEB_MEM"
fi

echo ""
