#!/bin/bash

# ==============================
# CONFIGURE DEV ENVIRONMENT
# ==============================
# Quick script to update .env.local with dev credentials

set -e

echo "=========================================="
echo "Configuring Dev Environment"
echo "=========================================="
echo ""

# Project details
SUPABASE_URL="https://yzxmxwppzpwfolkdiuuo.supabase.co"

echo "Project URL: $SUPABASE_URL"
echo ""
read -p "Enter your Supabase anon key: " SUPABASE_ANON_KEY

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Anon key is required!"
    exit 1
fi

# Backup existing .env.local if it exists
if [ -f .env.local ]; then
    cp .env.local .env.local.backup
    echo "✓ Backed up existing .env.local"
fi

# Create or update .env.local
if [ -f .env.local ]; then
    # Update existing file
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local; then
        sed -i '' "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL|" .env.local
    else
        echo "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL" >> .env.local
    fi
    
    if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local; then
        sed -i '' "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|" .env.local
    else
        echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env.local
    fi
else
    # Create new file
    cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF
fi

echo ""
echo "✅ .env.local configured!"
echo ""
echo "Current configuration:"
echo "  URL: $SUPABASE_URL"
echo "  Anon Key: ${SUPABASE_ANON_KEY:0:20}..." # Show first 20 chars
echo ""
echo "Next steps:"
echo "1. Copy your production schema to dev (run existing SQL migrations)"
echo "2. Run: supabase/migrations/00_run_all_migrations.sql"
echo "3. Start dev server: npm run dev"
echo ""
