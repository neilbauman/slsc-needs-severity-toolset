import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase environment variables are not configured');
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const instanceId = url.searchParams.get('instanceId');
  const hazardEventId = url.searchParams.get('hazardEventId');
  const hazardEventIdsParam = url.searchParams.get('hazardEventIds');
  const adminPcodesParam = url.searchParams.get('adminPcodes');
  const includeMagnitude = url.searchParams.get('includeMagnitude') === 'true';

  if (!instanceId) {
    return NextResponse.json(
      { error: 'instanceId is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  const hazardEventIds = new Set<string>();
  if (hazardEventId) hazardEventIds.add(hazardEventId);
  if (hazardEventIdsParam) {
    hazardEventIdsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .forEach((id) => hazardEventIds.add(id));
  }

  const adminPcodes = adminPcodesParam
    ? adminPcodesParam
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean)
    : [];

  let selectColumns = 'admin_pcode,hazard_event_id,score';
  if (includeMagnitude) {
    selectColumns += ',magnitude_value';
  }

  let query = supabase
    .from('hazard_event_scores')
    .select(selectColumns)
    .eq('instance_id', instanceId);

  const hazardIdList = Array.from(hazardEventIds);
  if (hazardIdList.length === 1) {
    query = query.eq('hazard_event_id', hazardIdList[0]);
  } else if (hazardIdList.length > 1) {
    query = query.in('hazard_event_id', hazardIdList);
  }

  if (adminPcodes.length === 1) {
    query = query.eq('admin_pcode', adminPcodes[0]);
  } else if (adminPcodes.length > 1) {
    query = query.in('admin_pcode', adminPcodes);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching hazard_event_scores via API:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json({ data: data || [] }, { headers: corsHeaders });
}


