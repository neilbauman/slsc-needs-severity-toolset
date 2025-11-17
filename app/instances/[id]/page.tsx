'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [scoringSummary, setScoringSummary] = useState<any>(null);
  const [lockZoom, setLockZoom] = useState(true);
  const [affectedAreas, setAffectedAreas] = useState<any[]>([]);
  const [categoryScores, setCategoryScores] = useState<any[]>([]);
  const [mostAffected, setMostAffected] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch instance and its data
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: inst } = await supabase
        .from('instances')
        .select('*')
        .eq('id', params.id)
        .single();
      setInstance(inst);

      // 1️⃣ Scoring RPC
      const { data: scoringData, error: scoringError } = await supabase.rpc(
        'score_instance_overall',
        { in_instance_id: params.id }
      );
      if (scoringError) console.error('Scoring RPC error:', scoringError);
      else setScoringSummary(scoringData?.summary ?? scoringData ?? {});

      // 2️⃣ Affected areas
      const { data: affected } = await supabase
        .from('v_instance_affected_areas')
        .select('admin_pcode, name')
        .eq('instance_id', params.id);
      setAffectedAreas(affected || []);

      // 3️⃣ Category breakdown
      const { data: cat } = await supabase
        .from('v_category_scores')
        .select('*')
        .eq('instance_id', params.id);
      setCategoryScores(cat || []);

      // 4️⃣ Most affected ADM3s
      const { data: adm3 } = await supabase
        .from('v_instance_admin_scores')
        .select('admin_pcode, name, avg_score')
        .eq('instance_id', params.id)
        .order('avg_score', { ascending: false })
        .limit(10);
      setMostAffected(adm3 || []);

      setLoading(false);
    };

    load();
  }, [params.id]);

  if (loading)
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        Loading instance data…
      </div>
    );

  return (
    <div className="space-y-4 p-4 text-gray-800 text-sm">
      <h1 className="text-lg font-semibold">
        {instance?.name || 'Unnamed Instance'}
      </h1>

      {/* ⚙️ Scoring Diagnostics */}
      <div className="bg-gray-50 border rounded p-3 space-y-1 text-xs">
        <h2 className="font-medium text-gray-700">Scoring Diagnostics</h2>
        {scoringSummary ? (
          <>
            <p>Scored ADM3: {scoringSummary.scored_count ?? '–'}</p>
            <p>Affected Areas: {scoringSummary.affected_count ?? '–'}</p>
            <p>Out of Scope: {scoringSummary.out_of_scope ?? '–'}</p>
            <p>
              Score Range:{' '}
              {scoringSummary.min_score ?? '–'} –{' '}
              {scoringSummary.max_score ?? '–'}
            </p>
            <p>Average Score: {scoringSummary.avg_score ?? '–'}</p>
          </>
        ) : (
          <p className="text-gray-400 italic">No scoring data available.</p>
        )}
      </div>

      {/* 🌍 Map Section */}
      <div className="border rounded p-2 bg-white">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-medium text-gray-700 text-sm">Affected Area Map</h2>
          <button
            onClick={() => setLockZoom(!lockZoom)}
            className="text-xs px-2 py-1 border rounded bg-gray-100 hover:bg-gray-200"
          >
            {lockZoom ? '🔒 Locked' : '🔓 Unlocked'}
          </button>
        </div>
        <Map instanceId={params.id} lockZoom={lockZoom} />
      </div>

      {/* 🧩 Category Breakdown */}
      <div className="border rounded p-3 bg-white">
        <h2 className="font-medium text-gray-700 mb-2 text-sm">
          Category Breakdown
        </h2>
        {categoryScores.length > 0 ? (
          <div className="space-y-1">
            {categoryScores.map((c, i) => (
              <div
                key={i}
                className="flex justify-between items-center border-b last:border-none pb-1"
              >
                <span className="text-gray-700">{c.category}</span>
                <span className="font-semibold">{c.avg_score?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-xs">No category data available.</p>
        )}
      </div>

      {/* 📊 Most Affected Areas */}
      <div className="border rounded p-3 bg-white">
        <h2 className="font-medium text-gray-700 mb-2 text-sm">
          Most Affected Areas
        </h2>
        {mostAffected.length > 0 ? (
          <>
            <ul className="space-y-1">
              {mostAffected.slice(0, 5).map((a, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center text-xs border-b last:border-none pb-1"
                >
                  <span>{a.name || a.admin_pcode}</span>
                  <span className="font-semibold">{a.avg_score?.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            {mostAffected.length > 5 && (
              <div className="text-center mt-2">
                <button className="text-blue-600 hover:underline text-xs">
                  Show more
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-400 text-xs">No affected areas found.</p>
        )}
      </div>

      {/* Debug Output */}
      <pre className="text-[10px] bg-gray-50 p-2 rounded border overflow-x-auto text-gray-600">
        {JSON.stringify(
          {
            instance: instance?.admin_scope,
            scoringSummary,
            affectedSample: affectedAreas?.slice(0, 3),
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}
