'use client';

import { createClient as createSBClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** Preferred: create a (cached) browser Supabase client */
export function createClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  cached = createSBClient(url, anon, { auth: { persistSession: true } });
  return cached;
}

/** Back-compat export for places importing { supabase } */
export const supabase = createClient();

/** Default export — do not re-export createClient to avoid duplicate bindings */
export default supabase;

/**
 * Helper function to get datasets filtered by country
 * @param countryId - UUID of the country
 * @param additionalFilters - Optional additional Supabase query filters
 */
export async function getDatasets(countryId: string, additionalFilters?: any) {
  const client = createClient();
  let query = client
    .from('datasets')
    .select('*')
    .eq('country_id', countryId);
  
  if (additionalFilters) {
    query = additionalFilters(query);
  }
  
  return query;
}

/**
 * Helper function to get instances filtered by country
 * @param countryId - UUID of the country
 * @param additionalFilters - Optional additional Supabase query filters
 */
export async function getInstances(countryId: string, additionalFilters?: any) {
  const client = createClient();
  let query = client
    .from('instances')
    .select('*')
    .eq('country_id', countryId);
  
  if (additionalFilters) {
    query = additionalFilters(query);
  }
  
  return query;
}

/**
 * Helper function to get admin boundaries filtered by country
 * @param countryId - UUID of the country
 * @param additionalFilters - Optional additional Supabase query filters
 */
export async function getAdminBoundaries(countryId: string, additionalFilters?: any) {
  const client = createClient();
  let query = client
    .from('admin_boundaries')
    .select('*')
    .eq('country_id', countryId);
  
  if (additionalFilters) {
    query = additionalFilters(query);
  }
  
  return query;
}
