import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass row limits
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const datasetId = searchParams.get('datasetId');
  const type = searchParams.get('type') || 'numeric';

  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId required' }, { status: 400 });
  }

  const tableName = type === 'numeric' ? 'dataset_values_numeric' : 'dataset_values_categorical';

  try {
    // Fetch all values with pagination using service key
    const pageSize = 10000;
    let allValues: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await supabase
        .from(tableName)
        .select('admin_pcode, value')
        .eq('dataset_id', datasetId)
        .range(from, to);

      if (error) {
        console.error('Error fetching dataset values:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data && data.length > 0) {
        allValues = allValues.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    return NextResponse.json({ values: allValues, count: allValues.length });
  } catch (error: any) {
    console.error('Error in datasetValues API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
