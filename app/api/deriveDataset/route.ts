import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Explicitly tell TypeScript this is fine
    const { data, error } = await supabase.rpc('derive_dataset', body as Record<string, any>);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Error in deriveDataset API:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
