#!/bin/bash

# ==============================
# DEV ENVIRONMENT SETUP SCRIPT
# ==============================
# This script helps set up the development environment
# Run: bash scripts/setup-dev-env.sh

set -e

echo "=========================================="
echo "Multi-Country Auth - Dev Environment Setup"
echo "=========================================="
echo ""

# Check if .env.local exists
if [ -f .env.local ]; then
    echo "✓ Found .env.local"
    echo ""
    echo "Current Supabase URL:"
    grep "NEXT_PUBLIC_SUPABASE_URL" .env.local | head -1 || echo "  (not found)"
    echo ""
    read -p "Do you want to update .env.local with dev credentials? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        read -p "Enter dev Supabase URL: " SUPABASE_URL
        read -p "Enter dev Supabase Anon Key: " SUPABASE_ANON_KEY
        
        # Backup existing .env.local
        cp .env.local .env.local.backup
        echo "✓ Backed up .env.local to .env.local.backup"
        
        # Update or add variables
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
        
        echo "✓ Updated .env.local with dev credentials"
    fi
else
    echo "⚠ .env.local not found"
    echo ""
    read -p "Do you want to create .env.local? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter dev Supabase URL: " SUPABASE_URL
        read -p "Enter dev Supabase Anon Key: " SUPABASE_ANON_KEY
        
        cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF
        
        echo "✓ Created .env.local with dev credentials"
    fi
fi

echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Create a dev Supabase project at: https://app.supabase.com"
echo "2. Copy your production schema to dev (run existing SQL migrations)"
echo "3. Run the migration script in dev Supabase SQL Editor:"
echo "   supabase/migrations/00_run_all_migrations.sql"
echo "4. Create test users in Supabase Auth dashboard"
echo "5. Assign countries to users:"
echo "   supabase/migrations/assign_test_user_countries.sql"
echo "6. Start dev server: npm run dev"
echo "7. Test at http://localhost:3000/login"
echo ""
echo "See docs/NEXT_STEPS.md for detailed instructions"
echo ""
