#!/bin/bash

# ==============================================================================
# Evernote Clone - Backup Script (Linux)
# Creates compressed backup of database and project files
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "========================================"
echo "  Evernote Clone - Backup Script"
echo "========================================"
echo ""

# Load environment variables
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# Database connection settings (from .env or defaults)
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-evernote_clone}"
DB_USER="${DATABASE_USER:-postgres}"
DB_PASSWORD="${DATABASE_PASSWORD:-postgres}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ==============================================================================
# Backup Type Selection
# ==============================================================================

show_menu() {
    echo "Select backup type:"
    echo "  1) Database only"
    echo "  2) Files only (uploads, logs)"
    echo "  3) Full backup (database + files + code)"
    echo "  4) Quick backup (database + uploads)"
    echo ""
    read -p "Enter choice [1-4]: " choice
}

if [ -z "$1" ]; then
    show_menu
else
    choice=$1
fi

# ==============================================================================
# Database Backup Function
# ==============================================================================

backup_database() {
    log_info "Backing up PostgreSQL database..."
    
    DB_BACKUP_FILE="$BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql"
    
    # Check if running in Docker
    if docker ps --format '{{.Names}}' | grep -q "evernote-postgres"; then
        log_info "Using Docker PostgreSQL..."
        docker exec evernote-postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$DB_BACKUP_FILE"
    else
        # Direct connection
        PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$DB_BACKUP_FILE"
    fi
    
    # Compress
    gzip -f "$DB_BACKUP_FILE"
    DB_BACKUP_FILE="${DB_BACKUP_FILE}.gz"
    
    log_success "Database backup: $DB_BACKUP_FILE ($(du -h "$DB_BACKUP_FILE" | cut -f1))"
    echo "$DB_BACKUP_FILE"
}

# ==============================================================================
# Files Backup Function
# ==============================================================================

backup_files() {
    log_info "Backing up files..."
    
    FILES_BACKUP="$BACKUP_DIR/files_${TIMESTAMP}.tar.gz"
    
    cd "$PROJECT_ROOT"
    
    # Directories to backup
    DIRS_TO_BACKUP=""
    [ -d "uploads" ] && DIRS_TO_BACKUP="$DIRS_TO_BACKUP uploads"
    [ -d "logs" ] && DIRS_TO_BACKUP="$DIRS_TO_BACKUP logs"
    [ -d "data" ] && DIRS_TO_BACKUP="$DIRS_TO_BACKUP data"
    [ -f ".env" ] && DIRS_TO_BACKUP="$DIRS_TO_BACKUP .env"
    
    if [ -n "$DIRS_TO_BACKUP" ]; then
        tar -czf "$FILES_BACKUP" $DIRS_TO_BACKUP 2>/dev/null || true
        log_success "Files backup: $FILES_BACKUP ($(du -h "$FILES_BACKUP" | cut -f1))"
    else
        log_warning "No files to backup"
    fi
    
    echo "$FILES_BACKUP"
}

# ==============================================================================
# Full Project Backup Function
# ==============================================================================

backup_full() {
    log_info "Creating full project backup..."
    
    FULL_BACKUP="$BACKUP_DIR/full_backup_${TIMESTAMP}.tar.gz"
    
    cd "$PROJECT_ROOT"
    
    # First backup database
    DB_FILE=$(backup_database)
    
    # Create temporary directory for packaging
    TEMP_DIR=$(mktemp -d)
    mkdir -p "$TEMP_DIR/evernote-clone-backup"
    
    # Copy important files
    cp -r apps "$TEMP_DIR/evernote-clone-backup/" 2>/dev/null || true
    cp -r packages "$TEMP_DIR/evernote-clone-backup/" 2>/dev/null || true
    cp -r docker "$TEMP_DIR/evernote-clone-backup/" 2>/dev/null || true
    cp -r scripts "$TEMP_DIR/evernote-clone-backup/" 2>/dev/null || true
    [ -d "uploads" ] && cp -r uploads "$TEMP_DIR/evernote-clone-backup/"
    [ -d "logs" ] && cp -r logs "$TEMP_DIR/evernote-clone-backup/"
    [ -f ".env" ] && cp .env "$TEMP_DIR/evernote-clone-backup/"
    [ -f ".env.example" ] && cp .env.example "$TEMP_DIR/evernote-clone-backup/"
    cp package.json pnpm-workspace.yaml pnpm-lock.yaml "$TEMP_DIR/evernote-clone-backup/" 2>/dev/null || true
    cp "$DB_FILE" "$TEMP_DIR/evernote-clone-backup/database_backup.sql.gz"
    
    # Exclude node_modules and dist
    cd "$TEMP_DIR"
    tar --exclude='node_modules' --exclude='dist' --exclude='.next' --exclude='.git' \
        -czf "$FULL_BACKUP" evernote-clone-backup
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    log_success "Full backup: $FULL_BACKUP ($(du -h "$FULL_BACKUP" | cut -f1))"
    echo "$FULL_BACKUP"
}

# ==============================================================================
# Execute Backup
# ==============================================================================

case $choice in
    1)
        log_info "Starting database backup..."
        backup_database
        ;;
    2)
        log_info "Starting files backup..."
        backup_files
        ;;
    3)
        log_info "Starting full backup..."
        backup_full
        ;;
    4)
        log_info "Starting quick backup..."
        backup_database
        backup_files
        ;;
    *)
        log_error "Invalid choice"
        exit 1
        ;;
esac

# ==============================================================================
# Cleanup old backups (keep last 7 days)
# ==============================================================================

log_info "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.gz" -type f -mtime +7 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +7 -delete 2>/dev/null || true

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "========================================"
echo "  Backup Complete!"
echo "========================================"
echo ""
echo "Backup location: $BACKUP_DIR"
echo "Files created:"
ls -lh "$BACKUP_DIR"/*${TIMESTAMP}* 2>/dev/null || echo "  (none in this run)"
echo ""
echo "To restore, use: ./scripts/linux/restore.sh <backup_file>"
echo ""
