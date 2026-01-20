/**
 * Migrate geometry data from source to target Supabase database
 * 
 * This script transfers geometry data from admin_boundaries in the source
 * to admin_boundaries in the target, matching by admin_pcode.
 * 
 * Usage:
 *   SOURCE_SUPABASE_URL=https://... SOURCE_SUPABASE_KEY=... \
 *   TARGET_SUPABASE_URL=https://... TARGET_SUPABASE_KEY=... \
 *   node scripts/migrate-geometry-data.js
 */

const { createClient } = require('@supabase/supabase-js');

const sourceUrl = process.env.SOURCE_SUPABASE_URL || 'https://vxoyzgsxiqwpufrtnerf.supabase.co';
const sourceKey = process.env.SOURCE_SUPABASE_KEY || process.env.SOURCE_SUPABASE_ANON_KEY;
const targetUrl = process.env.TARGET_SUPABASE_URL || 'https://yzxmxwppzpwfolkdiuuo.supabase.co';
const targetKey = process.env.TARGET_SUPABASE_KEY || process.env.TARGET_SUPABASE_ANON_KEY;

if (!sourceKey || !targetKey) {
  console.error('❌ Error: Missing Supabase keys');
  console.error('Please set SOURCE_SUPABASE_KEY and TARGET_SUPABASE_KEY environment variables');
  process.exit(1);
}

const sourceClient = createClient(sourceUrl, sourceKey);
const targetClient = createClient(targetUrl, targetKey);

async function detectGeometryColumn(client, tableName = 'admin_boundaries') {
  // Check which geometry column exists
  const { data, error } = await client
    .from('_realtime')
    .select('*')
    .limit(0);
  
  // Try to query with both column names to see which exists
  // We'll use a different approach - query information_schema via RPC if available
  // Or we can try both and see which works
  
  // For now, let's try to detect by attempting a query
  try {
    const testGeom = await client
      .from(tableName)
      .select('geom')
      .limit(1);
    if (!testGeom.error) {
      return 'geom';
    }
  } catch (e) {
    // geom doesn't exist
  }
  
  try {
    const testGeometry = await client
      .from(tableName)
      .select('geometry')
      .limit(1);
    if (!testGeometry.error) {
      return 'geometry';
    }
  } catch (e) {
    // geometry doesn't exist
  }
  
  return null;
}

async function migrateGeometry() {
  console.log('🔄 Starting geometry data migration...\n');
  
  // Detect geometry columns in both databases
  console.log('📊 Detecting geometry columns...');
  const sourceGeomCol = await detectGeometryColumn(sourceClient);
  const targetGeomCol = await detectGeometryColumn(targetClient);
  
  console.log(`   Source geometry column: ${sourceGeomCol || 'NOT FOUND'}`);
  console.log(`   Target geometry column: ${targetGeomCol || 'NOT FOUND'}\n`);
  
  if (!sourceGeomCol) {
    console.error('❌ Error: No geometry column found in source database');
    return;
  }
  
  if (!targetGeomCol) {
    console.error('❌ Error: No geometry column found in target database');
    console.error('   You may need to add the geometry column first');
    return;
  }
  
  // Fetch all admin_boundaries with geometry from source
  // Note: Source database doesn't have country_id column (single-country)
  // Supabase client should automatically serialize PostGIS geometry to GeoJSON
  console.log('📥 Fetching geometry data from source...');
  
  // Fetch all rows with pagination
  let sourceData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: pageData, error: pageError } = await sourceClient
      .from('admin_boundaries')
      .select(`admin_pcode, ${sourceGeomCol}`)
      .not(sourceGeomCol, 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (pageError) {
      console.error('❌ Error fetching source data:', pageError);
      break;
    }
    
    if (!pageData || pageData.length === 0) {
      hasMore = false;
      break;
    }
    
    sourceData = sourceData.concat(pageData);
    console.log(`   Fetched ${sourceData.length} rows so far...`);
    
    // If we got fewer rows than pageSize, we've reached the end
    if (pageData.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }
  
  if (!sourceData || sourceData.length === 0) {
    console.log('⚠️  No geometry data found in source database');
    return;
  }
  
  console.log(`   Found ${sourceData.length} rows with geometry\n`);
  
  // Get target country_id for Philippines (we'll need to match by country)
  console.log('🌍 Getting target country ID...');
  const { data: targetCountries, error: countryError } = await targetClient
    .from('countries')
    .select('id, name')
    .ilike('name', 'philippines')
    .limit(1);
  
  if (countryError || !targetCountries || targetCountries.length === 0) {
    console.error('❌ Error: Could not find Philippines country in target database');
    return;
  }
  
  const targetCountryId = targetCountries[0].id;
  console.log(`   Target country ID: ${targetCountryId}\n`);
  
  // Update target admin_boundaries with geometry data
  console.log('📤 Updating target database with geometry data...');
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  // Process in batches to avoid overwhelming the database
  const batchSize = 100;
  for (let i = 0; i < sourceData.length; i += batchSize) {
    const batch = sourceData.slice(i, i + batchSize);
    
    for (const row of batch) {
      try {
        // Find matching row in target by admin_pcode and country
        const { data: targetRow, error: findError } = await targetClient
          .from('admin_boundaries')
          .select('admin_pcode')
          .eq('admin_pcode', row.admin_pcode)
          .eq('country_id', targetCountryId)
          .limit(1)
          .single();
        
        if (findError || !targetRow) {
          skipped++;
          continue;
        }
        
        // Update with geometry using RPC function
        // The RPC function will convert GeoJSON to PostGIS geometry
        const geometryData = row.geometry || row[sourceGeomCol];
        
        if (!geometryData) {
          skipped++;
          continue;
        }
        
        // Ensure geometryData is a JSON object (not string)
        let geojsonData = geometryData;
        if (typeof geometryData === 'string') {
          try {
            geojsonData = JSON.parse(geometryData);
          } catch (e) {
            console.warn(`   ⚠️  Error parsing geometry for ${row.admin_pcode}: ${e.message}`);
            errors++;
            continue;
          }
        }
        
        // Use RPC function to update geometry (converts GeoJSON to PostGIS)
        const { data: rpcResult, error: updateError } = await targetClient.rpc('update_admin_boundary_geometry', {
          p_admin_pcode: row.admin_pcode,
          p_country_id: targetCountryId,
          p_geojson: geojsonData,
          p_geom_col: targetGeomCol
        });
        
        if (updateError) {
          console.warn(`   ⚠️  Error updating ${row.admin_pcode}: ${updateError.message}`);
          errors++;
        } else {
          updated++;
        }
      } catch (err) {
        console.warn(`   ⚠️  Error processing ${row.admin_pcode}: ${err.message}`);
        errors++;
      }
    }
    
    // Progress update
    if ((i + batchSize) % 500 === 0 || i + batchSize >= sourceData.length) {
      console.log(`   Progress: ${Math.min(i + batchSize, sourceData.length)}/${sourceData.length} processed`);
    }
  }
  
  console.log('\n✅ Migration complete!');
  console.log(`   Updated: ${updated} rows`);
  console.log(`   Skipped: ${skipped} rows (no matching admin_pcode in target)`);
  console.log(`   Errors: ${errors} rows`);
}

// Run migration
migrateGeometry()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
