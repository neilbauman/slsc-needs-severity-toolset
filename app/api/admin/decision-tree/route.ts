import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

type LookupRow = { p1: number; p2: number; p3: number; score: number };

async function requireSiteAdmin() {
  const headersList = await headers();
  const currentUserId = headersList.get('x-user-id');
  if (!currentUserId) {
    return { error: NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 }) };
  }
  const serverClient = createServerClient();
  const { data: userCountries, error: userCountriesError } = await serverClient
    .from('user_countries')
    .select('role')
    .eq('user_id', currentUserId)
    .eq('role', 'admin')
    .limit(1);

  if (userCountriesError || !userCountries || userCountries.length === 0) {
    return { error: NextResponse.json({ success: false, error: 'Only site administrators can manage the decision tree' }, { status: 403 }) };
  }
  return { serverClient };
}

export async function GET() {
  try {
    const result = await requireSiteAdmin();
    if ('error' in result) return result.error;
    const { serverClient } = result;

    const { data, error } = await serverClient
      .from('ssc_decision_tree_lookup')
      .select('p1, p2, p3, score')
      .order('p1', { ascending: true })
      .order('p2', { ascending: true })
      .order('p3', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, rows: data || [] });
  } catch (err: any) {
    console.error('Error fetching decision tree:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch decision tree' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await requireSiteAdmin();
    if ('error' in result) return result.error;
    const { serverClient } = result;

    const body = await request.json();
    const rows = body?.rows as LookupRow[] | undefined;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Body must include rows: [{ p1, p2, p3, score }, ...]' }, { status: 400 });
    }

    for (const row of rows) {
      const p1 = Number(row.p1);
      const p2 = Number(row.p2);
      const p3 = Number(row.p3);
      const score = Number(row.score);
      if (!Number.isInteger(p1) || !Number.isInteger(p2) || !Number.isInteger(p3) || !Number.isInteger(score) ||
          score < 1 || score > 5 || p1 < 1 || p1 > 5 || p2 < 1 || p2 > 4 || p3 < 1 || p3 > 4) {
        return NextResponse.json(
          { success: false, error: `Invalid row: p1(1-5), p2(1-4), p3(1-4), score(1-5). Got p1=${p1} p2=${p2} p3=${p3} score=${score}` },
          { status: 400 }
        );
      }
      const { error: updateError } = await serverClient
        .from('ssc_decision_tree_lookup')
        .update({ score })
        .eq('p1', p1)
        .eq('p2', p2)
        .eq('p3', p3);

      if (updateError) throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error updating decision tree:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to update decision tree' }, { status: 500 });
  }
}
