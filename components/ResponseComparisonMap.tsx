'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createClient } from '@/lib/supabaseClient';

interface Props {
  responseId: string;
  legacyInstanceId: string;
  adminScope: string[];
}

type ViewMode = 'delta' | 'legacy' | 'response';

// Component to handle map bounds
function MapBoundsController({ features }: { features: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (features.length > 0) {
      try {
        const bounds = L.geoJSON(features).getBounds();
        map.fitBounds(bounds, { padding: [10, 10], maxZoom: 10 });
      } catch (err) {
        console.error('Error fitting bounds:', err);
      }
    }
  }, [features, map]);

  return null;
}

export default function ResponseComparisonMap({ responseId, legacyInstanceId, adminScope }: Props) {
  const supabase = createClient();
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('delta');
  const [scoreData, setScoreData] = useState<Map<string, { legacy: number | null; response: number | null; delta: number | null }>>(new Map());

  useEffect(() => {
    loadMapData();
  }, [responseId, legacyInstanceId]);

  const loadMapData = async () => {
    setLoading(true);
    try {
      // Get response scores
      const { data: responseScores } = await supabase
        .from('response_scores')
        .select('admin_pcode, score')
        .eq('response_id', responseId)
        .eq('category', 'Overall')
        .is('layer_id', null);

      // Get legacy scores
      const { data: legacyScores } = await supabase
        .from('instance_category_scores')
        .select('admin_pcode, score')
        .eq('instance_id', legacyInstanceId)
        .eq('category', 'Overall');

      // Build score map
      const scoreMap = new Map<string, { legacy: number | null; response: number | null; delta: number | null }>();
      
      (legacyScores || []).forEach(s => {
        scoreMap.set(s.admin_pcode, { legacy: s.score, response: null, delta: null });
      });
      
      (responseScores || []).forEach(s => {
        const existing = scoreMap.get(s.admin_pcode) || { legacy: null, response: null, delta: null };
        existing.response = s.score;
        existing.delta = existing.legacy !== null ? s.score - existing.legacy : null;
        scoreMap.set(s.admin_pcode, existing);
      });
      
      setScoreData(scoreMap);

      // Get boundaries as GeoJSON for scored areas
      const scoredPcodes = Array.from(scoreMap.keys());
      if (scoredPcodes.length > 0) {
        const { data: geoJsonFeatures, error: geoError } = await supabase.rpc(
          'get_admin_boundaries_geojson',
          { in_admin_pcodes: scoredPcodes }
        );

        if (geoError) {
          console.error('Error fetching boundaries:', geoError);
          setFeatures([]);
        } else if (geoJsonFeatures) {
          // Merge score data into feature properties
          const featuresWithScores = geoJsonFeatures.map((f: any) => ({
            ...f,
            properties: {
              ...f.properties,
              ...scoreMap.get(f.properties.admin_pcode)
            }
          }));
          setFeatures(featuresWithScores);
        }
      }
    } catch (err) {
      console.error('Error loading map data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getColor = (value: number | null | undefined, mode: ViewMode): string => {
    if (value === null || value === undefined) return '#cccccc';
    
    if (mode === 'delta') {
      // Delta: red for increase, green for decrease, gray for no change
      if (Math.abs(value) < 0.1) return '#e5e7eb'; // gray
      if (value > 0) {
        // Increased vulnerability (bad) - reds
        if (value > 1.5) return '#7f1d1d';
        if (value > 1.0) return '#b91c1c';
        if (value > 0.5) return '#dc2626';
        return '#fca5a5';
      } else {
        // Decreased vulnerability (good) - greens
        if (value < -1.5) return '#14532d';
        if (value < -1.0) return '#15803d';
        if (value < -0.5) return '#22c55e';
        return '#86efac';
      }
    } else {
      // Score view: 1-5 scale, higher is worse
      if (value >= 4.5) return '#7f1d1d';
      if (value >= 4.0) return '#b91c1c';
      if (value >= 3.5) return '#dc2626';
      if (value >= 3.0) return '#f97316';
      if (value >= 2.5) return '#facc15';
      if (value >= 2.0) return '#84cc16';
      if (value >= 1.5) return '#22c55e';
      return '#15803d';
    }
  };

  const styleFeature = (feature: any) => {
    const props = feature.properties;
    let value: number | null = null;
    
    switch (viewMode) {
      case 'delta':
        value = props.delta;
        break;
      case 'legacy':
        value = props.legacy;
        break;
      case 'response':
        value = props.response;
        break;
    }
    
    return {
      fillColor: getColor(value, viewMode),
      weight: 1,
      opacity: 0.8,
      color: '#666',
      fillOpacity: 0.7
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const props = feature.properties;
    const tooltipContent = `
      <div style="padding: 4px;">
        <strong>${props.name || props.admin_pcode}</strong><br/>
        <table style="font-size: 11px; margin-top: 4px;">
          <tr><td>Legacy:</td><td style="padding-left: 8px;">${props.legacy?.toFixed(2) ?? '—'}</td></tr>
          <tr><td>Response:</td><td style="padding-left: 8px;">${props.response?.toFixed(2) ?? '—'}</td></tr>
          <tr><td>Delta:</td><td style="padding-left: 8px; color: ${(props.delta || 0) > 0 ? '#dc2626' : (props.delta || 0) < 0 ? '#22c55e' : '#666'};">
            ${props.delta !== null ? ((props.delta > 0 ? '+' : '') + props.delta.toFixed(2)) : '—'}
          </td></tr>
        </table>
      </div>
    `;
    layer.bindTooltip(tooltipContent, { sticky: true });
  };

  if (loading) {
    return (
      <div className="h-[400px] bg-gray-100 flex items-center justify-center">
        Loading map...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* View Mode Selector */}
      <div className="flex gap-2">
        {(['delta', 'legacy', 'response'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === mode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {mode === 'delta' ? 'Score Delta' : mode === 'legacy' ? 'Legacy Scores' : 'Response Scores'}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        {viewMode === 'delta' ? (
          <>
            <span className="text-gray-500">Vulnerability change:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#15803d' }} />
              <span>-1.5+</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }} />
              <span>-0.5</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#e5e7eb' }} />
              <span>~0</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dc2626' }} />
              <span>+0.5</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#7f1d1d' }} />
              <span>+1.5+</span>
            </div>
          </>
        ) : (
          <>
            <span className="text-gray-500">Score:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#15803d' }} />
              <span>1</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#facc15' }} />
              <span>3</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#7f1d1d' }} />
              <span>5</span>
            </div>
          </>
        )}
      </div>

      {/* Map */}
      <div className="h-[400px] rounded-lg overflow-hidden border">
        <MapContainer
          center={[12.8797, 121.7740]} // Philippines center
          zoom={6}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {features.length > 0 && (
            <>
              <GeoJSON
                key={`${viewMode}-${features.length}`}
                data={{ type: 'FeatureCollection', features } as any}
                style={styleFeature}
                onEachFeature={onEachFeature}
              />
              <MapBoundsController features={features} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Stats */}
      <div className="text-xs text-gray-500">
        {features.length} areas displayed
      </div>
    </div>
  );
}
