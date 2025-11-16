'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';
import Link from 'next/link';

// --- Dynamic imports for Leaflet ---
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });
import 'leaflet/dist/leaflet.css';

// --- Types ---
interface Instance {
  id: string;
  name: string;
  description?: string | null;
  admin_scope: string[] | null;
  created_at?: string | null;
}

interface Adm3Feature {
  type: string;
  features: any[];
}

export default function InstanceDashboard({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [adm3, setAdm3] = useState<Adm3Feature | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- Load Instance ---
  const loadInstance = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instances')
      .select('id,name,description,admin_scope,created_at')
      .eq('id', params.id)
      .single();
    if (error) console.error(error);
    setInstance(data as Instance);
    setLoading(false);
  }, [params.id, supabase]);

  // --- Load ADM3 Boundaries (filtered by admin_scope) ---
  const loadAdm3 = useCallback(async (scope: string[]) => {
    if (!scope || scope.length === 0) return;
    const { data, error } = await supabase.rpc('get_adm3_scores', {
      p_admin_scope: scope,
    });
    if (error) {
      console.error('Failed to fetch ADM3 data', error);
      return;
    }
    setAdm3(data);
  }, [supabase]);

  // --- Load Scores ---
  const loadScores = useCallback(async () => {
    const { data, error } = await supabase
      .from('scored_instance_values')
      .select('admin_pcode, score')
      .eq('instance_id', params.id);
    if (error) {
      console.error('Error loading scores', error);
      return;
    }
    const map: Record<string, number> = {};
    for (const row of data || []) map[row.admin_pcode] = row.score;
    setScores(map);
  }, [params.id, supabase]);

  // --- Recompute Scores ---
  const recomputeScores = async () => {
    setRefreshing(true);
    const { error: err1 } = await supabase.rpc('score_framework_aggregate', { p_instance_id: params.id });
    const { error: err2 } = await supabase.rpc('score_instance_overall', { p_instance_id: params.id });
    if (err1 || err2) console.error('Scoring error', err1 || err2);
    await loadScores();
    setRefreshing(false);
  };

  // --- Effects ---
  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  useEffect(() => {
    if (instance?.admin_scope) {
      loadAdm3(instance.admin_scope);
      loadScores();
    }
  }, [instance, loadAdm3, loadScores]);

  // --- Coloring by score (1→green → 5→red) ---
  const getColor = (score: number) => {
    if (!score) return '#ccc';
    const colors = ['#2ecc71', '#a2d96d', '#f9d057', '#f29e2e', '#d7191c'];
    return colors[Math.min(4, Math.max(0, Math.round(score - 1)))];
  };

  const style = (feature: any) => {
    const code = feature.properties.admin_pcode;
    const score = scores[code] || 0;
    return {
      color: '#999',
      weight: 1,
      fillColor: getColor(score),
      fillOpacity: 0.7,
    };
  };

  // --- Render ---
  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--gsc-blue)' }}>
            {instance ? instance.name : 'Loading...'}
          </h1>
          {instance?.description && <p className="text-sm text-gray-500">{instance.description}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setShowAreaModal(true)}>
            Define Affected Area
          </button>
          <button className="btn btn-primary" onClick={recomputeScores} disabled={refreshing}>
            {refreshing ? 'Recomputing…' : 'Recompute Scores'}
          </button>
          <Link href="/instances" className="btn btn-secondary">Back</Link>
        </div>
      </header>

      {/* Map Section */}
      <div className="card p-4">
        <h2 className="text-base font-semibold mb-2">Geographic Overview</h2>
        {!adm3 && <div className="text-sm text-gray-600">Loading map data…</div>}
        {adm3 && (
          <MapContainer
            style={{ height: '70vh', width: '100%' }}
            zoom={7}
            center={[12.8797, 121.7740]} // Philippines center
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
