import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const datasetId = searchParams.get('datasetId');
  const type = searchParams.get('type') || 'numeric';

  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId required' }, { status: 400 });
  }

  // Create client inside request handler to ensure fresh env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Use RPC function that returns all values as JSON (bypasses PostgREST row limit)
    const { data, error } = await supabase.rpc('get_dataset_values_json', {
      p_dataset_id: datasetId,
      p_type: type
    });

    if (error) {
      console.error('Error fetching dataset values:', error);
      return NextResponse.json({ 
        error: error.message,
        supabaseUrl: supabaseUrl?.substring(0, 30) + '...',
        datasetId,
        type
      }, { status: 500 });
    }

    // data is already a JSON array
    const values = data || [];
    return NextResponse.json({ 
      values, 
      count: values.length,
      datasetId,
      type,
      supabaseUrl: supabaseUrl?.substring(0, 40) + '...',
      rawDataType: typeof data,
      isArray: Array.isArray(data)
    });
  } catch (error: any) {
    console.error('Error in datasetValues API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
