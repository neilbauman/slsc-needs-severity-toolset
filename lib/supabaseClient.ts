'use client';

import { createClient as createSBClient } from '@supabase/supabase-js';

// Singleton Supabase instance (browser-safe)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let supabaseInstance: ReturnType<typeof createSBClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createSBClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true },
    });
  }
  return supabaseInstance;
}

// Named + default exports for compatibility
export const supabase = getSupabaseClient();
export default supabase;
