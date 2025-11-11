'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import AffectedAreaModal from '@/components/AffectedAreaModal';
import L from 'leaflet';

// ---- Lazy React-Leaflet imports
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });

// ---- Simple gradient legend
function Legend() {
  return (
    <div className="absolute bottom-3 right-3 z-[400] bg-white/90 shadow rounded px-3 py-2 text-xs">
      <div className="font-medium mb-1">Final Score</div>
      <div className="flex items-center gap-2">
        <span>1</span>
        <div
          className="h-2 w-28 rounded-full"
          style={{
            background:
              'linear-gradient(90deg,#2e7d32 0%,#a2b837 25%,#f6d32d 50%,#e67e22 75%,#630710 100%)'
          }}
        />
        <span>5</span>
      </div>
    </div>
  );
}

function colorFor(score?: number | null) {
  if (score == null) return '#bdbdbd';
  if (score >= 4.5) return '#630710';
  if (score >= 3.5) return '#e67e22';
  if (score >= 2.5) return '#f6d32d';
  if (score >= 1.5) return '#a2b837';
  return '#2e7d32';
}

interface FeatureProps {
  pcode: string;
  name?: string | null;
  final_score?: number | null;
}

interface Feature {
  type: 'Feature';
  geometry: GeoJSON.Geometry;
  properties: FeatureProps;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

export default function InstancePage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [instance, setInstance] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [top, setTop] = useState<any[]>([]);
  const [adm3Geo, setAdm3Geo] = useState<FeatureCollection | null>(null);
  const [showAffected, setShowAffected] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  const loadInstance = useCallback(async () => {
    // 1. Load instance meta
    const { data: inst } = await supabase.from('instances').select('*').eq('id', id).single();
    setInstance(inst);

    // 2. Summary metrics
    const { data: sum } = await supabase.rpc('get_instance_summary', { in_instance: id });
    setSummary(sum?.[0] ?? null);

    // 3. Priority locations
    const { data: topRows } = await supabase.rpc('get_priority_locations', {
      in_instance: id,
      limit_n: 15
    });
    setTop(topRows ?? []);

    // 4. ADM3 boundaries + final scores
    const { data: geo } = await supabase.rpc('get_admin_boundaries_geojson', { in_level: 'ADM3' });
    const { data: scores } = await supabase
      .from('scored_instance_values')
      .select('pcode, score')
      .eq('instance_id', id)
      .eq('pillar', 'Final');

    const scoreMap: Record<string, number> = {};
    scores?.forEach(s => {
      scoreMap[s.pcode] = Number(s.score);
    });

    const adm1Scope = inst?.admin_scope ?? [];
    const filtered = (geo?.features ?? []).filter((f: any) =>
      adm1Scope.some((a: string) => f.properties.admin_pcode?.startsWith(a))
    );

    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: filtered.map((f: any) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          pcode: f.properties.admin_pcode,
          name: f.properties.name,
          final_score: scoreMap[f.properties.admin_pcode] ?? null
        }
      }))
    };
    setAdm3Geo(fc);
  }, [id, supabase]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  const styleFeature = useCallback((feat: Feature) => {
    const score = feat?.properties?.final_score ?? null;
    return {
      color: '#666',
      weight: 0.7,
      fillColor: colorFor(score),
      fillOpacity: 0.65
    };
  }, []);

  const onEachFeature = useCallback((feat: Feature, layer: L.Layer) => {
    const props: FeatureProps = feat?.properties ?? { pcode: '', name: '', final_score: null };
    const name = props.name || props.pcode || 'Unknown';
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
            onClick={() => setShowAffected(true)}
            className="px-3 py-1.5 rounded text-sm bg-[var(--gsc-green,#2e7d32)] text-white hover:opacity-90"
          >
            Define Affected Area
          </button>
        </div>
      </div>

      {/* Grid layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Map Section */}
        <div className="col-span-7 bg-white border rounded-lg shadow-sm p-3 relative">
          <div className="flex items-center justify-between mb-2 text-sm font-medium text-gray-700">
            <span>Affected Area (ADM3 Final Scores)</span>
            <span className="text-gray-400 text-xs">
              {(instance?.admin_scope?.length ?? 0)} ADM1 selected
            </span>
          </div>

          <div className="h-[520px] rounded overflow-hidden border relative">
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={5}
              scrollWheelZoom={true}
              className="h-full w-full"
              whenReady={() => {
                const map = mapRef.current;
                if (map && adm3Geo?.features?.length) {
                  const bounds = L.geoJSON(adm3Geo as any).getBounds();
                  if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
                }
              }}
              ref={(m) => {
                mapRef.current = m as unknown as L.Map;
              }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {adm3Geo && (
                <GeoJSON
                  key={`adm3-${adm3Geo.features.length}`}
                  data={adm3Geo as any}
                  style={styleFeature as any}
                  onEachFeature={onEachFeature as any}
                />
              )}
            </MapContainer>
            {adm3Geo?.features?.length ? <Legend /> : null}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Selected ADM1s shown; ADM3 polygons shaded by <em>Final</em> score.
          </p>
        </div>

        {/* Sidebar */}
        <div className="col-span-5 space-y-4">
          {/* Summary */}
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Summary Metrics</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-100 rounded p-3 text-center">
                <div className="text-xs text-gray-600">Framework Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
                  {summary?.framework_avg?.toFixed?.(3) ?? '–'}
                </div>
              </div>
              <div className="bg-gray-100 rounded p-3 text-center">
                <div className="text-xs text-gray-600">Final Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-red,#630710)]">
                  {summary?.final_avg?.toFixed?.(3) ?? '–'}
                </div>
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-3">
                <div className="bg-gray-100 rounded p-2 text-center">
                  <div className="text-xs text-gray-600">People Affected</div>
                  <div className="font-semibold">
                    {summary?.people_affected?.toLocaleString?.() ?? '–'}
                  </div>
                </div>
                <div className="bg-gray-100 rounded p-2 text-center">
                  <div className="text-xs text-gray-600">People of Concern</div>
                  <div className="font-semibold">
                    {summary?.people_of_concern?.toLocaleString?.() ?? '–'}
                  </div>
                </div>
                <div className="bg-gray-100 rounded p-2 text-center">
                  <div className="text-xs text-gray-600">People in Need</div>
                  <div className="font-semibold">
                    {summary?.people_in_need?.toLocaleString?.() ?? '–'}
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

          {/* Table */}
          <div className="bg-white border rounded-lg shadow-sm p-4 overflow-auto max-h-[420px]">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Priority Locations (Top 15)
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b">
                  <th className="text-left py-1">ADM2</th>
                  <th className="text-left py-1">ADM3</th>
                  <th className="text-right py-1">Final</th>
                  <th className="text-right py-1">Pop</th>
                  <th className="text-right py-1">Need</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.pcode} className="border-b last:border-none">
                    <td className="py-1">{r.adm2_name ?? '–'}</td>
                    <td className="py-1">{r.adm3_name ?? r.pcode}</td>
                    <td className="py-1 text-right">{r.final_score?.toFixed?.(3) ?? '–'}</td>
                    <td className="py-1 text-right">{r.population?.toLocaleString?.() ?? '–'}</td>
                    <td className="py-1 text-right text-[var(--gsc-green,#2e7d32)] font-medium">
                      {r.people_in_need?.toLocaleString?.() ?? '–'}
                    </td>
                  </tr>
                ))}
                {!top.length && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-gray-400">
                      No rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAffected && instance && (
        <AffectedAreaModal instance={instance} onClose={() => setShowAffected(false)} onSaved={loadInstance} />
      )}
    </div>
  );
}
