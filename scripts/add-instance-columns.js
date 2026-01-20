#!/usr/bin/env node
/**
 * Add Missing Instance Columns
 * 
 * This script adds missing columns to the instances table using Supabase REST API
 * Note: This requires creating a temporary RPC function since DDL can't be executed via REST API directly
 */

const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const targetUrl = process.env.TARGET_SUPABASE_URL || 'https://yzxmxwppzpwfolkdiuuo.supabase.co';
const targetKey = process.env.TARGET_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6eG14d3BwenB3Zm9sa2RpdXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjI5NzUsImV4cCI6MjA4Mzk5ODk3NX0.adI6gRqCfSjtlR12511G_5wIy96nxd_uGFrJFBriF_g';

const targetClient = createClient(targetUrl, targetKey);

async function addColumns() {
  console.log('Adding missing columns to instances table...');
  console.log('Note: This requires running SQL in Supabase dashboard.');
  console.log('\nPlease run this SQL in your Supabase SQL Editor:');
  console.log('\n' + '='.repeat(60));
  console.log(`
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS admin_scope TEXT[];
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS hazard_layer_id UUID;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS population_dataset_id UUID;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS poverty_dataset_id UUID;
  `.trim());
  console.log('='.repeat(60));
  console.log('\nAfter running the SQL, the columns will be added.');
  console.log('Then we can re-migrate the instances with all data.');
}

addColumns().catch(console.error);
