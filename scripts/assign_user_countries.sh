#!/bin/bash
# Script to assign a user to all countries via API
# Usage: ./scripts/assign_user_countries.sh <email> <access_token>

EMAIL="${1:-neil.bauman@sheltercluster.org}"
TOKEN="${2}"

if [ -z "$TOKEN" ]; then
  echo "Error: Access token required"
  echo "Usage: $0 <email> <access_token>"
  echo ""
  echo "To get an access token:"
  echo "1. Open your browser console on the app"
  echo "2. Run: localStorage.getItem('sb-access-token')"
  echo "3. Or check the Network tab for Authorization headers"
  exit 1
fi

API_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:3000}"

echo "Assigning countries to: $EMAIL"
echo "Using API: $API_URL/api/admin/assign-user-countries"

curl -X POST "$API_URL/api/admin/assign-user-countries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"email\": \"$EMAIL\"}" \
  | jq '.'
