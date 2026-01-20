#!/usr/bin/env node
/**
 * Automated Data Migration Script
 * 
 * Migrates data from source (original Philippines) database to target (multi-country) database
 * 
 * Usage:
 *   node scripts/migrate-data.js
 * 
 * Environment Variables Required:
 *   SOURCE_SUPABASE_URL - Source database URL
 *   SOURCE_SUPABASE_KEY - Source database anon key
 *   TARGET_SUPABASE_URL - Target database URL  
 *   TARGET_SUPABASE_KEY - Target database anon key
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'blue');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

// Get environment variables
const sourceUrl = process.env.SOURCE_SUPABASE_URL;
const sourceKey = process.env.SOURCE_SUPABASE_KEY;
const targetUrl = process.env.TARGET_SUPABASE_URL;
const targetKey = process.env.TARGET_SUPABASE_KEY;

if (!sourceUrl || !sourceKey || !targetUrl || !targetKey) {
  logError('Missing required environment variables!');
  log('\nRequired environment variables:');
  log('  SOURCE_SUPABASE_URL - Source database URL');
  log('  SOURCE_SUPABASE_KEY - Source database anon key');
  log('  TARGET_SUPABASE_URL - Target database URL');
  log('  TARGET_SUPABASE_KEY - Target database anon key');
  log('\nExample:');
  log('  export SOURCE_SUPABASE_URL="https://old-project.supabase.co"');
  log('  export SOURCE_SUPABASE_KEY="your-source-anon-key"');
  log('  export TARGET_SUPABASE_URL="https://new-project.supabase.co"');
  log('  export TARGET_SUPABASE_KEY="your-target-anon-key"');
  log('  node scripts/migrate-data.js');
  process.exit(1);
}

// Create Supabase clients
const sourceClient = createClient(sourceUrl, sourceKey);
const targetClient = createClient(targetUrl, targetKey);

// Get Philippines country ID from target database
async function getPhilippinesCountryId() {
  logStep(1, 'Getting Philippines country ID from target database...');
  
  const { data, error } = await targetClient
    .from('countries')
    .select('id')
    .eq('iso_code', 'PHL')
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      logWarning('Philippines country not found. Creating it...');
      const { data: newCountry, error: createError } = await targetClient
        .from('countries')
        .insert({ iso_code: 'PHL', name: 'Philippines', active: true })
        .select('id')
        .single();
      
      if (createError) {
        logError(`Failed to create Philippines country: ${createError.message}`);
        throw createError;
      }
      
      logSuccess(`Created Philippines country with ID: ${newCountry.id}`);
      return newCountry.id;
    } else {
      logError(`Failed to get Philippines country: ${error.message}`);
      throw error;
    }
  }
  
  logSuccess(`Found Philippines country ID: ${data.id}`);
  return data.id;
}

// Get columns that exist in target table
async function getTargetColumns(tableName) {
  // Try to fetch one row to see what columns are accepted
  // We'll use a test query to get the schema
  const { data, error } = await targetClient
    .from(tableName)
    .select('*')
    .limit(0);
  
  // If table is empty, we need another way - try inserting a dummy row and catching the error
  // Actually, let's just define the known columns for each table
  const knownColumns = {
    datasets: ['id', 'name', 'description', 'admin_level', 'type', 'indicator_id', 'created_at', 'is_baseline', 'is_derived', 'metadata', 'uploaded_by', 'collected_at', 'source', 'country_id'],
    dataset_values_numeric: ['id', 'dataset_id', 'admin_pcode', 'value'],
    dataset_values_categorical: ['id', 'dataset_id', 'admin_pcode', 'category', 'value'],
    admin_boundaries: ['admin_pcode', 'admin_level', 'name', 'parent_pcode', 'geometry', 'country_id'],
    instances: ['id', 'name', 'description', 'created_at', 'created_by', 'admin_scope', 'hazard_layer_id', 'active', 'type', 'population_dataset_id', 'poverty_dataset_id', 'config', 'country_id'],
    instance_datasets: ['instance_id', 'dataset_id', 'config', 'order'],
    instance_dataset_scores: ['instance_id', 'dataset_id', 'admin_pcode', 'score', 'computed_at'],
    affected_areas: ['instance_id', 'admin_pcode', 'admin_level', 'is_affected'],
    hazard_events: ['id', 'instance_id', 'name', 'description', 'event_type', 'geometry', 'metadata', 'magnitude_field', 'created_at', 'uploaded_by', 'is_shared', 'country_id'],
    hazard_event_scores: ['hazard_event_id', 'instance_id', 'admin_pcode', 'score', 'magnitude_value', 'computed_at'],
  };
  
  return knownColumns[tableName] || [];
}

// Filter row to only include columns that exist in target
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
async function migrateTable(tableName, options = {}) {
  const {
    transform = (row) => row,
    batchSize = 1000,
    skipIfEmpty = false,
  } = options;
  
  logStep(`Migrating ${tableName}...`);
  
  // Get allowed columns for this table
  const allowedColumns = await getTargetColumns(tableName);
  if (allowedColumns.length === 0) {
    logWarning(`No known columns for ${tableName}, skipping...`);
    return { migrated: 0, skipped: 0 };
  }
  
  log(`  Using columns: ${allowedColumns.join(', ')}`);
  
  // Count total rows
  const { count, error: countError } = await sourceClient
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    logWarning(`Could not count ${tableName}: ${countError.message}`);
    return { migrated: 0, skipped: 0 };
  }
  
  if (count === 0) {
    if (skipIfEmpty) {
      logWarning(`${tableName} is empty, skipping...`);
      return { migrated: 0, skipped: 0 };
    }
    logWarning(`${tableName} is empty`);
    return { migrated: 0, skipped: 0 };
  }
  
  log(`  Found ${count} rows to migrate`);
  
  let migrated = 0;
  let skipped = 0;
  let offset = 0;
  
  while (offset < count) {
    // Fetch batch from source
    const { data: sourceData, error: fetchError } = await sourceClient
      .from(tableName)
      .select('*')
      .range(offset, offset + batchSize - 1);
    
    if (fetchError) {
      logError(`Failed to fetch ${tableName}: ${fetchError.message}`);
      throw fetchError;
    }
    
    if (!sourceData || sourceData.length === 0) {
      break;
    }
    
    // Filter and transform data
    const transformedData = sourceData.map(row => {
      const filtered = filterRow(row, allowedColumns);
      return transform(filtered);
    });
    
    // Insert into target (using upsert to handle conflicts)
    const { data: insertedData, error: insertError } = await targetClient
      .from(tableName)
      .upsert(transformedData, { onConflict: 'id' });
    
    if (insertError) {
      logError(`Failed to insert into ${tableName}: ${insertError.message}`);
      logError(`First row that failed: ${JSON.stringify(transformedData[0], null, 2)}`);
      throw insertError;
    }
    
    migrated += transformedData.length;
    offset += batchSize;
    
    log(`  Progress: ${migrated}/${count} rows migrated`);
  }
  
  logSuccess(`Migrated ${migrated} rows from ${tableName}`);
  return { migrated, skipped };
}

// Main migration function
async function migrate() {
  try {
    log('\n========================================');
    log('  Data Migration Script', 'blue');
    log('========================================\n');
    
    // Get Philippines country ID
    const phlCountryId = await getPhilippinesCountryId();
    
    // Migrate datasets
    await migrateTable('datasets', {
      transform: (row) => ({
        ...row,
        country_id: phlCountryId,
      }),
    });
    
    // Migrate dataset values (numeric)
    await migrateTable('dataset_values_numeric');
    
    // Migrate dataset values (categorical)
    await migrateTable('dataset_values_categorical');
    
    // Migrate admin boundaries
    await migrateTable('admin_boundaries', {
      transform: (row) => ({
        ...row,
        country_id: phlCountryId,
      }),
    });
    
    // Migrate instances
    await migrateTable('instances', {
      transform: (row) => ({
        ...row,
        country_id: phlCountryId,
      }),
    });
    
    // Migrate instance datasets
    await migrateTable('instance_datasets');
    
    // Migrate instance dataset scores
    await migrateTable('instance_dataset_scores');
    
    // Migrate affected areas
    await migrateTable('affected_areas');
    
    // Migrate hazard events
    await migrateTable('hazard_events', {
      transform: (row) => ({
        ...row,
        country_id: phlCountryId,
      }),
    });
    
    // Migrate hazard event scores
    await migrateTable('hazard_event_scores');
    
    log('\n========================================');
    log('  Migration Complete!', 'green');
    log('========================================\n');
    
    // Verify migration
    logStep('Verification', 'Verifying migration...');
    
    const tables = [
      'datasets',
      'dataset_values_numeric',
      'dataset_values_categorical',
      'admin_boundaries',
      'instances',
      'instance_datasets',
      'instance_dataset_scores',
      'affected_areas',
      'hazard_events',
      'hazard_event_scores',
    ];
    
    for (const table of tables) {
      const { count, error } = await targetClient
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        logSuccess(`${table}: ${count} rows`);
      } else {
        logWarning(`${table}: Could not verify (${error.message})`);
      }
    }
    
    log('\nMigration completed successfully!');
    
  } catch (error) {
    logError(`\nMigration failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrate();
