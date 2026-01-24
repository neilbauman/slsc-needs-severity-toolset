import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use anon key - the RPC function is SECURITY DEFINER so it bypasses RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const datasetId = searchParams.get('datasetId');
  const type = searchParams.get('type') || 'numeric';

  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId required' }, { status: 400 });
  }

  try {
    // Use RPC function that returns all values without row limits
    const { data, error } = await supabase.rpc('get_dataset_values_all', {
      p_dataset_id: datasetId,
      p_type: type
    });

    if (error) {
      console.error('Error fetching dataset values:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ values: data || [], count: data?.length || 0 });
  } catch (error: any) {
    console.error('Error in datasetValues API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
