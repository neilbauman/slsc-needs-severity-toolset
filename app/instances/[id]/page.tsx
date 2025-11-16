'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });

interface Instance {
  id: string;
  name: string;
  description?: string | null;
  admin_scope: string[] | null;
  created_at?: string | null;
}

export default function InstanceDashboard({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [adm3, setAdm3] = useState<any | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- Load instance ---
  const loadInstance = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instances')
      .select('id,name,description,admin_scope,created_at')
      .eq('id', params.id)
      .single();
    if (error) console.error(error);
    setInstance(data);
    setLoading(false);
  }, [params.id, supabase]);

  // --- Load ADM3 geometry and metadata ---
  const loadAdm3 = useCallback(
    async (instanceId: string, adminScope?: string[]) => {
      // 1. Try scores first
      const { data, error } = await supabase.rpc('get_adm3_scores', { in_instance: instanceId });
      if (!error && data) {
        setAdm3(data);
        return;
      }

      console.warn('No ADM3 scores found — loading fallback ADM3 boundaries');
      if (!adminScope || adminScope.length === 0) return;

      // 2. Fallback: use admin_boundaries for the affected ADM2 (ADM3 level only)
      const adm2 = adminScope[adminScope.length - 1];
      const { data: rows, error: e2 } = await supabase
        .from('admin_boundaries')
        .select('name, admin_pcode, parent_pcode, ST_AsGeoJSON(geom) AS geom_json')
        .eq('admin_level', 'ADM3')
        .or(`parent_pcode.ilike.${adm2}%,admin_pcode.ilike.${adm2}%`);

      if (e2) {
        console.error('Failed to load fallback ADM3 boundaries:', e2);
        return;
      }

      // Transform PostGIS to GeoJSON FeatureCollection
      const fc = {
        type: 'FeatureCollection',
        features: (rows || []).map((row: any) => ({
          type: 'Feature',
          geometry: JSON.parse(row.geom_json),
          properties: {
            name: row.name,
            pcode: row.admin_pcode,
          },
        })),
      };
      setAdm3(fc);
    },
    [supabase]
  );

  // --- Load scores ---
  const loadScores = useCallback(
    async (instanceId: string) => {
      const { data, error } = await supabase
        .from('scored_instance_values')
        .select('pcode, score')
        .eq('instance_id', instanceId);

      if (error) {
        console.error('Error loading scores', error);
        return;
      }
      const scoreMap: Record<string, number> = {};
      for (const row of data || []) {
        scoreMap[row.pcode] = Number(row.score);
      }
      setScores(scoreMap);
    },
    [supabase]
  );

  // --- Recompute scores ---
  const recomputeScores = async () => {
    setRefreshing(true);
    const { error: e1 } = await supabase.rpc('score_framework_aggregate', { p_instance_id: params.id });
    const { error: e2 } = await supabase.rpc('score_instance_overall', { p_instance_id: params.id });
    if (e1 || e2) console.error('Scoring recompute failed', e1 || e2);
    await loadScores(params.id);
    setRefreshing(false);
  };

  // --- Effects ---
  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  useEffect(() => {
    if (instance) {
      loadAdm3(instance.id, instance.admin_scope || []);
      loadScores(instance.id);
    }
  }, [instance, loadAdm3, loadScores]);

  // --- Color scale (1–5: green → red) ---
  const getColor = (score: number) => {
    if (!score) return '#cccccc';
    const colors = ['#2ecc71', '#a2d96d', '#f9d057', '#f29e2e', '#d7191c'];
    return colors[Math.min(4, Math.max(0, Math.round(score - 1)))];
  };

  const style = (feature: any) => {
    const code = feature.properties.pcode;
    const score = scores[code];
    return {
      color: '#555',
      weight: 1,
      fillColor: getColor(score),
      fillOpacity: 0.75,
    };
  };

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-blue-900">{instance?.name || 'Loading...'}</h1>
          {instance?.description && <p className="text-gray-500 text-sm">{instance.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAreaModal(true)} className="btn btn-secondary">
            Define Affected Area
          </button>
          <button onClick={recomputeScores} disabled={refreshing} className="btn btn-primary">
            {refreshing ? 'Recomputing…' : 'Recompute Scores'}
          </button>
          <Link href="/instances" className="btn btn-secondary">
            Back
          </Link>
        </div>
      </header>

      {/* Map Section */}
      <div className="card p-4">
        <h2 className="text-base font-semibold mb-2">Geographic Overview</h2>
        {!adm3 && <p className="text-sm text-gray-500">Loading map data…</p>}
        {adm3 && (
          <MapContainer
            style={{ height: '70vh', width: '100%' }}
            zoom={7}
            center={[10.3, 123.9]} // Central Visayas
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <GeoJSON data={adm3 as any} style={style} />
          </MapContainer>
        )}
      </div>

      {showAreaModal && instance && (
        <DefineAffectedAreaModal
          open={showAreaModal}
          instance={instance}
          onClose={() => setShowAreaModal(false)}
          onSaved={async () => {
            await loadInstance();
            setShowAreaModal(false);
          }}
        />
      )}
    </div>
  );
}
