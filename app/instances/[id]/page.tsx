'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [affected, setAffected] = useState<string[]>([]);
  const [mostAffected, setMostAffected] = useState<any[]>([]);
  const [mapLocked, setMapLocked] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: instanceData } = await supabase
        .from('instances')
        .select('*')
        .eq('id', params.id)
        .single();

      if (instanceData) {
        setInstance(instanceData);
        setAffected(instanceData.admin_scope || []);
      }

      const { data: scoreData, error } = await supabase.rpc('score_instance_overall', {
        in_instance_id: params.id,
      });
      if (error) console.error('RPC error:', error);
      else setSummary(scoreData?.summary);

      const { data: most } = await supabase
        .from('v_instance_admin_scores_geojson')
        .select('admin_pcode, name, avg_score, color_hex')
        .eq('instance_id', params.id)
        .order('avg_score', { ascending: false })
        .limit(5);
      setMostAffected(most || []);
      setLoading(false);
    };
    load();
  }, [params.id]);

  if (loading) return <div className="p-6 text-gray-500">Loading instance...</div>;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">{instance?.name || 'Instance'}</h1>
        <Button onClick={() => console.log('Open calibration modal')} size="sm">
          Calibration
        </Button>
      </div>

      {/* Scoring Diagnostics Panel */}
      <div className="bg-gray-50 p-3 rounded-lg border text-sm grid grid-cols-2 md:grid-cols-3 gap-2">
        <div><strong>Scored ADM3:</strong> {summary?.scored_count ?? '–'}</div>
        <div><strong>Affected Areas:</strong> {summary?.affected_count ?? '–'}</div>
        <div><strong>Out of Scope:</strong> {summary?.out_of_scope ?? '–'}</div>
        <div><strong>Score Range:</strong> {summary?.min_score} – {summary?.max_score}</div>
        <div><strong>Avg Score:</strong> {summary?.avg_score}</div>
        <div><strong>Admin Scope:</strong> {affected.join(', ') || 'N/A'}</div>
      </div>

      {/* Summary Analytics */}
      <div className="bg-white rounded-lg shadow p-3 text-sm border">
        <h2 className="text-base font-medium mb-2">Summary Analytics</h2>
        <p>
          Average Score: <strong>{summary?.avg_score ?? '–'}</strong> | Range: {summary?.min_score}–{summary?.max_score}
        </p>
        <p>Total Areas Scored: {summary?.scored_count ?? '–'}</p>
      </div>

      {/* Map */}
      <div className="relative border rounded-lg overflow-hidden">
        <Map
          instanceId={params.id}
          locked={mapLocked}
          affected={affected}
        />
        <div className="absolute top-2 right-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setMapLocked(!mapLocked)}
          >
            {mapLocked ? 'Unlock Zoom' : 'Lock Zoom'}
          </Button>
        </div>
      </div>

      {/* Category Breakdown Placeholder */}
      <div className="bg-white p-3 rounded-lg shadow border">
        <h3 className="text-base font-medium mb-2">Category Breakdown</h3>
        <p className="text-gray-500 text-sm">
          Tree view of categories and datasets will render here (with weighting and ranges).
        </p>
      </div>

      {/* Most Affected Areas */}
      <div className="bg-white p-3 rounded-lg shadow border">
        <h3 className="text-base font-medium mb-2">Most Affected Areas</h3>
        {mostAffected.map((a, i) => (
          <div key={i} className="flex justify-between border-b py-1 text-sm">
            <span>{a.name || a.admin_pcode}</span>
            <span className="font-medium">{a.avg_score?.toFixed(2)}</span>
          </div>
        ))}
        {mostAffected.length >= 5 && (
          <div className="text-right mt-2">
            <button className="text-blue-600 text-xs hover:underline">Show More</button>
          </div>
        )}
      </div>
    </div>
  );
}
