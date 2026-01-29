'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
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

function MapBoundsController({ boundaryFeatures }: { boundaryFeatures: any[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (boundaryFeatures.length > 0 && !fitted.current) {
      try {
        const bounds = L.geoJSON(boundaryFeatures).getBounds();
        map.fitBounds(bounds, { padding: [8, 8], maxZoom: 11 });
        fitted.current = true;
      } catch (err) {
        console.error('BaselineMap bounds:', err);
      }
    }
  }, [boundaryFeatures, map]);
  return null;
}

// Layer filtering is handled server-side by get_baseline_map_scores()
// Boundaries are fetched once; scores are fetched per layer to avoid re-downloading large GeoJSON and prevent loops.

interface Props {
  baselineId: string;
  countryId: string | null;
  adminLevel?: string;
  computedAt: string | null;
  selectedLayer: string;
}

export default function BaselineMap({ baselineId, countryId, adminLevel = 'ADM3', computedAt, selectedLayer }: Props) {
  const [boundaryFeatures, setBoundaryFeatures] = useState<any[]>([]);
  const [scoreByPcode, setScoreByPcode] = useState<Map<string, number>>(new Map());
  const [loadingBoundaries, setLoadingBoundaries] = useState(true);
  const [loadingScores, setLoadingScores] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all admin boundaries once per baseline (no selectedLayer dependency)
  useEffect(() => {
    if (!baselineId || !countryId || !computedAt) {
      setBoundaryFeatures([]);
      setLoadingBoundaries(false);
      return;
    }
    let cancelled = false;
    setLoadingBoundaries(true);
    setError(null);
    void (async () => {
      try {
        const geoRes = await supabase.rpc('get_admin_boundaries_geojson', {
          country_id: countryId,
          admin_level: adminLevel,
        });
        if (cancelled) return;
        if (geoRes.error) {
          setError(geoRes.error.message);
          return;
        }
        const raw = geoRes.data;
        let fc: { type?: string; features?: any[] } | null = null;
        try {
          if (typeof raw === 'string') {
            fc = JSON.parse(raw);
          } else if (raw != null && typeof raw === 'object') {
            fc = Array.isArray(raw) && raw.length > 0 ? raw[0] : raw;
          }
        } catch {
          if (!cancelled) setError('Invalid boundaries response');
          return;
        }
        const feats = Array.isArray(fc?.features) ? fc.features : [];
        setBoundaryFeatures(feats);
        if (feats.length > 0) {
          console.log(`[BaselineMap] Loaded ${feats.length} boundary features`);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || 'Failed to load boundaries');
      } finally {
        if (!cancelled) setLoadingBoundaries(false);
      }
    })();
    return () => { cancelled = true; };
  }, [baselineId, countryId, adminLevel, computedAt]);

  // Fetch scores for the selected layer only (smaller payload, no GeoJSON re-fetch)
  useEffect(() => {
    if (!baselineId || !countryId || !computedAt) {
      setScoreByPcode(new Map());
      setLoadingScores(false);
      return;
    }
    let cancelled = false;
    setLoadingScores(true);
    void (async () => {
      try {
        const mapScoresRes = await supabase.rpc('get_baseline_map_scores', {
          in_baseline_id: baselineId,
          in_admin_level: adminLevel,
          in_layer: selectedLayer || 'overall',
        });
        if (cancelled) return;
        if (mapScoresRes.error) {
          console.error('[BaselineMap] RPC error:', mapScoresRes.error);
          setError(mapScoresRes.error.message);
          return;
        }
        const scores = mapScoresRes.data || [];
        const map = new Map<string, number>();
        scores.forEach((r: any) => {
          const p = String(r.admin_pcode ?? '').trim();
          if (!p) return;
          const s = Number(r.avg_score);
          if (Number.isFinite(s)) map.set(p, s);
        });
        setScoreByPcode(map);
      } finally {
        if (!cancelled) setLoadingScores(false);
      }
    })();
    return () => { cancelled = true; };
  }, [baselineId, countryId, adminLevel, computedAt, selectedLayer]);

  // Merge boundaries with scores so every boundary renders (with or without score).
  // Normalize property names: DB RPC uses admin_pcode and name; some sources use admin_name.
  const features = useMemo(() => {
    return boundaryFeatures.map((f: any) => {
      const props = f?.properties ?? {};
      const pcode =
        props.admin_pcode != null
          ? String(props.admin_pcode).trim()
          : (props.pcode != null ? String(props.pcode).trim() : '');
      const score = pcode ? scoreByPcode.get(pcode) : undefined;
      return {
        ...f,
        properties: {
          ...props,
          admin_pcode: pcode || props.admin_pcode,
          admin_name: props.name ?? props.admin_name ?? '',
          score: score != null ? score : undefined,
          has_score: score != null,
        },
      };
    });
  }, [boundaryFeatures, scoreByPcode]);

  const geoJsonData = useMemo(
    () => ({ type: 'FeatureCollection' as const, features }),
    [features]
  );

  const loading = loadingBoundaries || loadingScores;

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
      <div className="rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500 h-full min-h-[320px] p-4 text-center">
        {boundaryFeatures.length === 0
          ? 'No boundaries found for this country and level. Ensure admin_boundaries has ADM3 data for this country.'
          : 'No boundaries or scores for this layer.'}
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
          <MapBoundsController boundaryFeatures={boundaryFeatures} />
          <GeoJSON
            key={`baseline-${baselineId}-${boundaryFeatures.length}`}
            data={geoJsonData}
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
