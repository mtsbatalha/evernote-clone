#!/bin/bash

# ==============================================================================
# Evernote Clone - Installation Script
# Installs all dependencies and sets up the project for production
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo ""
echo "========================================"
echo "  Evernote Clone - Installation Script"
echo "========================================"
echo ""

# ==============================================================================
# Check System Requirements
# ==============================================================================

log_info "Checking system requirements..."

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        return 1
    fi
    log_success "$1 found: $(command -v $1)"
}

# Required commands
MISSING_DEPS=0

check_command "node" || MISSING_DEPS=1
check_command "npm" || MISSING_DEPS=1
check_command "docker" || MISSING_DEPS=1

# Check for docker-compose or "docker compose"
if command -v docker-compose &> /dev/null; then
    log_success "docker-compose found: $(command -v docker-compose)"
elif docker compose version &> /dev/null; then
    log_success "docker compose plugin found"
else
    log_error "Neither docker-compose nor 'docker compose' plugin was found."
    MISSING_DEPS=1
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    log_warning "pnpm not found. Installing globally..."
    npm install -g pnpm
    log_success "pnpm installed"
else
    log_success "pnpm found: $(command -v pnpm)"
fi

if [ $MISSING_DEPS -eq 1 ]; then
    log_error "Missing required dependencies. Please install them and try again."
    echo ""
    echo "Installation instructions:"
    echo "  - Node.js: https://nodejs.org/ (v18+ recommended)"
    echo "  - Docker:  https://docs.docker.com/get-docker/"
    echo ""
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js version 18 or higher is required. Current: $(node -v)"
    exit 1
fi
log_success "Node.js version: $(node -v)"

# ==============================================================================
# Create directories
# ==============================================================================

log_info "Creating required directories..."
ensure_directories
log_success "Directories created"

# ==============================================================================
# Environment Configuration
# ==============================================================================

log_info "Setting up environment configuration..."

ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        log_warning ".env file created from .env.example"
        log_warning "Please review and update the configuration in .env"
    else
        log_error ".env.example not found. Cannot create configuration."
        exit 1
    fi
else
    log_success ".env file already exists"
fi

# ==============================================================================
# Install Node.js Dependencies
# ==============================================================================

log_info "Installing Node.js dependencies..."
cd "$PROJECT_ROOT"
pnpm install
log_success "Dependencies installed"

# ==============================================================================
# Start Docker Services
# ==============================================================================

log_info "Starting Docker services (PostgreSQL, Redis, MinIO, Meilisearch)..."

DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yml"

if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    cd "$PROJECT_ROOT/docker"
    
    # Check if docker compose v2 is available
    if docker compose version &>/dev/null 2>&1; then
        docker compose up -d
    else
        docker-compose up -d
    fi
    
    log_success "Docker services started"
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 10
else
    log_error "docker-compose.yml not found at $DOCKER_COMPOSE_FILE"
    exit 1
fi

# ==============================================================================
# Database Setup
# ==============================================================================

log_info "Setting up database..."
cd "$PROJECT_ROOT"

# Run Prisma migrations
log_info "Running database migrations..."
cd "$PROJECT_ROOT"

# Load environment variables from .env
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
    log_info "Loaded environment variables from .env"
else
    log_error ".env file not found. Cannot run database migrations."
    exit 1
fi

pnpm --filter @evernote-clone/database exec prisma generate
pnpm --filter @evernote-clone/database exec prisma db push
log_success "Database setup complete"

# ==============================================================================
# Build Applications
# ==============================================================================

log_info "Building applications..."
cd "$PROJECT_ROOT"

log_info "Building API..."
pnpm --filter @evernote-clone/api build
log_success "API built"

log_info "Building Web app..."
pnpm --filter @evernote-clone/web build
log_success "Web app built"

# ==============================================================================
# Final Summary
# ==============================================================================

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
log_success "All dependencies installed"
log_success "Docker services running"
log_success "Database migrated"
log_success "Applications built"
echo ""
echo "Next steps:"
echo "  1. Review configuration in .env"
echo "  2. Start the application: ./scripts/linux/start.sh"
echo "  3. Check status: ./scripts/linux/status.sh"
echo ""
echo "Default URLs (after starting):"
echo "  - Web:        http://localhost:3000"
echo "  - API:        http://localhost:4000"
echo "  - MinIO:      http://localhost:9001 (admin console)"
echo "  - Meilisearch: http://localhost:7700"
echo ""
