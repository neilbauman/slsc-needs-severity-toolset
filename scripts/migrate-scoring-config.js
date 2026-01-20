#!/usr/bin/env node

/**
 * Migrate Scoring Configuration from Source to Target Database
 * 
 * This script migrates scoring configuration data:
 * - instance_dataset_config (scoring methods, thresholds, etc.)
 * - instance_scoring_weights (dataset and category weights)
 * - hazard_events.metadata (hazard event scoring config)
 * 
 * Usage:
 *   SOURCE_SUPABASE_URL=https://source.supabase.co \
 *   SOURCE_SUPABASE_KEY=source_anon_key \
 *   TARGET_SUPABASE_URL=https://target.supabase.co \
 *   TARGET_SUPABASE_KEY=target_anon_key \
 *   node scripts/migrate-scoring-config.js
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

// Known columns for each table
const knownColumns = {
  instance_dataset_config: ['instance_id', 'dataset_id', 'scoring_method', 'score_config', 'created_at', 'updated_at'],
  instance_scoring_weights: ['instance_id', 'dataset_id', 'category', 'dataset_weight', 'category_weight', 'created_at', 'updated_at'],
};

// Filter row to only include known columns
function filterRow(row, allowedColumns) {
  const filtered = {};
  for (const col of allowedColumns) {
    if (row.hasOwnProperty(col)) {
      filtered[col] = row[col];
    }
  }
  return filtered;
}

// Migrate a table
async function migrateTable(tableName, transform = (row) => row) {
  console.log(`\n📦 Migrating ${tableName}...`);
  
  try {
    // Check if table exists in source
    const { data: sourceData, error: sourceError } = await sourceClient
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (sourceError) {
      if (sourceError.code === 'PGRST116' || sourceError.message.includes('does not exist')) {
        console.log(`   ⚠️  Table ${tableName} does not exist in source database, skipping...`);
        return { migrated: 0, skipped: true };
      }
      throw sourceError;
    }
    
    // Get all data from source
    const { data: allSourceData, error: fetchError } = await sourceClient
      .from(tableName)
      .select('*');
    
    if (fetchError) throw fetchError;
    
    if (!allSourceData || allSourceData.length === 0) {
      console.log(`   ℹ️  No data found in ${tableName}, skipping...`);
      return { migrated: 0, skipped: false };
    }
    
    console.log(`   Found ${allSourceData.length} records in source`);
    
    // Filter columns and transform
    const allowedColumns = knownColumns[tableName] || Object.keys(allSourceData[0] || {});
    const transformedData = allSourceData.map(row => {
      const filtered = filterRow(row, allowedColumns);
      return transform(filtered);
    });
    
    // Upsert into target (handle duplicates)
    let upserted = 0;
    let skipped = 0;
    
    for (const row of transformedData) {
      try {
        const { error: upsertError } = await targetClient
          .from(tableName)
          .upsert(row, { onConflict: 'instance_id,dataset_id' });
        
        if (upsertError) {
          // If upsert fails, try update then insert
          const { data: existing, error: checkError } = await targetClient
            .from(tableName)
            .select('instance_id, dataset_id')
            .eq('instance_id', row.instance_id)
            .eq('dataset_id', row.dataset_id)
            .single();
          
          if (existing) {
            // Update existing
            const { error: updateError } = await targetClient
              .from(tableName)
              .update(row)
              .eq('instance_id', row.instance_id)
              .eq('dataset_id', row.dataset_id);
            
            if (updateError) {
              console.warn(`   ⚠️  Error updating record: ${updateError.message}`);
              skipped++;
              continue;
            }
          } else {
            // Insert new
            const { error: insertError } = await targetClient
              .from(tableName)
              .insert(row);
            
            if (insertError) {
              console.warn(`   ⚠️  Error inserting record: ${insertError.message}`);
              skipped++;
              continue;
            }
          }
        }
        upserted++;
      } catch (err) {
        console.warn(`   ⚠️  Error processing record: ${err.message}`);
        skipped++;
      }
    }
    
    if (skipped > 0) {
      console.log(`   ⚠️  Skipped ${skipped} records (duplicates or errors)`);
    }
    
    console.log(`   ✅ Migrated ${upserted} records to target`);
    return { migrated: upserted, skipped: skipped > 0 };
    
  } catch (error) {
    console.error(`   ❌ Error migrating ${tableName}:`, error.message);
    throw error;
  }
}

// Migrate hazard events metadata (scoring config is in metadata JSONB)
async function migrateHazardEventsMetadata() {
  console.log(`\n📦 Migrating hazard_events metadata (scoring config)...`);
  
  try {
    // Get hazard events with metadata containing scoring config
    const { data: hazardEvents, error: fetchError } = await sourceClient
      .from('hazard_events')
      .select('id, metadata')
      .not('metadata', 'is', null)
      .or('metadata->score_config.not.is.null,metadata->category_weight.not.is.null');
    
    if (fetchError) throw fetchError;
    
    if (!hazardEvents || hazardEvents.length === 0) {
      console.log(`   ℹ️  No hazard events with scoring config found, skipping...`);
      return { migrated: 0, skipped: false };
    }
    
    console.log(`   Found ${hazardEvents.length} hazard events with scoring config`);
    
    // Update each hazard event in target
    let updated = 0;
    for (const event of hazardEvents) {
      // Get current metadata from target
      const { data: targetEvent, error: getError } = await targetClient
        .from('hazard_events')
        .select('id, metadata')
        .eq('id', event.id)
        .single();
      
      if (getError) {
        console.warn(`   ⚠️  Hazard event ${event.id} not found in target, skipping...`);
        continue;
      }
      
      // Merge metadata (preserve existing, add/update scoring config)
      const mergedMetadata = {
        ...(targetEvent.metadata || {}),
        ...(event.metadata || {}),
      };
      
      // Preserve scoring config from source
      if (event.metadata?.score_config) {
        mergedMetadata.score_config = event.metadata.score_config;
      }
      if (event.metadata?.category_weight !== undefined) {
        mergedMetadata.category_weight = event.metadata.category_weight;
      }
      
      const { error: updateError } = await targetClient
        .from('hazard_events')
        .update({ metadata: mergedMetadata })
        .eq('id', event.id);
      
      if (updateError) {
        console.warn(`   ⚠️  Error updating hazard event ${event.id}:`, updateError.message);
        continue;
      }
      
      updated++;
    }
    
    console.log(`   ✅ Updated ${updated} hazard events with scoring config`);
    return { migrated: updated, skipped: false };
    
  } catch (error) {
    console.error(`   ❌ Error migrating hazard events metadata:`, error.message);
    throw error;
  }
}

// Main migration function
async function migrate() {
  console.log('🚀 Starting scoring configuration migration...');
  console.log(`   Source: ${sourceUrl}`);
  console.log(`   Target: ${targetUrl}`);
  
  const results = {
    instance_dataset_config: { migrated: 0, skipped: false },
    instance_scoring_weights: { migrated: 0, skipped: false },
    hazard_events_metadata: { migrated: 0, skipped: false },
  };
  
  try {
    // Migrate instance_dataset_config
    results.instance_dataset_config = await migrateTable('instance_dataset_config');
    
    // Migrate instance_scoring_weights
    results.instance_scoring_weights = await migrateTable('instance_scoring_weights');
    
    // Migrate hazard events metadata
    results.hazard_events_metadata = await migrateHazardEventsMetadata();
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`instance_dataset_config: ${results.instance_dataset_config.migrated} records${results.instance_dataset_config.skipped ? ' (skipped - table not found)' : ''}`);
    console.log(`instance_scoring_weights: ${results.instance_scoring_weights.migrated} records${results.instance_scoring_weights.skipped ? ' (skipped - table not found)' : ''}`);
    console.log(`hazard_events_metadata: ${results.hazard_events_metadata.migrated} records updated${results.hazard_events_metadata.skipped ? ' (skipped)' : ''}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const totalMigrated = 
      results.instance_dataset_config.migrated +
      results.instance_scoring_weights.migrated +
      results.hazard_events_metadata.migrated;
    
    console.log(`\n✅ Migration complete! Total records migrated: ${totalMigrated}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
