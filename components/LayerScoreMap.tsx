'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { Map, RefreshCw } from 'lucide-react';

interface Props {
  responseId: string;
  layerId: string | null;
  adminScope: string[];
}

type ScoreRecord = {
  admin_pcode: string;
  score: number;
  category: string;
};

// Component to fit bounds
function FitBounds({ geojson }: { geojson: FeatureCollection | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (geojson && geojson.features.length > 0) {
      try {
        const L = require('leaflet');
        const bounds = L.geoJSON(geojson).getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      } catch (e) {
        // Ignore bounds errors
      }
    }
  }, [map, geojson]);
  
  return null;
}

export default function LayerScoreMap({ responseId, layerId, adminScope }: Props) {
  const supabase = createClient();
  
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [boundaries, setBoundaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'score' | 'baseline'>('score');
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    loadData();
  }, [responseId, layerId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    // Add timeout for queries
    const timeout = (ms: number) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    );
    
    try {
      // Load scores from response_scores table with timeout
      const scorePromise = supabase
        .from('response_scores')
        .select('admin_pcode, score, category')
        .eq('response_id', responseId)
        .eq('category', 'Overall');

      const { data: scoreData, error: scoreError } = await Promise.race([
        scorePromise,
        timeout(10000)
      ]) as any;

      if (scoreError) {
        console.error('Score error:', scoreError);
        setError('Failed to load scores');
        return;
      }
      
      setScores(scoreData || []);

      // Get unique PCodes from scores to load their boundaries
      const scorePcodes = [...new Set((scoreData || []).map((s: ScoreRecord) => s.admin_pcode))];
      
      if (scorePcodes.length > 0) {
        // Load boundaries using RPC that returns GeoJSON FeatureCollection
        // Use named parameter to avoid ambiguity with multiple function signatures
        const boundaryPromise = supabase.rpc('get_admin_boundaries_geojson', {
          admin_pcodes: scorePcodes
        });

        const { data: geojsonData, error: boundaryError } = await Promise.race([
          boundaryPromise,
          timeout(15000)
        ]) as any;

        if (boundaryError) {
          console.error('Boundary error:', boundaryError);
          // Fallback: try direct query without geometry
          const { data: basicData } = await supabase
            .from('admin_boundaries')
            .select('admin_pcode, name, parent_pcode')
            .in('admin_pcode', scorePcodes);
          
          if (basicData) {
            setBoundaries(basicData);
          }
        } else if (geojsonData?.features && Array.isArray(geojsonData.features)) {
          // RPC returns a FeatureCollection with features array
          setBoundaries(geojsonData.features);
        }
      }
    } catch (err: any) {
      console.error('Error loading map data:', err);
      if (err.message === 'Request timeout') {
        setError('Connection timeout - Supabase may be slow or paused');
      } else {
        setError(err.message || 'Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  // Build GeoJSON from boundaries and scores
  const geojson = useMemo<FeatureCollection | null>(() => {
    if (boundaries.length === 0) return null;

    const features: Feature[] = boundaries
      .filter((b: any) => b.geometry) // Only include boundaries with geometry
      .map((b: any) => {
        // b is already a GeoJSON feature from the RPC
        const pcode = b.properties?.admin_pcode || b.admin_pcode;
        const name = b.properties?.name || b.name;
        const scoreRecord = scores.find(s => s.admin_pcode === pcode);
        
        let geometry: Geometry | null = null;
        
        // Handle different formats - could be a Feature or raw boundary
        if (b.type === 'Feature' && b.geometry) {
          geometry = b.geometry;
        } else if (b.geometry) {
          if (typeof b.geometry === 'string') {
            try {
              geometry = JSON.parse(b.geometry);
            } catch {
              return null;
            }
          } else if (b.geometry.type) {
            geometry = b.geometry;
          }
        }

        if (!geometry) return null;

        return {
          type: 'Feature' as const,
          properties: {
            admin_pcode: pcode,
            name: name,
            score: scoreRecord?.score || null
          },
          geometry
        } as Feature;
      })
      .filter((f): f is Feature => f !== null);

    return {
      type: 'FeatureCollection',
      features
    };
  }, [boundaries, scores]);

  const getScoreColor = (score: number | null) => {
    if (score === null) return '#9CA3AF'; // gray-400
    if (score <= 1.5) return '#22C55E'; // green-500
    if (score <= 2.5) return '#84CC16'; // lime-500
    if (score <= 3.5) return '#EAB308'; // yellow-500
    if (score <= 4.5) return '#F97316'; // orange-500
    return '#EF4444'; // red-500
  };

  const style = (feature: Feature) => {
    const score = feature.properties?.score;
    return {
      fillColor: getScoreColor(score),
      weight: 2,
      opacity: 1,
      color: '#374151',
      fillOpacity: 0.7
    };
  };

  const onEachFeature = (feature: Feature, layer: any) => {
    const props = feature.properties || {};
    const tooltipContent = `
      <div style="font-size: 12px;">
        <div style="font-weight: 600;">${props.name || props.admin_pcode}</div>
        <div style="margin-top: 4px;">
          Score: <strong>${props.score?.toFixed(2) || 'N/A'}</strong>
        </div>
      </div>
    `;
    layer.bindTooltip(tooltipContent, { sticky: true });
  };

  // Calculate average score
  const avgScore = scores.length > 0 
    ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length 
    : null;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Map size={18} />
          <h4 className="font-semibold">Score Map</h4>
        </div>
        <div className="h-[400px] bg-gray-100 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
            <p className="text-gray-500">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Map size={18} />
          <h4 className="font-semibold">Score Map</h4>
        </div>
        <div className="h-[400px] bg-red-50 border border-red-200 flex items-center justify-center rounded-lg">
          <div className="text-center text-red-700">
            <p className="font-medium">Failed to load map</p>
            <p className="text-sm mt-1">{error}</p>
            <button 
              onClick={loadData}
              className="mt-3 px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!geojson || geojson.features.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map size={18} />
            <h4 className="font-semibold">Score Map</h4>
          </div>
          <button onClick={loadData} className="text-gray-400 hover:text-gray-600">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="h-[400px] bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center rounded-lg">
          <div className="text-center text-gray-500">
            <Map size={48} className="mx-auto mb-3 opacity-50" />
            <p className="font-medium">No map data available</p>
            <p className="text-sm mt-1">
              {adminScope.length === 0 
                ? 'No affected areas defined for this response'
                : 'Boundary data not found for affected areas'}
            </p>
            <p className="text-xs mt-2 text-gray-400">
              {scores.length} score records found
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map size={18} />
          <h4 className="font-semibold">
            Score Map {layerId ? '(at selected layer)' : '(Baseline)'}
          </h4>
        </div>
        <button 
          onClick={() => { loadData(); setMapKey(k => k + 1); }}
          className="text-gray-400 hover:text-gray-600"
          title="Refresh map"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats bar */}
      {avgScore !== null && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            Avg Score: <strong className={
              avgScore <= 2.5 ? 'text-green-600' :
              avgScore <= 3.5 ? 'text-yellow-600' : 'text-red-600'
            }>{avgScore.toFixed(2)}</strong>
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">{scores.length} areas</span>
        </div>
      )}

      {/* Map */}
      <div className="h-[400px] rounded-lg overflow-hidden border">
        <MapContainer
          key={mapKey}
          center={[12.8797, 121.7740]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <GeoJSON 
            key={`geojson-${layerId}-${mapKey}`}
            data={geojson} 
            style={style}
            onEachFeature={onEachFeature}
          />
          <FitBounds geojson={geojson} />
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: '#22C55E' }} /> 1-2 (Low)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: '#EAB308' }} /> 3 (Medium)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: '#F97316' }} /> 4 (High)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }} /> 5 (Critical)
        </span>
      </div>
    </div>
  );
}
