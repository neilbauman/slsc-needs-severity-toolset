#!/usr/bin/env node

/**
 * Migrate Dataset Categories from Source to Target Database
 * 
 * This script updates dataset metadata with categories from instance_scoring_weights
 * in the source database, then applies them to the target database.
 * 
 * Usage:
 *   SOURCE_SUPABASE_URL=https://source.supabase.co \
 *   SOURCE_SUPABASE_KEY=source_anon_key \
 *   TARGET_SUPABASE_URL=https://target.supabase.co \
 *   TARGET_SUPABASE_KEY=target_anon_key \
 *   node scripts/migrate-dataset-categories.js
 */

const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const sourceUrl = process.env.SOURCE_SUPABASE_URL;
const sourceKey = process.env.SOURCE_SUPABASE_KEY;
const targetUrl = process.env.TARGET_SUPABASE_URL;
const targetKey = process.env.TARGET_SUPABASE_KEY;

if (!sourceUrl || !sourceKey || !targetUrl || !targetKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SOURCE_SUPABASE_URL');
  console.error('   SOURCE_SUPABASE_KEY');
  console.error('   TARGET_SUPABASE_URL');
  console.error('   TARGET_SUPABASE_KEY');
  process.exit(1);
}

const sourceClient = createClient(sourceUrl, sourceKey);
const targetClient = createClient(targetUrl, targetKey);

async function migrateCategories() {
  console.log('🚀 Starting dataset category migration...');
  console.log(`   Source: ${sourceUrl}`);
  console.log(`   Target: ${targetUrl}\n`);
  
  try {
    // Step 1: Get category mappings from source instance_scoring_weights
    console.log('📦 Step 1: Loading category mappings from source...');
    const { data: weights, error: weightsError } = await sourceClient
      .from('instance_scoring_weights')
      .select('dataset_id, category')
      .not('category', 'is', null);
    
    if (weightsError) {
      console.error('   ❌ Error loading weights:', weightsError.message);
      throw weightsError;
    }
    
    if (!weights || weights.length === 0) {
      console.log('   ⚠️  No category mappings found in source database');
      return;
    }
    
    // Build category map: dataset_id -> category (use most common category if multiple)
    const categoryMap = new Map();
    weights.forEach((w) => {
      if (w.dataset_id && w.category) {
        if (!categoryMap.has(w.dataset_id)) {
          categoryMap.set(w.dataset_id, new Map());
        }
        const catCount = categoryMap.get(w.dataset_id);
        catCount.set(w.category, (catCount.get(w.category) || 0) + 1);
      }
    });
    
    // Get most common category for each dataset
    const finalCategoryMap = new Map();
    categoryMap.forEach((catCounts, datasetId) => {
      let maxCount = 0;
      let mostCommonCat = '';
      catCounts.forEach((count, cat) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonCat = cat;
        }
      });
      if (mostCommonCat) {
        finalCategoryMap.set(datasetId, mostCommonCat);
      }
    });
    
    console.log(`   ✅ Found ${finalCategoryMap.size} datasets with categories`);
    console.log(`   Categories: ${Array.from(new Set(finalCategoryMap.values())).join(', ')}\n`);
    
    // Step 2: Update target database datasets
    console.log('📦 Step 2: Updating dataset categories in target...');
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const [datasetId, category] of finalCategoryMap.entries()) {
      try {
        // Get current dataset metadata
        const { data: dataset, error: getError } = await targetClient
          .from('datasets')
          .select('id, metadata')
          .eq('id', datasetId)
          .single();
        
        if (getError) {
          if (getError.code === 'PGRST116') {
            skipped++;
            continue; // Dataset doesn't exist in target
          }
          throw getError;
        }
        
        // Update metadata with category
        const updatedMetadata = {
          ...(dataset.metadata || {}),
          category: category,
        };
        
        const { error: updateError } = await targetClient
          .from('datasets')
          .update({ metadata: updatedMetadata })
          .eq('id', datasetId);
        
        if (updateError) {
          console.warn(`   ⚠️  Error updating dataset ${datasetId}: ${updateError.message}`);
          errors++;
        } else {
          updated++;
        }
      } catch (err) {
        console.warn(`   ⚠️  Error processing dataset ${datasetId}: ${err.message}`);
        errors++;
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Updated: ${updated} datasets`);
    console.log(`Skipped: ${skipped} datasets (not in target)`);
    console.log(`Errors: ${errors} datasets`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log(`\n✅ Category migration complete!`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateCategories();
