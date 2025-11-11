'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import AffectedAreaModal from '@/components/AffectedAreaModal';

// Lazy-load react-leaflet bits (SSR-safe)
const MapContainer: any = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer: any = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const GeoJSONLayer: any = dynamic(
  () => import('react-leaflet').then((m) => m.GeoJSON),
  { ssr: false }
);

type InstanceRow = {
  id: string;
  name: string;
  description: string | null;
  admin_scope: string[] | null;
  created_at: string;
};

type ChoroplethRow = { pcode: string; name: string; score: number; geom: any };
type Adm1Row = { admin_pcode: string; name: string; geom: any };

export default function InstancePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [showAffected, setShowAffected] = useState(false);

  // metrics
  const [frameworkAvg, setFrameworkAvg] = useState<number | null>(null);
  const [finalAvg, setFinalAvg] = useState<number | null>(null);

  // population summary
  const [popSummary, setPopSummary] = useState<{
    total_population: number | null;
    people_of_concern: number | null;
    people_in_need: number | null;
  }>({ total_population: null, people_of_concern: null, people_in_need: null });

  // priority list (ADM3)
  const [priority, setPriority] = useState<{ pcode: string; score: number }[]>(
    []
  );

  // affected area overlay (ADM1)
  const [adm1Polys, setAdm1Polys] = useState<Adm1Row[]>([]);

  // map layer selection
  const [layer, setLayer] = useState<'none' | 'final' | 'framework'>('none');
  const [layerRows, setLayerRows] = useState<ChoroplethRow[]>([]);

  // center/fit
  const mapCenter = useMemo<[number, number]>(() => [12.8797, 121.774], []);

  const loadInstance = async () => {
    // instance row
    const { data: inst } = await supabase
      .from('instances')
      .select('*')
      .eq('id', id)
      .single<InstanceRow>();
    setInstance(inst ?? null);

    // quick averages
    const { data: fw } = await supabase.rpc('get_framework_avg', {
      instance_uuid: id,
    });
    const { data: fin } = await supabase.rpc('get_final_avg', {
      instance_uuid: id,
    });
    setFrameworkAvg(fw?.framework_avg ?? null);
    setFinalAvg(fin?.final_avg ?? null);

    // population summary
    const { data: pop } = await supabase.rpc('get_population_summary', {
      in_instance_id: id,
    });
    if (pop && typeof pop.total_population !== 'undefined') {
      setPopSummary({
        total_population: Number(pop.total_population),
        people_of_concern: Number(pop.people_of_concern),
        people_in_need: Number(pop.people_in_need),
      });
    } else {
      setPopSummary({
        total_population: null,
        people_of_concern: null,
        people_in_need: null,
      });
    }

    // top 15
    const { data: pr } = await supabase
      .from('scored_instance_values')
      .select('pcode,score')
      .eq('instance_id', id)
      .eq('pillar', 'Final')
      .order('score', { ascending: false })
      .limit(15);
    setPriority((pr ?? []).map((r: any) => ({ pcode: r.pcode, score: r.score })));

    // selected ADM1 overlay polys
    const { data: a1 } = await supabase.rpc('get_instance_adm1_area', {
      in_instance_id: id,
    });
    setAdm1Polys(a1 ?? []);

    // refresh map layer if needed
    if (layer !== 'none') {
      await loadLayer(layer);
    }
  };

  const loadLayer = async (which: 'final' | 'framework') => {
    if (which === 'final') {
      const { data } = await supabase.rpc('get_adm3_final_layer', {
        in_instance_id: id,
      });
      setLayerRows(data ?? []);
    } else {
      const { data } = await supabase.rpc('get_adm3_framework_layer', {
        in_instance_id: id,
      });
      setLayerRows(data ?? []);
    }
  };

  useEffect(() => {
    loadInstance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (layer === 'none') {
      setLayerRows([]);
    } else {
      loadLayer(layer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer]);

  // color scale 1→5 : green→red
  const colorForScore = (s: number | null | undefined) => {
    if (s == null) return '#cbd5e1';
    const t = Math.max(1, Math.min(5, s));
    const pct = (t - 1) / 4; // 0..1
    const r = Math.round(46 + pct * (227 - 46)); // 2e7d32 -> e31b1b-ish
    const g = Math.round(125 + (1 - pct) * (125 - 27));
    const b = Math.round(50 + (1 - pct) * (50 - 35));
    return `rgba(${r},${g},${b},0.75)`;
  };

  const handleFrameworkRecompute = async () => {
    await supabase.rpc('score_framework_aggregate', { in_instance_id: id });
    await loadInstance();
  };

  const handleFinalRecompute = async () => {
    await supabase.rpc('score_final_aggregate', { in_instance_id: id });
    await loadInstance();
  };

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
          {instance?.name ?? 'Instance'}
        </h1>
        <div className="space-x-2">
          <button
            onClick={() => router.push('/instances')}
            className="px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={() => router.push('/datasets')}
            className="px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50"
          >
            Datasets
          </button>
          <button
            onClick={() => setShowAffected(true)}
            className="px-3 py-1.5 rounded text-sm bg-[var(--gsc-green,#2e7d32)] text-white hover:opacity-90"
          >
            Define Affected Area
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Map + layer selector */}
        <div className="col-span-7 bg-white border rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between mb-2 text-sm font-medium text-gray-700">
            <span>Affected Area</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Layer:</label>
              <select
                value={layer}
                onChange={(e) => setLayer(e.target.value as any)}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="none">None</option>
                <option value="final">Final (ADM3)</option>
                <option value="framework">Framework (ADM3)</option>
              </select>
            </div>
          </div>

          <div className="h-[520px] rounded overflow-hidden border relative z-0">
            <MapContainer
              center={mapCenter}
              zoom={5}
              scrollWheelZoom={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Selected ADM1 fill */}
              {adm1Polys.length > 0 && (
                <GeoJSONLayer
                  key="adm1"
                  data={{
                    type: 'FeatureCollection',
                    features: adm1Polys.map((r) => ({
                      type: 'Feature',
                      geometry: r.geom,
                      properties: { name: r.name, pcode: r.admin_pcode },
                    })),
                  }}
                  style={() => ({
                    color: '#64748b',
                    weight: 1,
                    fillColor: 'rgba(46,125,50,0.25)',
                    fillOpacity: 0.35,
                  })}
                />
              )}

              {/* Choropleth for ADM3 scores */}
              {layer !== 'none' && layerRows.length > 0 && (
                <GeoJSONLayer
                  key={`layer-${layer}`}
                  data={{
                    type: 'FeatureCollection',
                    features: layerRows.map((r) => ({
                      type: 'Feature',
                      geometry: r.geom,
                      properties: { name: r.name, pcode: r.pcode, score: r.score },
                    })),
                  }}
                  style={(feat: any) => ({
                    color: '#111827',
                    weight: 0.3,
                    fillColor: colorForScore(feat?.properties?.score),
                    fillOpacity: 0.8,
                  })}
                />
              )}
            </MapContainer>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Selected ADM1s are shaded green. Use the layer selector to visualize scores
            at ADM3.
          </p>
        </div>

        {/* Metrics / Controls */}
        <div className="col-span-5 space-y-4">
          {/* Key metrics */}
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Key Metrics</div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">Framework Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
                  {frameworkAvg != null ? frameworkAvg.toFixed(3) : '-'}
                </div>
              </div>
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">Final Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-red,#630710)]">
                  {finalAvg != null ? finalAvg.toFixed(3) : '-'}
                </div>
              </div>
            </div>

            {/* Population summary */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg py-3 border">
                <div className="text-xs text-gray-600">People (Affected Area)</div>
                <div className="text-lg font-semibold">
                  {popSummary.total_population != null
                    ? popSummary.total_population.toLocaleString()
                    : '-'}
                </div>
              </div>
              <div className="rounded-lg py-3 border">
                <div className="text-xs text-gray-600">People of Concern (≥3)</div>
                <div className="text-lg font-semibold">
                  {popSummary.people_of_concern != null
                    ? popSummary.people_of_concern.toLocaleString()
                    : '-'}
                </div>
              </div>
              <div className="rounded-lg py-3 border">
                <div className="text-xs text-gray-600">People in Need (concern × poverty)</div>
                <div className="text-lg font-semibold">
                  {popSummary.people_in_need != null
                    ? popSummary.people_in_need.toLocaleString()
                    : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Recompute */}
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Recompute</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleFrameworkRecompute}
                className="flex-1 bg-[var(--gsc-blue,#004b87)] text-white py-2 rounded hover:opacity-90 text-sm"
              >
                Recompute Framework
              </button>
              <button
                onClick={handleFinalRecompute}
                className="flex-1 bg-[var(--gsc-green,#2e7d32)] text-white py-2 rounded hover:opacity-90 text-sm"
              >
                Recompute Final
              </button>
            </div>
          </div>

          {/* Priority list */}
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Priority Locations (Top 15 by Final)
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b">
                  <th className="text-left py-1">Admin Pcode</th>
                  <th className="text-right py-1">Final Score</th>
                </tr>
              </thead>
              <tbody>
                {priority.map((p) => (
                  <tr key={p.pcode} className="border-b last:border-none">
                    <td className="py-1">{p.pcode}</td>
                    <td className="py-1 text-right">{p.score.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAffected && instance && (
        <AffectedAreaModal
          instance={instance}
          onClose={() => setShowAffected(false)}
          onSaved={loadInstance}
        />
      )}
    </div>
  );
}
