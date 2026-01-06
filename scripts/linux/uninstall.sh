#!/bin/bash

# ==============================================================================
# Evernote Clone - Uninstallation Script
# COMPLETE REMOVAL of the project (containers, volumes, files)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo ""
echo "========================================"
echo "  Evernote Clone - UNINSTALLATION"
echo "========================================"
echo ""
echo "WARNING: This script will delete:"
echo "  1. All Docker containers for this project"
echo "  2. All Docker volumes (DATABASE DATA WILL BE LOST)"
echo "  3. The entire project directory (optional)"
echo ""

read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Uninstallation cancelled."
    exit 0
fi

# ==============================================================================
# Stop Services
# ==============================================================================

log_info "Stopping all services..."
"$SCRIPT_DIR/stop.sh" --all

# ==============================================================================
# Remove Docker Resources
# ==============================================================================

log_info "Removing Docker resources..."

DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yml"

if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    cd "$PROJECT_ROOT/docker"
    
    # Remove containers and volumes
    if docker compose version &>/dev/null 2>&1; then
        docker compose down -v --rmi all --remove-orphans
    else
        docker-compose down -v --rmi all --remove-orphans
    fi
    
    log_success "Docker containers, volumes, and images removed"
else
    log_warning "docker-compose.yml not found. Skipping Docker cleanup."
fi

# ==============================================================================
# Remove Node Modules & Build Artifacts
# ==============================================================================

log_info "Cleaning up node_modules and build artifacts..."
cd "$PROJECT_ROOT"
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm -rf dist
rm -rf .turbo
log_success "Cleaned up dependencies"

# ==============================================================================
# Remove Project Directory
# ==============================================================================

echo ""
echo "Do you want to delete the entire project directory?"
echo "Directory: $PROJECT_ROOT"
echo "WARNING: This action cannot be undone!"
echo ""

read -p "Delete project files? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Removing project files..."
    cd ..
    rm -rf "$PROJECT_ROOT"
    echo "========================================"
    echo "  Uninstallation Complete"
    echo "========================================"
    echo "The project has been completely removed."
else
    echo "========================================"
    echo "  Uninstallation Complete"
    echo "========================================"
    echo "Dependencies and Docker resources removed."
    echo "Project files at '$PROJECT_ROOT' were kept."
fi
