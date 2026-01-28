'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabaseClient';

function getColor(score: number): string {
  if (score < 1.5) return '#00FF00';
  if (score < 2.5) return '#CCFF00';
  if (score < 3.5) return '#FFCC00';
  if (score < 4.5) return '#FF6600';
  return '#FF0000';
}

function MapBoundsController({ features }: { features: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (features.length > 0) {
      try {
        const bounds = L.geoJSON(features).getBounds();
        map.fitBounds(bounds, { padding: [8, 8], maxZoom: 11 });
      } catch (err) {
        console.error('BaselineMap bounds:', err);
      }
    }
  }, [features, map]);
  return null;
}

function matchCategoryToLayer(category: string, layer: string): boolean {
  const c = (category || '').trim().toLowerCase();
  if (layer === 'overall') return true;
  if (layer === 'P1') return c.startsWith('p1') && !c.startsWith('p3');
  if (layer === 'P2') return c.startsWith('p2');
  if (layer === 'P3') return c.startsWith('p3');
  if (layer === 'Hazard') return c.includes('hazard') || c.startsWith('p3.2');
  if (layer === 'Underlying Vulnerability') return c.includes('underlying') || c.includes('vuln') || c.startsWith('p3.1');
  return category === layer;
}

interface Props {
  baselineId: string;
  countryId: string | null;
  adminLevel?: string;
  computedAt: string | null;
  selectedLayer: string;
}

export default function BaselineMap({ baselineId, countryId, adminLevel = 'ADM3', computedAt, selectedLayer }: Props) {
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!baselineId || !countryId || !computedAt) {
      setFeatures([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Paginate to get all baseline_scores
        const allScores: { admin_pcode: string; score: number; category: string }[] = [];
        const pageSize = 2000;
        let offset = 0;
        while (true) {
          const { data, error: e } = await supabase
            .from('baseline_scores')
            .select('admin_pcode, score, category')
            .eq('baseline_id', baselineId)
            .range(offset, offset + pageSize - 1);
          if (e) throw e;
          if (!data || data.length === 0) break;
          allScores.push(...data.map((r: any) => ({
            admin_pcode: String(r.admin_pcode || '').trim(),
            score: Number(r.score),
            category: String(r.category || '').trim(),
          })));
          if (data.length < pageSize) break;
          offset += pageSize;
        }

        const filtered = selectedLayer
          ? allScores.filter((r) => matchCategoryToLayer(r.category, selectedLayer))
          : allScores;
        const byPcode = new Map<string, { sum: number; n: number }>();
        filtered.forEach((r) => {
          const p = r.admin_pcode;
          if (!p) return;
          if (!byPcode.has(p)) byPcode.set(p, { sum: 0, n: 0 });
          const x = byPcode.get(p)!;
          x.sum += r.score;
          x.n += 1;
        });
        const scoreByPcode = new Map<string, number>();
        byPcode.forEach((v, p) => scoreByPcode.set(p, v.sum / v.n));

        const geoRes = await supabase.rpc('get_admin_boundaries_geojson', {
          country_id: countryId,
          admin_level: adminLevel,
        });
        if (cancelled) return;
        if (geoRes.error) throw geoRes.error;

        const raw = geoRes.data;
        const fc = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const allPcodes = Array.from(scoreByPcode.keys());
        const feats = (fc?.features || []).map((f: any) => {
          const pcode = f?.properties?.admin_pcode != null ? String(f.properties.admin_pcode).trim() : '';
          let score = pcode ? scoreByPcode.get(pcode) : undefined;
          if (score == null && pcode) {
            const exact = scoreByPcode.get(pcode);
            if (exact != null) {
              score = exact;
            } else {
              const childScores = allPcodes.filter((sp) => sp.startsWith(pcode + '.') || sp === pcode).map((sp) => scoreByPcode.get(sp)!);
              if (childScores.length > 0) score = childScores.reduce((a, b) => a + b, 0) / childScores.length;
            }
          }
          return {
            ...f,
            properties: {
              ...f.properties,
              admin_pcode: pcode || f?.properties?.admin_pcode,
              admin_name: f?.properties?.name ?? f?.properties?.admin_name,
              score: score != null ? score : undefined,
              has_score: score != null,
            },
          };
        });
        setFeatures(feats);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load map data');
          setFeatures([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [baselineId, countryId, adminLevel, computedAt, selectedLayer]);

  const applyStyle = (l: L.Layer, fillColor: string, fillOpacity: number, strokeColor = '#000') => {
    if ('setStyle' in l && typeof (l as L.Path).setStyle === 'function') {
      (l as L.Path).setStyle({ color: strokeColor, weight: 1, fillColor, fillOpacity });
    }
    if ('eachLayer' in l && typeof (l as L.LayerGroup).eachLayer === 'function') {
      (l as L.LayerGroup).eachLayer((sublayer) => applyStyle(sublayer, fillColor, fillOpacity, strokeColor));
    }
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const name = feature.properties?.admin_name || feature.properties?.name || 'Unknown';
    const score = feature.properties?.score;
    const hasScore = feature.properties?.has_score === true;

    if (hasScore && score != null) {
      applyStyle(layer, getColor(score), 0.6);
    } else {
      applyStyle(layer, '#e5e7eb', 0.5, '#999');
    }
    const tooltipContent = hasScore && score != null
      ? `<strong>${name}</strong><br/>Score: ${Number(score).toFixed(2)}`
      : `<strong>${name}</strong><br/>No score`;
    if ('bindTooltip' in layer && typeof (layer as L.Layer).bindTooltip === 'function') {
      (layer as L.Layer).bindTooltip(tooltipContent, { permanent: false, direction: 'top' });
    }
  };

  if (!countryId || !computedAt) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500 h-full min-h-[320px]">
        No map: set country and compute baseline scores.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500 h-full min-h-[320px]">
        Loading map…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-center text-sm text-amber-800 p-4 h-full min-h-[320px]">
        {error}
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500 h-full min-h-[320px]">
        No boundaries or scores for this layer.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white h-full w-full flex flex-col">
      <div className="flex-1 min-h-0 relative">
        <MapContainer
          center={[12.88, 121.77]}
          zoom={6}
          minZoom={3}
          maxZoom={14}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapBoundsController features={features} />
          <GeoJSON
            key={`baseline-${baselineId}-${selectedLayer}-${features.length}`}
            data={{ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection}
            onEachFeature={onEachFeature}
          />
        </MapContainer>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <span>Green (1) → Red (5) severity</span>
      </div>
    </div>
  );
}
