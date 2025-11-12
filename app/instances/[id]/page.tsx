'use client';

import {useEffect, useMemo, useState, useRef, useCallback} from 'react';
import {useParams, useRouter} from 'next/navigation';
import dynamic from 'next/dynamic';
import {createClient} from '@/lib/supabaseClient';

// Lazy-load leaflet bits
const MapContainer: any = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer: any     = dynamic(() => import('react-leaflet').then(m => m.TileLayer),     { ssr: false });
const GeoJSON: any       = dynamic(() => import('react-leaflet').then(m => m.GeoJSON),       { ssr: false });

type SummaryRow = {
  framework_avg: number | null;
  final_avg: number | null;
  people_affected: number | null;
  people_of_concern: number | null;
  people_in_need: number | null;
};

type PriorityRow = {
  adm2_name: string | null;
  adm3_name: string | null;
  pcode: string;
  final_score: number | null;
  population: number | null;
  poverty_rate: number | null;
  people_in_need: number | null;
};

type ScoreRow = { adm3_code_full: string; adm3_name: string | null; adm2_name: string | null; final_score: number | null };

// very light GeoJSON typings for our use
type GJ = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: any;
    properties: { [k: string]: any };
  }>;
};

export default function InstancePage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [instance, setInstance] = useState<any>(null);

  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [priority, setPriority] = useState<PriorityRow[]>([]);

  const [adm3Geo, setAdm3Geo] = useState<GJ | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({}); // key: ADM3 pcode (11 chars)

  // --- load instance base
  const loadInstance = useCallback(async () => {
    const inst = await supabase.from('instances').select('*').eq('id', id).single();
    setInstance(inst.data ?? null);
  }, [id, supabase]);

  // --- load summary
  const loadSummary = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_instance_summary', { in_instance: id });
    if (!error && data && Array.isArray(data) && data.length > 0) {
      setSummary(data[0] as SummaryRow);
    } else {
      setSummary(null);
    }
  }, [id, supabase]);

  // --- load priority locations (top 15)
  const loadPriority = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_priority_locations', { in_instance: id, limit_n: 15 });
    setPriority(!error && Array.isArray(data) ? (data as PriorityRow[]) : []);
  }, [id, supabase]);

  // --- load ADM3 polygons (one call returns FeatureCollection)
  const loadAdm3Geo = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_admin_boundaries_geojson', { in_level: 'ADM3' });
    if (!error && data) {
      setAdm3Geo(data as GJ);
    } else {
      setAdm3Geo(null);
    }
  }, [supabase]);

  // --- load ADM3 scores (now 11-char codes)
  const loadScores = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_adm3_scores', { in_instance: id });
    if (!error && Array.isArray(data)) {
      const map: Record<string, number> = {};
      (data as ScoreRow[]).forEach(r => {
        if (r.adm3_code_full && typeof r.final_score === 'number') {
          map[r.adm3_code_full] = r.final_score;
        }
      });
      setScores(map);
    } else {
      setScores({});
    }
  }, [id, supabase]);

  useEffect(() => {
    loadInstance();
    loadSummary();
    loadPriority();
    loadAdm3Geo();
    loadScores();
  }, [loadInstance, loadSummary, loadPriority, loadAdm3Geo, loadScores]);

  // Merge scores into adm3 properties (memoized so we don’t mutate state)
  const scoredAdm3: GJ | null = useMemo(() => {
    if (!adm3Geo) return null;
    const clone: GJ = {
      type: 'FeatureCollection',
      features: adm3Geo.features.map(f => {
        const p = { ...(f.properties || {}) };
        const code: string = (p.admin_pcode || '').toString().toUpperCase();
        const s = scores[code];
        if (typeof s === 'number') {
          p.final_score = s;
        } else {
          p.final_score = null;
        }
        return { ...f, properties: p };
      })
    };
    return clone;
  }, [adm3Geo, scores]);

  // styling
  const getColor = (score: number | null | undefined) => {
    if (score == null) return 'rgba(0,0,0,0)'; // no data, transparent fill
    if (score <= 1.5) return '#43a047';       // green
    if (score <= 2.5) return '#f9a825';       // amber
    if (score <= 3.5) return '#fb8c00';       // orange
    if (score <= 4.5) return '#ef6c00';       // dark orange
    return '#c62828';                         // red
  };

  const styleFn = useCallback((feat: any) => {
    const s = typeof feat?.properties?.final_score === 'number' ? feat.properties.final_score : null;
    return {
      color: '#5f6b7a',         // outline
      weight: 0.6,
      fillColor: getColor(s),
      fillOpacity: s == null ? 0.05 : 0.55,
    };
  }, []);

  const onEachFeature = useCallback((feat: any, layer: any) => {
    const p = feat?.properties || {};
    const nm = p.name || p.admin_pcode || '';
    const sc = p.final_score == null ? '–' : Number(p.final_score).toFixed(3);
    layer.bindTooltip(`${nm}<br/>Final: <b>${sc}</b>`, { sticky: true, direction: 'auto' });
  }, []);

  // Legend
  const Legend = () => (
    <div className="absolute right-3 bottom-3 z-[500] bg-white/90 rounded-md shadow p-2 text-xs leading-5">
      <div className="font-semibold mb-1">Score Legend</div>
      {[
        {c:'#43a047', t:'≤1.5 Low (Green)'},
        {c:'#f9a825', t:'≤2.5 Moderate'},
        {c:'#fb8c00', t:'≤3.5 Elevated'},
        {c:'#ef6c00', t:'≤4.5 High'},
        {c:'#c62828', t:'>4.5 Severe'},
        {c:'rgba(0,0,0,0)', t:'No data'},
      ].map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm border" style={{background: it.c}} />
          <span>{it.t}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen">
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
            onClick={() => router.push(`/instances/${id}/define-affected`)}
            className="px-3 py-1.5 rounded text-sm bg-[var(--gsc-green,#2e7d32)] text-white hover:opacity-90"
          >
            Define Affected Area
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Map */}
        <div className="col-span-7 bg-white border rounded-lg shadow-sm p-3 relative">
          <div className="flex items-center justify-between mb-2 text-sm font-medium text-gray-700">
            <span>Affected Area (ADM3 Final Scores)</span>
          </div>
          <div className="h-[520px] rounded overflow-hidden border relative">
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={5}
              scrollWheelZoom={true}
              className="h-full w-full"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {scoredAdm3 && (
                <GeoJSON data={scoredAdm3 as any} style={styleFn} onEachFeature={onEachFeature} />
              )}
            </MapContainer>
            <Legend />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            ADM3 polygons are shaded by <em>Final</em> score (greens → reds). “No data” areas are transparent.
          </p>
        </div>

        {/* Metrics / Controls */}
        <div className="col-span-5 space-y-4">
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Summary Metrics</div>
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
              <div className="bg-gray-100 rounded p-3 text-center">
                <div className="text-xs text-gray-600">Framework Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
                  {summary?.framework_avg ?? '-'}
                </div>
              </div>
              <div className="bg-gray-100 rounded p-3 text-center">
                <div className="text-xs text-gray-600">Final Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-red,#630710)]">
                  {summary?.final_avg ?? '-'}
                </div>
              </div>
              <div className="bg-gray-100 rounded p-3 text-center">
                <div className="text-xs text-gray-600">People Affected</div>
                <div className="text-lg font-semibold">{summary?.people_affected?.toLocaleString() ?? '-'}</div>
              </div>
              <div className="bg-gray-100 rounded p-3 text-center">
                <div className="text-xs text-gray-600">People in Need</div>
                <div className="text-lg font-semibold">{summary?.people_in_need?.toLocaleString() ?? '-'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Recompute</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => { await supabase.rpc('score_framework_aggregate', { in_instance_id: id }); await loadSummary(); }}
                className="flex-1 bg-[var(--gsc-blue,#004b87)] text-white py-2 rounded hover:opacity-90 text-sm"
              >
                Recompute Framework
              </button>
              <button
                onClick={async () => { await supabase.rpc('score_final_aggregate', { in_instance_id: id }); await loadSummary(); await loadScores(); }}
                className="flex-1 bg-[var(--gsc-green,#2e7d32)] text-white py-2 rounded hover:opacity-90 text-sm"
              >
                Recompute Final
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Priority Locations (Top 15)</div>
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
                {priority.map((r) => (
                  <tr key={r.pcode} className="border-b last:border-none">
                    <td className="py-1">{r.adm2_name ?? '-'}</td>
                    <td className="py-1">{r.adm3_name ?? r.pcode}</td>
                    <td className="py-1 text-right">{r.final_score == null ? '–' : r.final_score.toFixed(3)}</td>
                    <td className="py-1 text-right">{r.population == null ? '–' : r.population.toLocaleString()}</td>
                    <td className="py-1 text-right">{r.people_in_need == null ? '–' : r.people_in_need.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
