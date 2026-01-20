#!/bin/bash

# ==============================
# COMPLETE AUTOMATED SETUP SCRIPT
# ==============================
# This script guides you through the complete setup process
# It prepares all SQL files and provides step-by-step instructions

set -e

echo "=========================================="
echo "Multi-Country Auth - Complete Setup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Project: SLSCToolset${NC}"
echo -e "${BLUE}URL: https://yzxmxwppzpwfolkdiuuo.supabase.co${NC}"
echo ""

# Check environment
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}⚠ .env.local not found${NC}"
    echo "Environment should already be configured, but checking..."
    exit 1
fi

echo -e "${GREEN}✅ Environment configured${NC}"
echo ""

# List SQL files to run
echo "=========================================="
echo "SQL FILES TO RUN (IN ORDER)"
echo "=========================================="
echo ""
echo "1. Complete Schema Setup:"
echo "   File: supabase/migrations/01_complete_schema_setup.sql"
echo "   Purpose: Creates all base tables"
echo ""
echo "2. Multi-Country Migrations:"
echo "   File: supabase/migrations/00_run_all_migrations.sql"
echo "   Purpose: Adds country isolation"
echo ""
echo "3. Assign User Countries:"
echo "   File: scripts/quick-assign-user.sql"
echo "   Purpose: Assign countries to test users"
echo ""
echo "4. Verify Setup:"
echo "   File: scripts/verify-setup.sql"
echo "   Purpose: Verify everything is set up correctly"
echo ""

echo "=========================================="
echo "STEP-BY-STEP INSTRUCTIONS"
echo "=========================================="
echo ""

echo -e "${YELLOW}STEP 1: Enable Email Authentication${NC}"
echo "1. Go to: https://yzxmxwppzpwfolkdiuuo.supabase.co"
echo "2. Navigate to: Authentication → Providers"
echo "3. Enable 'Email' provider"
echo "4. (Optional) Disable 'Enable email confirmations' for easier testing"
echo "5. Click 'Save'"
echo ""
read -p "Press Enter when Email auth is enabled..."

echo ""
echo -e "${YELLOW}STEP 2: Run Complete Schema Setup${NC}"
echo "1. Go to: SQL Editor in Supabase dashboard"
echo "2. Open: supabase/migrations/01_complete_schema_setup.sql"
echo "3. Copy the entire file"
echo "4. Paste into SQL Editor"
echo "5. Click 'Run' (or Cmd/Ctrl + Enter)"
echo "6. Check for success messages"
echo ""
read -p "Press Enter when schema setup is complete..."

echo ""
echo -e "${YELLOW}STEP 3: Run Multi-Country Migrations${NC}"
echo "1. In SQL Editor, open: supabase/migrations/00_run_all_migrations.sql"
echo "2. Copy the entire file"
echo "3. Paste into SQL Editor"
echo "4. Click 'Run'"
echo "5. Check output - should see:"
echo "   - Step 1 complete: Countries table created"
echo "   - Step 2 complete: User countries table created"
echo "   - Step 3 complete: Country isolation columns added"
echo "   - Step 4 complete: Data migrated to Philippines"
echo "   - Step 5 complete: Verification done"
echo "   - SUCCESS: All records have country_id assigned"
echo ""
read -p "Press Enter when migrations are complete..."

echo ""
echo -e "${YELLOW}STEP 4: Create Test User${NC}"
echo "Option A - Via Dashboard:"
echo "1. Go to: Authentication → Users"
echo "2. Click 'Add User' → 'Create new user'"
echo "3. Enter email: test@example.com"
echo "4. Enter password (save it!)"
echo "5. Check 'Auto Confirm User'"
echo "6. Click 'Create user'"
echo "7. Copy the User ID"
echo ""
echo "Option B - Via Signup Page:"
echo "1. Run: npm run dev"
echo "2. Go to: http://localhost:3000/signup"
echo "3. Create account"
echo "4. Get User ID from Supabase dashboard"
echo ""
read -p "Press Enter when test user is created..."

echo ""
echo -e "${YELLOW}STEP 5: Assign Country to User${NC}"
echo "1. In SQL Editor, open: scripts/quick-assign-user.sql"
echo "2. Replace 'YOUR_EMAIL_HERE' with your test user email"
echo "3. Or replace 'YOUR_USER_ID_HERE' with the UUID"
echo "4. Run the script"
echo "5. Should see: '✅ Successfully assigned user to...'"
echo ""
read -p "Press Enter when country is assigned..."

echo ""
echo -e "${YELLOW}STEP 6: Verify Setup${NC}"
echo "1. In SQL Editor, open: scripts/verify-setup.sql"
echo "2. Copy and paste into SQL Editor"
echo "3. Run it"
echo "4. Check output - should show:"
echo "   - Countries exist"
echo "   - User has country assignment"
echo "   - No errors"
echo ""
read -p "Press Enter when verification is complete..."

echo ""
echo "=========================================="
echo "TESTING THE APPLICATION"
echo "=========================================="
echo ""

echo -e "${GREEN}Starting dev server...${NC}"
echo ""

# Start dev server in background
npm run dev &
DEV_PID=$!

echo "Dev server starting (PID: $DEV_PID)"
echo ""
echo "Once server is ready:"
echo "1. Open: http://localhost:3000"
echo "2. You should be redirected to /login"
echo "3. Login with your test user"
echo "4. Verify:"
echo "   - Header shows your email"
echo "   - Country selector appears"
echo "   - Can see 'Philippines' in dropdown"
echo "   - Logout button works"
echo ""
echo "To stop the server: kill $DEV_PID"
echo ""

echo "=========================================="
echo -e "${GREEN}SETUP COMPLETE!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "- Test authentication and country selector"
echo "- Continue with Phase 4: Update queries"
echo "- See QUERY_UPDATE_GUIDE.md for patterns"
echo ""
