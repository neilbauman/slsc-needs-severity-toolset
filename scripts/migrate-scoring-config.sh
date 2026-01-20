#!/bin/bash

# Wrapper script for migrate-scoring-config.js
# Prompts for credentials if not provided via environment variables

echo "🚀 Scoring Configuration Migration Script"
echo "=========================================="
echo ""

# Check if credentials are provided
if [ -z "$SOURCE_SUPABASE_URL" ] || [ -z "$SOURCE_SUPABASE_KEY" ] || [ -z "$TARGET_SUPABASE_URL" ] || [ -z "$TARGET_SUPABASE_KEY" ]; then
  echo "Please provide database credentials:"
  echo ""
  
  if [ -z "$SOURCE_SUPABASE_URL" ]; then
    read -p "Source Supabase URL: " SOURCE_SUPABASE_URL
    export SOURCE_SUPABASE_URL
  fi
  
  if [ -z "$SOURCE_SUPABASE_KEY" ]; then
    read -p "Source Supabase Anon Key: " SOURCE_SUPABASE_KEY
    export SOURCE_SUPABASE_KEY
  fi
  
  if [ -z "$TARGET_SUPABASE_URL" ]; then
    read -p "Target Supabase URL: " TARGET_SUPABASE_URL
    export TARGET_SUPABASE_URL
  fi
  
  if [ -z "$TARGET_SUPABASE_KEY" ]; then
    read -p "Target Supabase Anon Key: " TARGET_SUPABASE_KEY
    export TARGET_SUPABASE_KEY
  fi
  
  echo ""
fi

# Run the migration script
node scripts/migrate-scoring-config.js
