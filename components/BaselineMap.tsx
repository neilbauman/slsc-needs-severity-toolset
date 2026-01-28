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

interface Props {
  baselineId: string;
  countryId: string | null;
  adminLevel?: string;
  computedAt: string | null;
}

export default function BaselineMap({ baselineId, countryId, adminLevel = 'ADM3', computedAt }: Props) {
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
        const [scoresRes, geoRes] = await Promise.all([
          supabase.from('baseline_scores').select('admin_pcode, score').eq('baseline_id', baselineId),
          supabase.rpc('get_admin_boundaries_geojson', {
            country_id: countryId,
            admin_level: adminLevel,
          }),
        ]);

        if (cancelled) return;
        if (scoresRes.error) throw scoresRes.error;
        if (geoRes.error) throw geoRes.error;

        const rows = scoresRes.data || [];
        const byPcode = new Map<string, { sum: number; n: number }>();
        rows.forEach((r: any) => {
          const p = r.admin_pcode;
          const s = Number(r.score);
          if (!byPcode.has(p)) byPcode.set(p, { sum: 0, n: 0 });
          const x = byPcode.get(p)!;
          x.sum += s;
          x.n += 1;
        });
        const scoreByPcode = new Map<string, number>();
        byPcode.forEach((v, p) => scoreByPcode.set(p, v.sum / v.n));

        const raw = geoRes.data;
        const fc = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const feats = (fc?.features || []).map((f: any) => {
          const pcode = f?.properties?.admin_pcode;
          const score = pcode != null ? scoreByPcode.get(pcode) : undefined;
          return {
            ...f,
            properties: {
              ...f.properties,
              admin_pcode: pcode ?? f?.properties?.admin_pcode,
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
  }, [baselineId, countryId, adminLevel, computedAt]);

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
      <div className="rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500" style={{ height: '320px' }}>
        No map: set country and compute baseline scores.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500" style={{ height: '320px' }}>
        Loading map…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-center text-sm text-amber-800 p-4" style={{ height: '320px' }}>
        {error}
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500" style={{ height: '320px' }}>
        No boundaries or scores for this level.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white" style={{ height: '320px' }}>
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
          key={`baseline-${baselineId}-${features.length}`}
          data={{ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection}
          onEachFeature={onEachFeature}
        />
      </MapContainer>
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <span>Green (1) → Red (5) severity</span>
      </div>
    </div>
  );
}
