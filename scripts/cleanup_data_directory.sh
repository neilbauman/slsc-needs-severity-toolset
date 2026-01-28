#!/bin/bash
# Cleanup script for data/ directory
# This script helps safely remove data files that are no longer needed

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"
BACKUP_DIR="$PROJECT_ROOT/data_backup_$(date +%Y%m%d_%H%M%S)"

echo "=========================================="
echo "Data Directory Cleanup Script"
echo "=========================================="
echo ""
echo "This script will help you clean up the data/ directory (4.9GB)"
echo "to improve Cursor performance."
echo ""
echo "Project root: $PROJECT_ROOT"
echo "Data directory: $DATA_DIR"
echo ""

# Check if data directory exists
if [ ! -d "$DATA_DIR" ]; then
    echo "❌ Data directory not found: $DATA_DIR"
    exit 1
fi

# Show current size
echo "Current data/ directory size:"
du -sh "$DATA_DIR" | awk '{print $1}'
echo ""

# Ask for confirmation
read -p "Do you want to proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Choose an option:"
echo "1) Backup to external location (recommended if unsure)"
echo "2) Delete data/ directory (only if data is confirmed in Supabase)"
echo "3) Delete only large temporary/backup directories"
echo "4) Cancel"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo ""
        read -p "Enter backup location (full path): " backup_path
        if [ -z "$backup_path" ]; then
            echo "❌ Invalid backup path"
            exit 1
        fi
        echo "Backing up data/ to $backup_path..."
        mkdir -p "$backup_path"
        cp -r "$DATA_DIR" "$backup_path/data_backup_$(date +%Y%m%d_%H%M%S)"
        echo "✅ Backup complete"
        echo ""
        read -p "Delete original data/ directory now? (yes/no): " delete_after
        if [ "$delete_after" = "yes" ]; then
            rm -rf "$DATA_DIR"
            echo "✅ Data directory deleted"
        fi
        ;;
    2)
        echo ""
        echo "⚠️  WARNING: This will permanently delete the data/ directory!"
        echo "Make sure all data is already in Supabase before proceeding."
        read -p "Type 'DELETE' to confirm: " confirm_delete
        if [ "$confirm_delete" = "DELETE" ]; then
            rm -rf "$DATA_DIR"
            echo "✅ Data directory deleted"
        else
            echo "Aborted."
        fi
        ;;
    3)
        echo ""
        echo "Deleting large temporary/backup directories..."
        cd "$DATA_DIR"
        
        # Delete large directories
        [ -d "hdx_boundaries_reimport" ] && rm -rf "hdx_boundaries_reimport" && echo "✅ Deleted hdx_boundaries_reimport (3.1GB)"
        [ -d "temp_boundaries" ] && rm -rf "temp_boundaries" && echo "✅ Deleted temp_boundaries (868MB)"
        [ -d "madagascar_fix" ] && rm -rf "madagascar_fix" && echo "✅ Deleted madagascar_fix (210MB, 321 SQL files)"
        [ -d "upload_batches" ] && rm -rf "upload_batches" && echo "✅ Deleted upload_batches"
        [ -f "upload_batches.txt" ] && rm -f "upload_batches.txt" && echo "✅ Deleted upload_batches.txt (29MB)"
        
        echo ""
        echo "Remaining data/ directory size:"
        du -sh "$DATA_DIR" | awk '{print $1}'
        echo "✅ Cleanup complete"
        ;;
    4)
        echo "Cancelled."
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "Next steps:"
echo "1. Create .cursorignore file (if not exists)"
echo "2. Restart Cursor to refresh indexing"
echo "=========================================="
