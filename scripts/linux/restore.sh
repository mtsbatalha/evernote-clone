#!/bin/bash

# ==============================================================================
# Evernote Clone - Restore Script (Linux)
# Restores database and/or files from backup
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"

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
echo "  Evernote Clone - Restore Script"
echo "========================================"
echo ""

# Load environment variables
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# Database connection settings
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-evernote_clone}"
DB_USER="${DATABASE_USER:-postgres}"
DB_PASSWORD="${DATABASE_PASSWORD:-postgres}"

# ==============================================================================
# Check Arguments
# ==============================================================================

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Available backups:"
    echo ""
    ls -lht "$BACKUP_DIR"/*.gz 2>/dev/null | head -20 || echo "No backups found in $BACKUP_DIR"
    echo ""
    read -p "Enter backup file path (or number from list): " BACKUP_FILE
fi

if [ ! -f "$BACKUP_FILE" ]; then
    # Try in backup directory
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

log_info "Restoring from: $BACKUP_FILE"

# ==============================================================================
# Confirm Restore
# ==============================================================================

echo ""
log_warning "⚠️  WARNING: This will overwrite existing data!"
echo ""
read -p "Are you sure you want to restore? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log_info "Restore cancelled"
    exit 0
fi

# ==============================================================================
# Determine Backup Type
# ==============================================================================

FILENAME=$(basename "$BACKUP_FILE")

if [[ "$FILENAME" == db_* ]]; then
    BACKUP_TYPE="database"
elif [[ "$FILENAME" == files_* ]]; then
    BACKUP_TYPE="files"
elif [[ "$FILENAME" == full_* ]]; then
    BACKUP_TYPE="full"
else
    log_warning "Unknown backup type, attempting auto-detection..."
    if file "$BACKUP_FILE" | grep -q "SQL"; then
        BACKUP_TYPE="database"
    else
        BACKUP_TYPE="files"
    fi
fi

log_info "Detected backup type: $BACKUP_TYPE"

# ==============================================================================
# Restore Database
# ==============================================================================

restore_database() {
    local DB_FILE="$1"
    
    log_info "Restoring database..."
    
    # Decompress if needed
    if [[ "$DB_FILE" == *.gz ]]; then
        log_info "Decompressing..."
        TEMP_SQL=$(mktemp)
        gunzip -c "$DB_FILE" > "$TEMP_SQL"
        DB_FILE="$TEMP_SQL"
    fi
    
    # Check if running in Docker
    if docker ps --format '{{.Names}}' | grep -q "evernote-postgres"; then
        log_info "Using Docker PostgreSQL..."
        
        # Drop and recreate database
        docker exec evernote-postgres psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres 2>/dev/null || true
        docker exec evernote-postgres psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" postgres
        
        # Restore
        docker exec -i evernote-postgres psql -U "$DB_USER" "$DB_NAME" < "$DB_FILE"
    else
        # Direct connection
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres 2>/dev/null || true
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" postgres
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" < "$DB_FILE"
    fi
    
    # Cleanup temp file
    [ -n "$TEMP_SQL" ] && rm -f "$TEMP_SQL"
    
    log_success "Database restored"
}

# ==============================================================================
# Restore Files
# ==============================================================================

restore_files() {
    local FILES_ARCHIVE="$1"
    
    log_info "Restoring files..."
    
    cd "$PROJECT_ROOT"
    
    # Extract files
    tar -xzf "$FILES_ARCHIVE"
    
    log_success "Files restored"
}

# ==============================================================================
# Restore Full Backup
# ==============================================================================

restore_full() {
    local FULL_ARCHIVE="$1"
    
    log_info "Restoring full backup..."
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    
    # Extract archive
    tar -xzf "$FULL_ARCHIVE" -C "$TEMP_DIR"
    
    BACKUP_CONTENT="$TEMP_DIR/evernote-clone-backup"
    
    if [ ! -d "$BACKUP_CONTENT" ]; then
        log_error "Invalid backup format"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    
    # Restore database first
    if [ -f "$BACKUP_CONTENT/database_backup.sql.gz" ]; then
        restore_database "$BACKUP_CONTENT/database_backup.sql.gz"
    fi
    
    # Restore uploads
    if [ -d "$BACKUP_CONTENT/uploads" ]; then
        log_info "Restoring uploads..."
        rm -rf "$PROJECT_ROOT/uploads"
        cp -r "$BACKUP_CONTENT/uploads" "$PROJECT_ROOT/"
    fi
    
    # Restore .env if exists
    if [ -f "$BACKUP_CONTENT/.env" ]; then
        log_info "Restoring .env..."
        cp "$BACKUP_CONTENT/.env" "$PROJECT_ROOT/.env"
    fi
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    log_success "Full restore complete"
}

# ==============================================================================
# Execute Restore
# ==============================================================================

case $BACKUP_TYPE in
    database)
        restore_database "$BACKUP_FILE"
        ;;
    files)
        restore_files "$BACKUP_FILE"
        ;;
    full)
        restore_full "$BACKUP_FILE"
        ;;
    *)
        log_error "Unknown backup type"
        exit 1
        ;;
esac

# ==============================================================================
# Post-Restore Tasks
# ==============================================================================

echo ""
log_info "Running post-restore tasks..."

# Regenerate Prisma client
cd "$PROJECT_ROOT"
if [ -f "packages/database/package.json" ]; then
    log_info "Regenerating Prisma client..."
    pnpm --filter @evernote-clone/database exec prisma generate 2>/dev/null || true
fi

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "========================================"
echo "  Restore Complete!"
echo "========================================"
echo ""
echo "Restored from: $BACKUP_FILE"
echo ""
echo "Next steps:"
echo "  1. Restart services: ./scripts/linux/restart.sh"
echo "  2. Verify data integrity"
echo "  3. Test the application"
echo ""
