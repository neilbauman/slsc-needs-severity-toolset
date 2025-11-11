'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import AffectedAreaModal from '@/components/AffectedAreaModal';

// ---- lazy React-Leaflet bits (SSR-safe)
const MapContainer = dynamic(
  () => import('react-leaflet').then(m => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(m => m.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import('react-leaflet').then(m => m.GeoJSON),
  { ssr: false }
);

// Legend (tiny UI component)
function Legend({ min = 1, max = 5 }: { min?: number; max?: number }) {
  const stops = useMemo(
    () => [
      { v: min, c: '#2e7d32' },   // green
      { v: (min + max) / 2, c: '#ffc107' }, // yellow
      { v: max, c: '#c62828' },   // red
    ],
    [min, max]
  );
  return (
    <div className="absolute bottom-3 right-3 z-[400] rounded-md bg-white/90 shadow px-3 py-2 text-xs">
      <div className="font-medium mb-1">Final (ADM3)</div>
      <div className="flex items-center gap-2">
        <span>{min}</span>
        <div className="h-2 w-28 rounded-full"
             style={{
               background:
                 'linear-gradient(90deg,#2e7d32 0%,#7fbf3f 25%,#ffc107 50%,#ff7f50 75%,#c62828 100%)'
             }}
        />
        <span>{max}</span>
      </div>
    </div>
  );
}

// simple score → color
function colorFor(score?: number | null) {
  if (score == null) return '#bdbdbd';
  if (score >= 4.5) return '#c62828';
  if (score >= 3.5) return '#ff7f50';
  if (score >= 2.5) return '#ffc107';
  if (score >= 1.5) return '#7fbf3f';
  return '#2e7d32';
}

type Feature = {
  type: 'Feature';
  geometry: GeoJSON.Geometry;
  properties: {
    pcode: string;
    name?: string | null;
    final_score?: number | null;
  };
};
type FC = { type: 'FeatureCollection'; features: Feature[] };

export default function InstancePage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [instance, setInstance] = useState<any>(null);

  // summary (framework/final + people metrics)
  const [summary, setSummary] = useState<{
    framework_avg?: number | null;
    final_avg?: number | null;
    people_affected?: number | null;
    people_of_concern?: number | null;
    people_in_need?: number | null;
  }>({});

  // top locations table
  const [top, setTop] = useState<
    { adm2_name: string | null; adm3_name: string | null; pcode: string; final_score: number; population: number; people_in_need: number }[]
  >([]);

  // ADM3 geo for choropleth
  const [adm3Geo, setAdm3Geo] = useState<FC | null>(null);

  // modal
  const [showAffected, setShowAffected] = useState(false);

  // map ref (for fitBounds after data loads)
  const mapRef = useRef<L.Map | null>(null);

  const loadInstance = useCallback(async () => {
    // instance
    const { data: inst } = await supabase.from('instances').select('*').eq('id', id).single();
    setInstance(inst);

    // summary rpc (server handles pop/concern/need)
    const { data: s } = await supabase.rpc('get_instance_summary', { in_instance: id });
    if (s) setSummary(s as any);

    // priority (table expects names & metrics)
    const { data: rows } = await supabase.rpc('get_priority_locations', { in_instance: id, limit_n: 15 });
    setTop((rows ?? []) as any[]);

    // ADM3 choropleth geojson: expects features with {pcode,name,final_score}
    const { data: gj } = await supabase.rpc('get_adm3_choropleth', { in_instance: id });
    // Accept either an array of rows or an already-built FC
    if (gj && Array.isArray(gj)) {
      const features: Feature[] = gj
        .filter((r: any) => r?.geom)
        .map((r: any) => ({
          type: 'Feature',
          geometry: r.geom as GeoJSON.Geometry,
          properties: {
            pcode: r.pcode,
            name: r.name ?? null,
            final_score: typeof r.final_score === 'number' ? r.final_score : null
          }
        }));
      setAdm3Geo({ type: 'FeatureCollection', features });
    } else if (gj && gj.type === 'FeatureCollection') {
      setAdm3Geo(gj as FC);
    } else {
      setAdm3Geo(null);
    }
  }, [id, supabase]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  // style & interactivity
  const styleFeature = useCallback((feat: Feature) => {
    const s = feat?.properties?.final_score ?? null;
    return {
      color: '#666',
      weight: 0.8,
      opacity: 0.7,
      fillColor: colorFor(s),
      fillOpacity: 0.55
    };
  }, []);

  const onEachFeature = useCallback((feat: Feature, layer: L.Layer) => {
    const props = (feat && feat.properties) || {};
    const name = props.name || props.pcode;
    const score =
      props.final_score == null ? '–' : Number(props.final_score).toFixed(3);
    (layer as L.Path).bindTooltip(`${name}<br/>Final: <b>${score}</b>`, {
      sticky: true,
      direction: 'top'
    });
  }, []);

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
      {/* header */}
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

      {/* grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Map */}
        <div className="col-span-7 bg-white border rounded-lg shadow-sm p-3 relative">
          <div className="flex items-center justify-between mb-2 text-sm font-medium text-gray-700">
            <span>Affected Area</span>
            <span className="text-gray-400 text-xs">
              {(instance?.admin_scope?.length ?? 0)} ADM1 selected
            </span>
          </div>

          <div className="h-[520px] rounded overflow-hidden border relative">
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={5}
              whenReady={() => {
                // Type-safe: use ref instead of event arg
                const map = mapRef.current;
                if (map && adm3Geo?.features?.length) {
                  const b = L.geoJSON(adm3Geo as any).getBounds();
                  if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });
                }
              }}
              scrollWheelZoom={true}
              className="h-full w-full"
              ref={(m) => { mapRef.current = m as any; }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {adm3Geo && (
                <GeoJSON
                  key={`adm3-${adm3Geo.features?.length ?? 0}`}
                  data={adm3Geo as any}
                  style={styleFeature as any}
                  onEachFeature={onEachFeature as any}
                />
              )}
            </MapContainer>

            {/* Legend */}
            {adm3Geo?.features?.length ? <Legend /> : null}
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Selected ADM1s are shown; ADM3 polygons are colored by <em>Final</em> score.
          </p>
        </div>

        {/* Right column */}
        <div className="col-span-5 space-y-4">
          {/* Summary */}
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Summary Metrics</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-100 rounded p-3 text-center">
                <div className="text-xs text-gray-600">Framework Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
                  {summary.framework_avg != null ? Number(summary.framework_avg).toFixed(3) : '–'}
                </div>
              </div>
              <div className="bg-gray-100 rounded p-3 text-center">
                <div className="text-xs text-gray-600">Final Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-red,#630710)]">
                  {summary.final_avg != null ? Number(summary.final_avg).toFixed(3) : '–'}
                </div>
              </div>
              <div className="bg-gray-100 rounded p-3 text-center col-span-2 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-gray-600">People Affected</div>
                  <div className="text-base font-semibold">
                    {summary.people_affected != null ? summary.people_affected.toLocaleString() : '–'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">People of Concern</div>
                  <div className="text-base font-semibold">
                    {summary.people_of_concern != null ? summary.people_of_concern.toLocaleString() : '–'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">People in Need</div>
                  <div className="text-base font-semibold">
                    {summary.people_in_need != null ? summary.people_in_need.toLocaleString() : '–'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recompute */}
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Recompute</div>
            <div className="flex gap-2">
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

          {/* Top locations */}
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Priority Locations (Top 15 by Final)</div>
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b">
                    <th className="text-left py-1">ADM2</th>
                    <th className="text-left py-1">ADM3</th>
                    <th className="text-right py-1">Final</th>
                    <th className="text-right py-1">Population</th>
                    <th className="text-right py-1">People in Need</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((r) => (
                    <tr key={r.pcode} className="border-b last:border-none">
                      <td className="py-1">{r.adm2_name ?? '–'}</td>
                      <td className="py-1">{r.adm3_name ?? r.pcode}</td>
                      <td className="py-1 text-right">{Number(r.final_score).toFixed(3)}</td>
                      <td className="py-1 text-right">{(r.population ?? 0).toLocaleString()}</td>
                      <td className="py-1 text-right">{(r.people_in_need ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!top.length && (
                    <tr><td colSpan={5} className="py-4 text-center text-gray-400">No rows</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* modal */}
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
