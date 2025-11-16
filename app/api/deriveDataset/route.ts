import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    // Explicit cast for both parameters: avoids "never" type issue
    const { data, error } = await (supabase as any).rpc('derive_dataset', body);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Error in deriveDataset API:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
