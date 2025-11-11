'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import AffectedAreaModal from '@/components/AffectedAreaModal';
import L from 'leaflet';

// Lazy load React Leaflet components
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import('react-leaflet').then((mod) => mod.GeoJSON),
  { ssr: false }
);

export default function InstancePage() {
  const supabase = createClient();
  const { id } = useParams();
  const router = useRouter();

  const [instance, setInstance] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [priority, setPriority] = useState<any[]>([]);
  const [adm3Geo, setAdm3Geo] = useState<any>(null);
  const [showAffected, setShowAffected] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  // --- Load all instance data
  const loadInstanceData = async () => {
    const { data: inst } = await supabase.from('instances').select('*').eq('id', id).single();
    setInstance(inst);

    const { data: summaryData } = await supabase.rpc('get_instance_summary', { in_instance: id });
    setSummary(summaryData?.[0] ?? null);

    const { data: priorityData } = await supabase.rpc('get_priority_locations', {
      in_instance: id,
      limit_n: 15,
    });
    setPriority(priorityData ?? []);

    // Load ADM3 boundaries and overlay scores
    const { data: geo } = await supabase.rpc('get_admin_boundaries_geojson', { in_level: 'ADM3' });
    if (!geo || !geo.features) return;

    // Get ADM3 scores from Final pillar for this instance
    const { data: scores } = await supabase
      .from('scored_instance_values')
      .select('pcode, score')
      .eq('instance_id', id)
      .eq('pillar', 'Final');

    // Create score lookup
    const scoreMap: Record<string, number> = {};
    scores?.forEach((s) => {
      scoreMap[s.pcode] = Number(s.score);
    });

    // Filter ADM3s in affected ADM1s
    const adm1Scope = inst?.admin_scope || [];
    const filtered = geo.features.filter((f: any) => {
      const code = f.properties?.admin_pcode || '';
      return adm1Scope.some((adm1: string) => code.startsWith(adm1));
    });

    // Attach score attribute
    filtered.forEach((f: any) => {
      const code = f.properties?.admin_pcode;
      f.properties.score = scoreMap[code] ?? null;
    });

    setAdm3Geo({ type: 'FeatureCollection', features: filtered });
  };

  useEffect(() => {
    loadInstanceData();
  }, [id]);

  // --- Define color scale
  const getColor = (score: number | null) => {
    if (score === null || score === undefined) return '#ccc';
    if (score <= 1.5) return '#2e7d32'; // green
    if (score <= 2.5) return '#a2b837'; // yellow-green
    if (score <= 3.5) return '#f6d32d'; // yellow
    if (score <= 4.5) return '#e67e22'; // orange
    return '#630710'; // deep red
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const props = feature.properties;
    const score = props?.score ?? 'N/A';
    const name = props?.name ?? props?.admin_pcode ?? 'Unknown';
    layer.bindTooltip(`${name}<br/>Final Score: ${score}`, {
      sticky: true,
    });
  };

  const styleFeature = (feature: any) => ({
    color: '#555',
    weight: 0.5,
    fillColor: getColor(feature?.properties?.score ?? null),
    fillOpacity: 0.7,
  });

  const whenReady = (map: L.Map) => {
    mapRef.current = map;
    if (adm3Geo?.features?.length) {
      const bounds = L.geoJSON(adm3Geo).getBounds();
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  };

  useEffect(() => {
    if (mapRef.current && adm3Geo?.features?.length) {
      const bounds = L.geoJSON(adm3Geo).getBounds();
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [adm3Geo]);

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--gsc-blue,#004b87)]">
          {instance?.name ?? 'Instance Dashboard'}
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

      <div className="grid grid-cols-12 gap-5">
        {/* Map */}
        <div className="col-span-7 bg-white border rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between mb-2 text-sm font-medium text-gray-700">
            <span>Affected Area (ADM3 Final Scores)</span>
            <span className="text-gray-400 text-xs">
              {instance?.admin_scope?.length ?? 0} ADM1 selected
            </span>
          </div>

          <div className="h-[520px] rounded overflow-hidden border relative z-0">
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={5}
              whenReady={(e) => whenReady(e.target)}
              scrollWheelZoom={true}
              className="h-full w-full"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {adm3Geo && (
                <GeoJSON data={adm3Geo} style={styleFeature} onEachFeature={onEachFeature} />
              )}
            </MapContainer>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Displaying ADM3 polygons within affected ADM1 scope, colored by Final Score.
          </p>
        </div>

        {/* Metrics + Table */}
        <div className="col-span-5 flex flex-col gap-4">
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">Summary Metrics</div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">Framework Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
                  {summary?.framework_avg?.toFixed(3) ?? '-'}
                </div>
              </div>
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">Final Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-red,#630710)]">
                  {summary?.final_avg?.toFixed(3) ?? '-'}
                </div>
              </div>
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3 col-span-2">
                <div className="text-xs text-gray-600">People Affected</div>
                <div className="text-lg font-semibold text-[var(--gsc-blue,#004b87)]">
                  {summary?.people_affected?.toLocaleString() ?? '-'}
                </div>
              </div>
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">People of Concern</div>
                <div className="text-lg font-semibold text-[var(--gsc-orange,#d35400)]">
                  {summary?.people_of_concern?.toLocaleString() ?? '-'}
                </div>
              </div>
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">People in Need</div>
                <div className="text-lg font-semibold text-[var(--gsc-green,#2e7d32)]">
                  {summary?.people_in_need?.toLocaleString() ?? '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg shadow-sm p-4 overflow-auto max-h-[420px]">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Priority Locations (Top 15)
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-gray-500 text-xs border-b">
                  <th className="text-left py-1">ADM2</th>
                  <th className="text-left py-1">ADM3</th>
                  <th className="text-right py-1">Final Score</th>
                  <th className="text-right py-1">Population</th>
                  <th className="text-right py-1">People in Need</th>
                </tr>
              </thead>
              <tbody>
                {priority.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-3">
                      No data available
                    </td>
                  </tr>
                )}
                {priority.map((p) => (
                  <tr key={p.pcode} className="border-b last:border-none hover:bg-gray-50">
                    <td className="py-1">{p.adm2_name ?? '-'}</td>
                    <td className="py-1">{p.adm3_name ?? '-'}</td>
                    <td className="py-1 text-right">{p.final_score?.toFixed(3) ?? '-'}</td>
                    <td className="py-1 text-right">{p.population?.toLocaleString() ?? '-'}</td>
                    <td className="py-1 text-right text-[var(--gsc-green,#2e7d32)] font-medium">
                      {p.people_in_need?.toLocaleString() ?? '-'}
                    </td>
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
          onSaved={loadInstanceData}
        />
      )}
    </div>
  );
}
