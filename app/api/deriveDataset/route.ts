import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Explicitly type the RPC call to bypass "never" errors
    const { data, error } = await supabase.rpc<any>('derive_dataset', body);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Error in deriveDataset API:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
