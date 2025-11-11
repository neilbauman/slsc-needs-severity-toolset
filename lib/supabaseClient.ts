import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  console.warn(
    '⚠️ Supabase environment vars missing: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// Create a shared singleton for modules that used "import { supabase }"
export const supabase = createSupabaseClient(url, key);

// Export a function for newer modules that use "createClient()"
export function createClient() {
  return supabase;
}

export default supabase;
