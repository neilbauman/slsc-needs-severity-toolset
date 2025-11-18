'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import InstanceDatasetConfigModal from '@/components/InstanceDatasetConfigModal';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';
import InstanceScoringModal from '@/components/InstanceScoringModal';
import ScoreLayerSelector from '@/components/ScoreLayerSelector';

// --- Dynamic Leaflet imports
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then((m) => m.GeoJSON), { ssr: false });

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [adm3Features, setAdm3Features] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [populationMetrics, setPopulationMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<string>('overall');
  const [zoomLocked, setZoomLocked] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // --- Color scale
  const colorForScore = (score: number | null) => {
    if (score === null || score === undefined) return '#ccc';
    if (score <= 1) return '#00b050';
    if (score <= 2) return '#92d050';
    if (score <= 3) return '#ffff00';
    if (score <= 4) return '#ffc000';
    return '#ff0000';
  };

  // --- Load instance metadata
  useEffect(() => {
    const loadInstance = async () => {
      const { data, error } = await supabase.from('instances').select('*').eq('id', params.id).single();
      if (!error) setInstance(data);
    };
    loadInstance();
  }, [params.id]);

  // --- Load category breakdown
  useEffect(() => {
    if (!instance?.id) return;
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from('v_category_scores')
        .select('*')
        .eq('instance_id', instance.id);
      if (!error) setCategories(data || []);
    };
    loadCategories();
  }, [instance]);

  // --- Load ADM3 polygons (default overall)
  useEffect(() => {
    if (!instance?.id) return;
    loadMapData('overall');
  }, [instance]);

  // --- Load population metrics
  useEffect(() => {
    if (!instance?.id) return;
    const loadPop = async () => {
      const { data, error } = await supabase.rpc('get_population_metrics_fast', { in_instance_id: instance.id }).single();
      if (!error) setPopulationMetrics(data);
    };
    loadPop();
  }, [instance]);

  // --- Helper: Load map data based on layer
  const loadMapData = async (layer: string) => {
    if (!instance?.id) return;
    setLoading(true);
    if (layer === 'overall') {
      const { data, error } = await supabase
        .from('v_instance_affected_adm3')
        .select('admin_pcode,name,geom_json,score')
        .eq('instance_id', instance.id);
      if (!error) setAdm3Features(data || []);
    } else {
      const { data, error } = await supabase
        .rpc('get_dataset_scores_for_instance', { in_instance_id: instance.id, in_dataset_name: layer });
      if (!error) setAdm3Features(data || []);
    }
    setLoading(false);
  };

  // --- Recompute everything
  const recomputeScores = async () => {
    if (!instance?.id) return;
    await supabase.rpc('score_instance_overall', { in_instance_id: instance.id });
    await loadMapData(selectedLayer);
    const { data } = await supabase.rpc('get_population_metrics_fast', { in_instance_id: instance.id }).single();
    setPopulationMetrics(data);
  };

  // --- Derived metrics
  const validScores = adm3Features.filter(f => f.score !== null);
  const avgScore = validScores.length ? (validScores.reduce((a, f) => a + f.score, 0) / validScores.length).toFixed(2) : '—';
  const maxScore = validScores.length ? Math.max(...validScores.map(f => f.score)).toFixed(2) : '—';
  const minScore = validScores.length ? Math.min(...validScores.map(f => f.score)).toFixed(2) : '—';
  const mostAffected = [...validScores].sort((a, b) => b.score - a.score).slice(0, expanded ? undefined : 5);

  return (
    <div className="p-4 space-y-3 text-sm text-gray-800">
      {instance && (
        <>
          {/* Header + Buttons */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-semibold">{instance.name}</h1>
              <p className="text-gray-500">{instance.description || 'No description'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAreaModal(true)} className="px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100">
                Define Area
              </button>
              <button onClick={() => setShowConfig(true)} className="px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100">
                Configure Datasets
              </button>
              <button onClick={() => setShowScoring(true)} className="px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100">
                Calibration
              </button>
              <button onClick={recomputeScores} className="px-3 py-1 border rounded bg-blue-600 text-white hover:bg-blue-700">
                Recompute
              </button>
            </div>
          </div>

          {/* Population Metrics */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <StatCard title="Total Population" value={populationMetrics?.total_population ?? '—'} />
            <StatCard title="People of Concern (≥3)" value={populationMetrics?.people_of_concern ?? '—'} />
            <StatCard title="Poverty-Exposed Population" value={populationMetrics?.poverty_exposed ?? '—'} />
          </div>

          {/* Summary Analytics */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            <StatCard title="Affected ADM3 Areas" value={adm3Features.length} />
            <StatCard title="Average Score" value={avgScore} />
            <StatCard title="Highest" value={maxScore} />
            <StatCard title="Lowest" value={minScore} />
          </div>

          {/* Map + Selector */}
          <div className="flex bg-white border rounded-lg shadow-sm">
            <div className="flex-1 p-2 relative">
              <div className="absolute right-3 top-3 z-10">
                <button
                  onClick={() => setZoomLocked(!zoomLocked)}
                  className="px-2 py-1 text-xs border rounded bg-gray-50 hover:bg-gray-100"
                >
                  {zoomLocked ? '🔒 Locked' : '🔓 Unlocked'}
                </button>
              </div>
              {loading ? (
                <p className="text-center p-6">Loading map...</p>
              ) : (
                <MapContainer
                  center={[10.3, 123.9]}
                  zoom={8}
                  scrollWheelZoom={!zoomLocked}
                  dragging={!zoomLocked}
                  style={{ height: '500px', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {adm3Features.map((f, i) => (
                    <GeoJSON
                      key={i}
                      data={f.geom_json}
                      style={{
                        color: '#333',
                        weight: 0.5,
                        fillOpacity: 0.7,
                        fillColor: colorForScore(f.score),
                      }}
                    />
                  ))}
                </MapContainer>
              )}
            </div>
            <ScoreLayerSelector
              instanceId={instance.id}
              selected={selectedLayer}
              onSelect={(sel: string) => {
                setSelectedLayer(sel);
                loadMapData(sel);
              }}
            />
          </div>
        </>
      )}

      {/* Modals */}
      {showConfig && <InstanceDatasetConfigModal instance={instance} onClose={() => setShowConfig(false)} onSaved={recomputeScores} />}
      {showAreaModal && <DefineAffectedAreaModal instance={instance} onClose={() => setShowAreaModal(false)} onSaved={recomputeScores} />}
      {showScoring && <InstanceScoringModal instance={instance} onClose={() => setShowScoring(false)} onSaved={recomputeScores} />}
    </div>
  );
}

const StatCard = ({ title, value }: { title: string; value: any }) => (
  <div className="bg-white border rounded-lg p-3 shadow-sm text-center">
    <p className="text-xs text-gray-500">{title}</p>
    <p className="text-lg font-semibold">{value ?? '—'}</p>
  </div>
);
