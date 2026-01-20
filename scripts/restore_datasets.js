#!/usr/bin/env node

/**
 * Restore Building Typology Datasets from Source to Target
 * 
 * This script exports data from the source database and imports it into the target database.
 * 
 * Usage: node restore_datasets.js
 * 
 * Requires: npm install node-fetch (or use Node 18+ with built-in fetch)
 */

const fetch = require('node-fetch');

// Configuration
const SOURCE_PROJECT_ID = 'vxoyzgsxiqwpufrtnerf';
const SOURCE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4b3l6Z3N4aXF3cHVmcnRuZXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjU3ODAyMiwiZXhwIjoyMDc4MTU0MDIyfQ.fdRNdgzaHLeXYabs0kFG2BcMPG6kEY9W1Vy6-5YBsBc';

const TARGET_PROJECT_ID = 'yzxmxwppzpwfolkdiuuo';
const TARGET_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6eG14d3BwenB3Zm9sa2RpdXVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQyMjk3NSwiZXhwIjoyMDgzOTk4OTc1fQ.vW5z5udhwZOW367t3m3y9MOhnCpRN6SiQe1wwJw9xCE';

const DATASETS = [
  {
    name: 'Building Typologies (adm3)',
    sourceId: 'a017b4a4-b958-4ede-ab9d-8f4124188d4c',
    targetName: 'Building Typologies (adm3)'
  },
  {
    name: 'Building Typology',
    sourceId: '59abe182-73c6-47f5-8e7b-752a1168bf06',
    targetName: 'Building Typology'
  }
];

// Helper function to execute SQL via Supabase REST API
async function executeSQL(projectId, serviceKey, sql) {
  const url = `https://${projectId}.supabase.co/rest/v1/rpc/execute_sql`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      // Try direct PostgREST query instead
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`SQL execution error: ${error.message}`);
    throw error;
  }
}

// Helper function to query data via PostgREST
async function queryData(projectId, serviceKey, table, filters) {
  const url = `https://${projectId}.supabase.co/rest/v1/${table}`;
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    params.append(key, `eq.${value}`);
  });
  params.append('select', '*');

  const response = await fetch(`${url}?${params}`, {
    method: 'GET',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

// Helper function to insert data via PostgREST
async function insertData(projectId, serviceKey, table, data) {
  const url = `https://${projectId}.supabase.co/rest/v1/${table}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation,resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
}

// Main restoration function
async function restoreDatasets() {
  console.log('🚀 Starting dataset restoration...\n');

  for (const dataset of DATASETS) {
    console.log(`\n📦 Processing: ${dataset.name}`);
    console.log(`   Source ID: ${dataset.sourceId}`);

    try {
      // Step 1: Find target dataset ID
      console.log('   🔍 Finding target dataset...');
      const targetDatasets = await queryData(
        TARGET_PROJECT_ID,
        TARGET_SERVICE_KEY,
        'datasets',
        { name: dataset.targetName }
      );

      if (!targetDatasets || targetDatasets.length === 0) {
        console.log(`   ⚠️  Target dataset "${dataset.targetName}" not found. Skipping.`);
        continue;
      }

      const targetDatasetId = targetDatasets[0].id;
      console.log(`   ✓ Found target dataset ID: ${targetDatasetId}`);

      // Step 2: Export from source (try raw table first, then cleaned)
      console.log('   📤 Exporting from source database...');
      let sourceData = [];

      // Try raw table first
      try {
        sourceData = await queryData(
          SOURCE_PROJECT_ID,
          SOURCE_SERVICE_KEY,
          'dataset_values_categorical_raw',
          { dataset_id: dataset.sourceId }
        );
        console.log(`   ✓ Found ${sourceData.length} rows in raw table`);
      } catch (error) {
        console.log(`   ⚠️  Raw table query failed: ${error.message}`);
      }

      // If raw is empty, try cleaned table
      if (!sourceData || sourceData.length === 0) {
        try {
          sourceData = await queryData(
            SOURCE_PROJECT_ID,
            SOURCE_SERVICE_KEY,
            'dataset_values_categorical',
            { dataset_id: dataset.sourceId }
          );
          console.log(`   ✓ Found ${sourceData.length} rows in cleaned table`);
        } catch (error) {
          console.log(`   ❌ Cleaned table query failed: ${error.message}`);
          throw error;
        }
      }

      if (!sourceData || sourceData.length === 0) {
        console.log(`   ⚠️  No data found in source. Skipping.`);
        continue;
      }

      // Step 3: Prepare data for import
      console.log('   🔄 Preparing data for import...');
      const importData = sourceData.map(row => ({
        dataset_id: targetDatasetId,
        admin_pcode: row.admin_pcode,
        category: row.category,
        value: row.value
      }));

      // Step 4: Clear existing raw data in target
      console.log('   🗑️  Clearing existing raw data in target...');
      try {
        // Delete existing data (we'll use SQL for this)
        const deleteSQL = `
          DELETE FROM dataset_values_categorical_raw 
          WHERE dataset_id = '${targetDatasetId}';
        `;
        await executeSQL(TARGET_PROJECT_ID, TARGET_SERVICE_KEY, deleteSQL);
        console.log('   ✓ Cleared existing data');
      } catch (error) {
        console.log(`   ⚠️  Could not clear existing data: ${error.message}`);
      }

      // Step 5: Import to target (batch insert)
      console.log(`   📥 Importing ${importData.length} rows to target...`);
      const batchSize = 1000;
      let imported = 0;

      for (let i = 0; i < importData.length; i += batchSize) {
        const batch = importData.slice(i, i + batchSize);
        try {
          await insertData(
            TARGET_PROJECT_ID,
            TARGET_SERVICE_KEY,
            'dataset_values_categorical_raw',
            batch
          );
          imported += batch.length;
          console.log(`   ✓ Imported batch: ${imported}/${importData.length} rows`);
        } catch (error) {
          console.log(`   ⚠️  Batch import error: ${error.message}`);
          // Try individual inserts
          for (const row of batch) {
            try {
              await insertData(
                TARGET_PROJECT_ID,
                TARGET_SERVICE_KEY,
                'dataset_values_categorical_raw',
                [row]
              );
              imported++;
            } catch (err) {
              console.log(`   ⚠️  Failed to import row: ${err.message}`);
            }
          }
        }
      }

      console.log(`   ✓ Successfully imported ${imported} rows`);

      // Step 6: Run cleaning function
      console.log('   🔧 Running cleaning function...');
      try {
        const cleanSQL = `
          SELECT * FROM restore_dataset_from_raw('${targetDatasetId}');
        `;
        const cleanResult = await executeSQL(TARGET_PROJECT_ID, TARGET_SERVICE_KEY, cleanSQL);
        console.log('   ✓ Cleaning completed');
        console.log('   📊 Results:', JSON.stringify(cleanResult, null, 2));
      } catch (error) {
        console.log(`   ⚠️  Cleaning failed: ${error.message}`);
        console.log('   💡 You may need to run the cleaning function manually via SQL Editor');
      }

      console.log(`   ✅ Successfully restored: ${dataset.name}\n`);

    } catch (error) {
      console.error(`   ❌ Error processing ${dataset.name}:`, error.message);
      console.error(error);
    }
  }

  console.log('\n🎉 Restoration process completed!');
}

// Run the restoration
restoreDatasets().catch(console.error);
