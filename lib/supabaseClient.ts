'use client';

import { createClient as createSBClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** Preferred: create a (cached) browser Supabase client */
export function createClient(): SupabaseClient {
  if (cached) return cached;
  
  // Check environment variables - but don't throw if they're missing during SSR
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anon) {
    // In browser, these should be available. If not, throw an error
    if (typeof window !== 'undefined') {
      console.error('[SupabaseClient] Missing environment variables:', {
        hasUrl: !!url,
        hasAnon: !!anon
      });
      throw new Error('Supabase configuration missing. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.');
    }
    // During SSR, create a minimal client that will fail gracefully
    // This prevents server crashes during SSR
    cached = createSBClient(url || 'https://placeholder.supabase.co', anon || 'placeholder', {
      auth: { persistSession: false },
    });
    return cached;
  }
  
  try {
    cached = createSBClient(url, anon, { 
      auth: { persistSession: true },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-client-info': 'slsc-toolset',
        },
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return cached;
  } catch (error) {
    console.error('[SupabaseClient] Failed to create client:', error);
    // Return a minimal client instead of throwing to prevent crashes
    cached = createSBClient(url, anon, { auth: { persistSession: false } });
    return cached;
  }
}

/** Back-compat export for places importing { supabase } */
// Initialize the client - createClient() now handles missing env vars gracefully
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
