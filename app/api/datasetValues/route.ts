import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const datasetId = searchParams.get('datasetId');
  const type = searchParams.get('type') || 'numeric';

  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    // Use direct REST API call instead of JS client (debugging connection issue)
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_dataset_values_json`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_dataset_id: datasetId,
        p_type: type
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: errorText,
        status: response.status,
        supabaseUrl: supabaseUrl?.substring(0, 40) + '...',
        datasetId,
        type
      }, { status: 500 });
    }

    const values = await response.json();
    return NextResponse.json({ 
      values, 
      count: Array.isArray(values) ? values.length : 0,
      datasetId,
      type,
      supabaseUrl: supabaseUrl?.substring(0, 40) + '...'
    });
  } catch (error: any) {
    console.error('Error in datasetValues API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
