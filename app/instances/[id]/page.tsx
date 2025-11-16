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

  // --- Load ADM3 boundaries (safe + typed) ---
  const loadAdm3 = useCallback(
    async (instanceId: string, adminScope?: string[]) => {
      try {
        // 1. Try to fetch scored ADM3 (if RPC exists)
        const { data: scored, error } = await supabase.rpc('get_adm3_scores', { in_instance: instanceId });
        if (!error && scored && scored.length > 0) {
          console.log('Loaded scored ADM3 data:', scored.length);
          setAdm3(scored);
          return;
        }

        console.warn('No ADM3 scores found — using fallback admin_boundaries');
        if (!adminScope || adminScope.length === 0) return;

        const adm2 = adminScope[adminScope.length - 1];

        // 2. Fallback: direct geometry fetch
        const { data: rows, error: e2 } = await supabase
          .from('admin_boundaries')
          .select('name, admin_pcode, parent_pcode, geom')
          .eq('admin_level', 'ADM3')
          .or(`parent_pcode.ilike.${adm2}%,admin_pcode.ilike.${adm2}%`);

        if (e2) {
          console.error('Failed to load fallback ADM3 boundaries:', e2);
          return;
        }

        if (!rows || rows.length === 0) {
          console.warn('No ADM3 boundaries matched the affected area');
          return;
        }

        // 3. Parse geometry safely
        const features = rows
          .map(r => {
            if (!r.geom) return null;
            const geometry = typeof r.geom === 'string' ? JSON.parse(r.geom) : r.geom;
            if (!geometry || !geometry.type || !geometry.coordinates) return null;

            return {
              type: 'Feature',
              geometry,
              properties: {
                name: r.name,
                pcode: r.admin_pcode,
              },
            };
          })
          .filter(Boolean);

        const fc = { type: 'FeatureCollection', features };
        console.log(`Loaded ${features.length} ADM3 polygons for fallback`);
        setAdm3(fc);
      } catch (err) {
        console.error('Unexpected error loading ADM3:', err);
      }
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
      for (const row of data || []) scoreMap[row.pcode] = Number(row.score);
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
          <MapContainer style={{ height: '70vh', width: '100%' }} zoom={7} center={[10.3, 123.9]}>
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
