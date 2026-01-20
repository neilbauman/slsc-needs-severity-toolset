#!/bin/bash

# Restore Building Typology Datasets from Source to Target
# This script uses curl to export from source and import to target

SOURCE_PROJECT="vxoyzgsxiqwpufrtnerf"
SOURCE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4b3l6Z3N4aXF3cHVmcnRuZXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjU3ODAyMiwiZXhwIjoyMDc4MTU0MDIyfQ.fdRNdgzaHLeXYabs0kFG2BcMPG6kEY9W1Vy6-5YBsBc"

TARGET_PROJECT="yzxmxwppzpwfolkdiuuo"
TARGET_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6eG14d3BwenB3Zm9sa2RpdXVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQyMjk3NSwiZXhwIjoyMDgzOTk4OTc1fQ.vW5z5udhwZOW367t3m3y9MOhnCpRN6SiQe1wwJw9xCE"

echo "🚀 Starting dataset restoration..."
echo ""

# Function to export data
export_dataset() {
  local dataset_id=$1
  local dataset_name=$2
  echo "📤 Exporting: $dataset_name"
  
  # Try raw table first
  curl -s "https://${SOURCE_PROJECT}.supabase.co/rest/v1/dataset_values_categorical_raw?dataset_id=eq.${dataset_id}&select=admin_pcode,category,value&order=admin_pcode.asc,category.asc" \
    -H "apikey: ${SOURCE_KEY}" \
    -H "Authorization: Bearer ${SOURCE_KEY}" \
    -H "Content-Type: application/json" \
    > "export_${dataset_name// /_}_raw.json"
  
  # Check if we got data
  count=$(cat "export_${dataset_name// /_}_raw.json" | grep -o '"admin_pcode"' | wc -l)
  
  if [ "$count" -eq 0 ]; then
    echo "   ⚠️  Raw table empty, trying cleaned table..."
    curl -s "https://${SOURCE_PROJECT}.supabase.co/rest/v1/dataset_values_categorical?dataset_id=eq.${dataset_id}&select=admin_pcode,category,value&order=admin_pcode.asc,category.asc" \
      -H "apikey: ${SOURCE_KEY}" \
      -H "Authorization: Bearer ${SOURCE_KEY}" \
      -H "Content-Type: application/json" \
      > "export_${dataset_name// /_}_cleaned.json"
    
    count=$(cat "export_${dataset_name// /_}_cleaned.json" | grep -o '"admin_pcode"' | wc -l)
    if [ "$count" -gt 0 ]; then
      echo "   ✓ Exported $count rows from cleaned table"
      echo "export_${dataset_name// /_}_cleaned.json"
      return 0
    fi
  else
    echo "   ✓ Exported $count rows from raw table"
    echo "export_${dataset_name// /_}_raw.json"
    return 0
  fi
  
  echo "   ❌ No data found"
  return 1
}

# Function to get target dataset ID
get_target_id() {
  local dataset_name=$1
  curl -s "https://${TARGET_PROJECT}.supabase.co/rest/v1/datasets?name=eq.${dataset_name}&select=id" \
    -H "apikey: ${TARGET_KEY}" \
    -H "Authorization: Bearer ${TARGET_KEY}" \
    -H "Content-Type: application/json" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1
}

# Function to import data
import_dataset() {
  local file=$1
  local target_id=$2
  local dataset_name=$3
  
  echo "📥 Importing: $dataset_name to target ID: $target_id"
  
  # Read JSON file and add dataset_id to each row, then import
  # Using jq if available, otherwise manual processing
  if command -v jq &> /dev/null; then
    jq --arg id "$target_id" '.[] | {dataset_id: $id, admin_pcode, category, value}' "$file" | \
      jq -s '.' | \
      curl -s -X POST "https://${TARGET_PROJECT}.supabase.co/rest/v1/dataset_values_categorical_raw" \
        -H "apikey: ${TARGET_KEY}" \
        -H "Authorization: Bearer ${TARGET_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d @- > "import_result_${dataset_name// /_}.json"
    
    if [ $? -eq 0 ]; then
      echo "   ✓ Import successful"
      return 0
    else
      echo "   ❌ Import failed"
      return 1
    fi
  else
    echo "   ⚠️  jq not found. Please install jq or import manually via Supabase Table Editor"
    echo "   💡 Use the exported JSON file: $file"
    echo "   💡 Add dataset_id=$target_id to each row and import via Table Editor"
    return 1
  fi
}

# Restore Dataset 1
echo "📦 Processing: Building Typologies (adm3)"
export_file=$(export_dataset "a017b4a4-b958-4ede-ab9d-8f4124188d4c" "Building Typologies (adm3)")
if [ $? -eq 0 ] && [ -n "$export_file" ]; then
  target_id=$(get_target_id "Building Typologies (adm3)")
  if [ -n "$target_id" ]; then
    import_dataset "$export_file" "$target_id" "Building Typologies (adm3)"
    echo "✅ Dataset 1 restoration initiated"
  else
    echo "   ⚠️  Target dataset not found. Please create it first."
  fi
fi

echo ""

# Restore Dataset 2
echo "📦 Processing: Building Typology"
export_file=$(export_dataset "59abe182-73c6-47f5-8e7b-752a1168bf06" "Building Typology")
if [ $? -eq 0 ] && [ -n "$export_file" ]; then
  target_id=$(get_target_id "Building Typology")
  if [ -n "$target_id" ]; then
    import_dataset "$export_file" "$target_id" "Building Typology"
    echo "✅ Dataset 2 restoration initiated"
  else
    echo "   ⚠️  Target dataset not found. Please create it first."
  fi
fi

echo ""
echo "🎉 Export complete!"
echo ""
echo "Next steps:"
echo "1. Check the exported JSON files"
echo "2. If import didn't work automatically, use Supabase Table Editor to import"
echo "3. Run the cleaning function: SELECT * FROM restore_dataset_from_raw('target-dataset-id');"
