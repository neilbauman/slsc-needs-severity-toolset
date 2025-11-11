'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import AffectedAreaModal from './AffectedAreaModal';

// react-leaflet dynamic imports (no SSR)
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false });
const GeoJSON      = dynamic(() => import('react-leaflet').then(m => m.GeoJSON),      { ssr: false });

type Instance = {
  id: string;
  name: string;
  created_at: string | null;
  admin_scope: string[] | null;
};

type DatasetRow = {
  id: string;
  name: string;
  category: string | null;
  type: 'numeric' | 'categorical';
};

type ScoreRow = { pcode: string; score: number | null; pillar: string | null };

const GSC = {
  red: '#630710',
  blue: '#004b87',
  green: '#2e7d32',
  orange: '#d35400',
  gray: '#374151',
  lightGray: '#e5e7eb',
  beige: '#f5f2ee',
};

function binColor(score: number | null | undefined) {
  if (score == null) return GSC.beige;
  if (score >= 4) return GSC.red;
  if (score >= 3) return GSC.orange;
  if (score >= 2) return GSC.green;
  return GSC.blue; // 1 or lower fallback
}

export default function InstancePage() {
  const { id } = useParams<{ id: string }>();
  const instanceId = id;
  const router = useRouter();

  // page state
  const [instance, setInstance] = useState<Instance | null>(null);
  const [frameworkAvg, setFrameworkAvg] = useState<number | null>(null);
  const [finalAvg, setFinalAvg] = useState<number | null>(null);
  const [topFinal, setTopFinal] = useState<Array<{ pcode: string; score: number }>>([]);
  const [showAreaModal, setShowAreaModal] = useState(false);

  // map state
  const [admGeo, setAdmGeo] = useState<any | null>(null); // FeatureCollection
  const [viewMode, setViewMode] = useState<'framework' | 'final' | 'dataset'>('final');
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [scores, setScores] = useState<Map<string, number | null>>(new Map());

  const scopeCount = instance?.admin_scope?.length ?? 0;

  // load instance
  useEffect(() => {
    const loadInstance = async () => {
      const { data } = await supabase.from('instances')
        .select('id,name,created_at,admin_scope')
        .eq('id', instanceId)
        .single();
      if (data) setInstance(data);
    };
    loadInstance();
  }, [instanceId]);

  // load ADM polygons (ADM1)
  useEffect(() => {
    const loadAdm = async () => {
      const { data } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode,name,geom')
        .eq('admin_level', 1);
      if (!data) return;
      setAdmGeo({
        type: 'FeatureCollection',
        features: data.map((d: any) => ({
          type: 'Feature',
          geometry: d.geom,
          properties: { admin_pcode: d.admin_pcode, name: d.name },
        })),
      });
    };
    loadAdm();
  }, []);

  // load datasets for dataset view toggle
  useEffect(() => {
    const loadDs = async () => {
      const { data } = await supabase
        .from('datasets')
        .select('id,name,category,type')
        .order('name', { ascending: true });
      setDatasets(data || []);
    };
    loadDs();
  }, []);

  // key metrics
  useEffect(() => {
    const loadMetrics = async () => {
      // framework avg
      const { data: fa } = await supabase.rpc('get_avg_score_for_instance_pillar', {
        in_instance_id: instanceId,
        in_pillar: 'Framework',
      });
      setFrameworkAvg(fa ?? null);

      // final avg
      const { data: la } = await supabase.rpc('get_avg_score_for_instance_pillar', {
        in_instance_id: instanceId,
        in_pillar: 'Final',
      });
      setFinalAvg(la ?? null);

      // top 15 final scores
      const { data: top } = await supabase
        .from('scored_instance_values')
        .select('pcode,score')
        .eq('instance_id', instanceId)
        .eq('pillar', 'Final')
        .order('score', { ascending: false })
        .limit(15);
      setTopFinal((top || []).map((r) => ({ pcode: r.pcode, score: r.score ?? 0 })));
    };
    loadMetrics();
  }, [instanceId]);

  // scores for map depending on view
  useEffect(() => {
    const loadScores = async () => {
      if (!instanceId) return;
      let query = supabase
        .from('scored_instance_values')
        .select('pcode,score,pillar')
        .eq('instance_id', instanceId);

      if (viewMode === 'framework') {
        query = query.eq('pillar', 'Framework');
      } else if (viewMode === 'final') {
        query = query.eq('pillar', 'Final');
      } else if (viewMode === 'dataset' && datasetId) {
        query = query.eq('dataset_id', datasetId);
      } else {
        setScores(new Map());
        return;
      }

      const { data } = await query;
      const map = new Map<string, number | null>();
      (data || []).forEach((r: ScoreRow) => map.set(r.pcode, r.score));
      setScores(map);
    };
    loadScores();
  }, [instanceId, viewMode, datasetId]);

  // recompute hooks
  const recomputeFramework = async () => {
    await supabase.rpc('score_framework_aggregate', { in_instance_id: instanceId });
    // refresh metrics + map
    const { data: fa } = await supabase.rpc('get_avg_score_for_instance_pillar', {
      in_instance_id: instanceId,
      in_pillar: 'Framework',
    });
    setFrameworkAvg(fa ?? null);
    setViewMode('framework');
  };

  const recomputeFinal = async () => {
    await supabase.rpc('score_final_aggregate', { in_instance_id: instanceId });
    const { data: la } = await supabase.rpc('get_avg_score_for_instance_pillar', {
      in_instance_id: instanceId,
      in_pillar: 'Final',
    });
    setFinalAvg(la ?? null);
    setViewMode('final');
  };

  // legend bins
  const legend = useMemo(
    () => [
      { label: '4–5', color: GSC.red },
      { label: '3–<4', color: GSC.orange },
      { label: '2–<3', color: GSC.green },
      { label: '1–<2', color: GSC.blue },
      { label: 'No data', color: GSC.beige, border: true },
    ],
    []
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-semibold">{instance?.name ?? 'Instance'}</h1>
          <p className="text-sm text-gray-500">
            {instance?.created_at ? new Date(instance.created_at).toLocaleString() : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/instances')}
            className="px-3 py-1 border rounded"
          >
            Back
          </button>
          <button
            onClick={() => router.push('/datasets')}
            className="px-3 py-1 border rounded"
          >
            Datasets
          </button>
          <button
            onClick={() => setShowAreaModal(true)}
            className="px-3 py-1 rounded text-white"
            style={{ backgroundColor: GSC.green }}
          >
            Define Affected Area
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Map & controls */}
        <div className="col-span-8">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-gray-600">
              {scopeCount} ADM1 selected
            </div>

            <div className="flex items-center gap-2">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="final">Final scores</option>
                <option value="framework">Framework scores</option>
                <option value="dataset">Dataset score…</option>
              </select>

              {viewMode === 'dataset' && (
                <select
                  value={datasetId ?? ''}
                  onChange={(e) => setDatasetId(e.target.value || null)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="">Select dataset…</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.category ? `— ${d.category}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="relative border rounded overflow-hidden" style={{ height: 520 }}>
            {admGeo && (
              <MapContainer center={[12.8797, 121.774]} zoom={5} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <GeoJSON
                  data={admGeo}
                  style={(f) => {
                    const val = scores.get(f.properties.admin_pcode) ?? null;
                    const color = binColor(val);
                    const inScope = instance?.admin_scope?.includes(f.properties.admin_pcode) ?? false;
                    return {
                      color: inScope ? GSC.gray : '#bfbfbf',
                      weight: 1,
                      fillColor: color,
                      fillOpacity: inScope ? (val == null ? 0.25 : 0.7) : 0.15,
                    };
                  }}
                  onEachFeature={(feature, layer) => {
                    const v = scores.get(feature.properties.admin_pcode);
                    const valText = v == null ? 'N/A' : Number(v).toFixed(3);
                    layer.bindPopup(`<b>${feature.properties.name}</b><br/>Score: ${valText}`);
                  }}
                />
              </MapContainer>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 bg-white/90 rounded shadow px-3 py-2 text-sm">
              <div className="font-medium mb-1">Legend</div>
              <div className="grid grid-cols-5 gap-2">
                {legend.map((l) => (
                  <div key={l.label} className="flex items-center gap-2">
                    <span
                      style={{
                        backgroundColor: l.color,
                        width: 16,
                        height: 12,
                        border: l.border ? `1px solid ${GSC.gray}` : 'none',
                        display: 'inline-block',
                      }}
                    />
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Notes: polygons shown are ADM1. Only selected ADM1 (affected area) are emphasized. Switch between
            **Final**, **Framework**, or a specific **Dataset** to visualize scores.
          </p>
        </div>

        {/* Right column: metrics & recompute */}
        <div className="col-span-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="border rounded p-3">
              <div className="text-sm text-gray-600 mb-1">Framework Avg</div>
              <div className="text-2xl font-semibold">{frameworkAvg?.toFixed(3) ?? '—'}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-sm text-gray-600 mb-1">Final Avg</div>
              <div className="text-2xl font-semibold">{finalAvg?.toFixed(3) ?? '—'}</div>
            </div>
          </div>

          <div className="border rounded p-3 mb-3">
            <div className="text-sm font-semibold mb-2">Recompute</div>
            <div className="flex gap-2">
              <button
                onClick={recomputeFramework}
                className="px-3 py-1 rounded text-white"
                style={{ backgroundColor: GSC.blue }}
              >
                Recompute Framework
              </button>
              <button
                onClick={recomputeFinal}
                className="px-3 py-1 rounded text-white"
                style={{ backgroundColor: GSC.blue }}
              >
                Recompute Final
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Runs DB roll-ups. Use after changing dataset or framework config.
            </p>
          </div>

          <div className="border rounded p-3">
            <div className="text-sm font-semibold mb-2">
              Priority Locations (Top 15 by Final)
            </div>
            <div className="h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-1">Admin Pcode</th>
                    <th className="py-1 text-right">Final Score</th>
                  </tr>
                </thead>
                <tbody>
                  {topFinal.map((r) => (
                    <tr key={r.pcode} className="border-t">
                      <td className="py-1">{r.pcode}</td>
                      <td className="py-1 text-right">{r.score.toFixed(3)}</td>
                    </tr>
                  ))}
                  {!topFinal.length && (
                    <tr>
                      <td className="py-2 text-gray-500" colSpan={2}>
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Use to prioritize shelter response within the affected area.
            </p>
          </div>
        </div>
      </div>

      {/* Affected Area modal */}
      {showAreaModal && instance && (
        <AffectedAreaModal
          instanceId={instance.id}
          onClose={() => setShowAreaModal(false)}
          onSaved={() => {
            // refresh instance + keep current view
            (async () => {
              const { data } = await supabase
                .from('instances')
                .select('id,name,created_at,admin_scope')
                .eq('id', instance.id)
                .single();
              if (data) setInstance(data);
            })();
          }}
        />
      )}
    </div>
  );
}
