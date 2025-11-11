// Minimal browser-side Supabase client with named export `createClient`
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  // Fail fast in build/runtime if env is missing
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export function createClient() {
  return createSupabaseClient(url, key);
}
