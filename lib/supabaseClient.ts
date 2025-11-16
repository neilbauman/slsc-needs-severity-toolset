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

/** Default export (kept identical) */
export default supabase;

/** 👇 Added this single line to preserve named + default imports in all environments */
export { createClient };
