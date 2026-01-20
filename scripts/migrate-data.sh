#!/bin/bash
# Automated Data Migration Script
# 
# This script helps you migrate data from your source database to target database
# 
# Usage:
#   ./scripts/migrate-data.sh
# 
# Or with environment variables:
#   SOURCE_URL="..." SOURCE_KEY="..." TARGET_URL="..." TARGET_KEY="..." ./scripts/migrate-data.sh

set -e

echo "=========================================="
echo "  Data Migration Setup"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if @supabase/supabase-js is installed
if [ ! -d "node_modules/@supabase" ]; then
    echo "Installing dependencies..."
    npm install @supabase/supabase-js
fi

# Prompt for source database credentials if not provided
if [ -z "$SOURCE_SUPABASE_URL" ]; then
    read -p "Enter SOURCE database URL (old Philippines database): " SOURCE_SUPABASE_URL
    export SOURCE_SUPABASE_URL
fi

if [ -z "$SOURCE_SUPABASE_KEY" ]; then
    read -p "Enter SOURCE database anon key: " SOURCE_SUPABASE_KEY
    export SOURCE_SUPABASE_KEY
fi

# Prompt for target database credentials if not provided
if [ -z "$TARGET_SUPABASE_URL" ]; then
    read -p "Enter TARGET database URL (new multi-country database): " TARGET_SUPABASE_URL
    export TARGET_SUPABASE_URL
fi

if [ -z "$TARGET_SUPABASE_KEY" ]; then
    read -p "Enter TARGET database anon key: " TARGET_SUPABASE_KEY
    export TARGET_SUPABASE_KEY
fi

echo ""
echo "Starting migration..."
echo "  Source: $SOURCE_SUPABASE_URL"
echo "  Target: $TARGET_SUPABASE_URL"
echo ""

# Run the migration script
node scripts/migrate-data.js
