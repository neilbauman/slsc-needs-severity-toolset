'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';

// --- lazy-load react-leaflet ---
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

export default function InstanceDashboard() {
  const supabase = createClient();
  const { id } = useParams();

  const [instance, setInstance] = useState<any>(null);
  const [geojson, setGeojson] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // --- load instance, summary, and map data
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: inst } = await supabase.from('instances').select('*').eq('id', id).single();
      setInstance(inst);

      const { data: sum } = await supabase.rpc('get_instance_summary', { in_instance: id });
      setSummary(sum?.[0] ?? null);

      const { data: sc } = await supabase.rpc('get_priority_locations', {
        in_instance: id,
        limit_n: 10000,
      });
      setScores(sc ?? []);

      const { data: gj } = await supabase.rpc('get_admin_boundaries_geojson', { in_level: 'ADM3' });
      setGeojson(gj ?? null);

      setLoading(false);
    })();
  }, [id]);

  // normalize codes and enrich geojson
  const normalize = (code: any) => {
    if (!code) return '';
    return String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  };

  const matchKey = (code: string, keys: string[]) => {
    const normalized = normalize(code);
    // find best match by prefix
    return (
      keys.find((k) => normalized.startsWith(k)) ||
      keys.find((k) => k.startsWith(normalized)) ||
      null
    );
  };

  const enriched = useMemo(() => {
    if (!geojson || !scores?.length) return geojson;
    const scoreMap: Record<string, any> = {};
    const keys: string[] = [];

    for (const s of scores) {
      const key = normalize(s.pcode.slice(0, 9));
      scoreMap[key] = s;
      keys.push(key);
    }

    return {
      ...geojson,
      features: (geojson.features ?? []).map((f: any) => {
        const code = normalize(f?.properties?.admin_pcode);
        const matchedKey = matchKey(code, keys);
        const match = matchedKey ? scoreMap[matchedKey] : null;
        return {
          ...f,
          properties: {
            ...f.properties,
            final_score: match?.final_score ?? null,
            population: match?.population ?? null,
            people_in_need: match?.people_in_need ?? null,
            adm3_name: match?.adm3_name ?? f?.properties?.name ?? null,
            adm2_name: match?.adm2_name ?? null,
          },
        };
      }),
    };
  }, [geojson, scores]);

  const colorForScore = (s: number | null) => {
    if (s == null || isNaN(Number(s))) return '#cccccc';
    if (s < 1.5) return '#2e7d32'; // green
    if (s < 2.5) return '#d35400'; // orange
    if (s < 3.5) return '#e3b505'; // yellow
    if (s < 4.5) return '#e67e22'; // dark orange
    return '#630710'; // deep red
  };

  const onEachFeature = (feature: any, layer: any) => {
    const p = feature?.properties || {};
    const name =
      p.adm3_name || p.name || p.admin_pcode || p.adm2_name || '—';
    const score =
      p.final_score == null
        ? '—'
        : Number(p.final_score).toFixed(3);
    const pop =
      p.population == null
        ? '—'
        : Number(p.population).toLocaleString();
    const pin =
      p.people_in_need == null
        ? '—'
        : Number(p.people_in_need).toLocaleString();

    layer.bindTooltip(
      `<strong>${name}</strong><br/>Final: <b>${score}</b><br/>Pop: ${pop}<br/>People in need: ${pin}`,
      { sticky: true }
    );
  };

  if (loading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen space-y-4">
      <h1 className="text-xl font-semibold text-[var(--gsc-blue,#004b87)] mb-2">
        {instance?.name ?? 'Instance'}
      </h1>

      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Framework Avg" value={summary.framework_avg} color="blue" />
          <Stat label="Final Avg" value={summary.final_avg} color="red" />
          <Stat label="People Affected" value={summary.people_affected} color="gray" />
          <Stat label="People in Need" value={summary.people_in_need} color="green" />
        </div>
      )}

      <div className="relative h-[650px] border rounded-lg overflow-hidden shadow">
        <MapContainer
          center={[12.8797, 121.774]}
          zoom={6}
          scrollWheelZoom
          className="h-full w-full z-0"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {enriched && (
            <GeoJSON
              key="adm3"
              data={enriched}
              style={(feat: any) => ({
                color: '#374151',
                weight: 0.5,
                fillColor: colorForScore(feat?.properties?.final_score),
                fillOpacity: 0.8,
              })}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-white p-3 rounded shadow text-sm space-y-1">
          <div className="font-semibold">Score Legend</div>
          <LegendItem color="#2e7d32" label="≤1.5  Low (Green)" />
          <LegendItem color="#d35400" label="≤2.5  Moderate" />
          <LegendItem color="#e3b505" label="≤3.5  Elevated" />
          <LegendItem color="#e67e22" label="≤4.5  High" />
          <LegendItem color="#630710" label=">4.5  Severe" />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: any;
  color: string;
}) {
  const palette: Record<string, string> = {
    blue: '#004b87',
    red: '#630710',
    green: '#2e7d32',
    gray: '#374151',
  };
  return (
    <div className="bg-white p-4 rounded border shadow-sm text-center">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-xl font-semibold" style={{ color: palette[color] }}>
        {value ?? '–'}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center space-x-2">
      <span className="w-4 h-4 rounded" style={{ backgroundColor: color }}></span>
      <span>{label}</span>
    </div>
  );
}
