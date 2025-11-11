'use client';

import { createClient as createSBClient } from '@supabase/supabase-js';

let cached:any;

export function createClient(){
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  cached = createSBClient(url, anon, { auth: { persistSession: true } });
  return cached;
}
