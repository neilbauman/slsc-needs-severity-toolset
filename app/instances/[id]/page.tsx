'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import InstanceDatasetConfigModal from '@/components/InstanceDatasetConfigModal';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';
import InstanceScoringModal from '@/components/InstanceScoringModal';

// Dynamic Leaflet imports
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then((m) => m.GeoJSON), { ssr: false });

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [adm3Features, setAdm3Features] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [populationMetrics, setPopulationMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [zoomLocked, setZoomLocked] = useState(true);
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
      if (error) console.error('Error loading instance:', error);
      else setInstance(data);
    };
    loadInstance();
  }, [params.id]);

  // --- Load ADM3 polygons with scores
  const loadAdm3 = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('v_instance_affected_adm3')
      .select('admin_pcode,name,geom_json,score')
      .eq('instance_id', id);
    if (error) console.error('Error loading ADM3 features:', error);
    else setAdm3Features(data || []);
    setLoading(false);
  };

  // --- Load category breakdown
  const loadCategories = async (id: string) => {
    const { data, error } = await supabase.from('v_category_scores').select('*').eq('instance_id', id);
    if (error) console.error('Error loading category scores:', error);
    else setCategories(data || []);
  };

  // --- Load population metrics
  const loadPopulationMetrics = async (id: string) => {
    const { data, error } = await supabase
      .from('v_instance_population_metrics_v2')
      .select('*')
      .eq('instance_id', id)
      .single();
    if (error) console.error('Error loading population metrics:', error);
    else setPopulationMetrics(data || {});
  };

  // --- Recompute scores and refresh data
  const recomputeScores = async () => {
    if (!instance?.id) return;
    await supabase.rpc('score_instance_overall', { in_instance_id: instance.id });
    await loadAdm3(instance.id);
    await loadPopulationMetrics(instance.id);
    await loadCategories(instance.id);
  };

  // --- Initial data loads
  useEffect(() => {
    if (!instance?.id) return;
    loadAdm3(instance.id);
    loadCategories(instance.id);
    loadPopulationMetrics(instance.id);
  }, [instance]);

  // --- Derived metrics for ADM3
  const validScores = adm3Features.filter(f => f.score !== null);
  const avgScore = validScores.length
    ? (validScores.reduce((a, f) => a + f.score, 0) / validScores.length).toFixed(2)
    : '—';
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
              <button
                onClick={recomputeScores}
                className="px-3 py-1 border rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Recompute
              </button>
            </div>
          </div>

          {/* Population and Risk Panels */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-white border rounded-lg p-2 shadow-sm">
              <p className="text-xs text-gray-500">Total Population</p>
              <p className="text-base font-semibold">
                {populationMetrics.total_population
                  ? populationMetrics.total_population.toLocaleString()
                  : '—'}
              </p>
            </div>
            <div className="bg-white border rounded-lg p-2 shadow-sm">
              <p className="text-xs text-gray-500">People of Concern (≥3)</p>
              <p className="text-base font-semibold text-orange-600">
                {populationMetrics.people_of_concern
                  ? populationMetrics.people_of_concern.toLocaleString()
                  : '—'}
              </p>
            </div>
            <div className="bg-white border rounded-lg p-2 shadow-sm">
              <p className="text-xs text-gray-500">Poverty-Exposed Population</p>
              <p className="text-base font-semibold text-red-600">
                {populationMetrics.poverty_exposed
                  ? populationMetrics.poverty_exposed.toLocaleString()
                  : '—'}
              </p>
            </div>
          </div>

          {/* ADM3 Score Panels */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div className="bg-white border rounded-lg p-2 shadow-sm">
              <p className="text-xs text-gray-500">Affected ADM3 Areas</p>
              <p className="text-base font-semibold">{adm3Features.length}</p>
            </div>
            <div className="bg-white border rounded-lg p-2 shadow-sm">
              <p className="text-xs text-gray-500">Average Score</p>
              <p className="text-base font-semibold">{avgScore}</p>
            </div>
            <div className="bg-white border rounded-lg p-2 shadow-sm">
              <p className="text-xs text-gray-500">Highest</p>
              <p className="text-base font-semibold">{maxScore}</p>
            </div>
            <div className="bg-white border rounded-lg p-2 shadow-sm">
              <p className="text-xs text-gray-500">Lowest</p>
              <p className="text-base font-semibold">{minScore}</p>
            </div>
          </div>

          {/* Map */}
          <div className="bg-white border rounded-lg shadow-sm p-2 relative">
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

          {/* Category Breakdown */}
          <div className="bg-white border rounded-lg shadow-sm p-3">
            <h3 className="font-semibold mb-2">Category Breakdown</h3>
            {categories.length === 0 ? (
              <p className="text-gray-500 text-sm">No category scores available.</p>
            ) : (
              <table className="w-full text-xs border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-1 text-left">Category</th>
                    <th className="p-1 text-left">Average</th>
                    <th className="p-1 text-left">Datasets</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="p-1">{c.category}</td>
                      <td className="p-1">{Number(c.avg_score || 0).toFixed(2)}</td>
                      <td className="p-1">{c.dataset_list || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Most Affected ADM3 Areas */}
          <div className="bg-white border rounded-lg shadow-sm p-3">
            <h3 className="font-semibold mb-2">Most Affected ADM3 Areas</h3>
            <table className="w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-1 text-left">Area</th>
                  <th className="p-1 text-left">Pcode</th>
                  <th className="p-1 text-left">Score</th>
                </tr>
              </thead>
              <tbody>
                {mostAffected.map((f, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-1">{f.name || '—'}</td>
                    <td className="p-1">{f.admin_pcode}</td>
                    <td className="p-1 font-medium">{f.score?.toFixed(2) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {adm3Features.length > 5 && (
              <div className="text-center mt-2">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-blue-600 text-xs hover:underline"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {showConfig && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowConfig(false)}
          onSaved={recomputeScores}
        />
      )}
      {showAreaModal && (
        <DefineAffectedAreaModal
          instance={instance}
          onClose={() => setShowAreaModal(false)}
          onSaved={recomputeScores}
        />
      )}
      {showScoring && (
        <InstanceScoringModal
          instance={instance}
          onClose={() => setShowScoring(false)}
          onSaved={recomputeScores}
        />
      )}
    </div>
  );
}
