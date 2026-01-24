'use client';

import { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import type { GeoJSON as GeoJSONType, GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { Eye, EyeOff } from 'lucide-react';
import supabase from '@/lib/supabaseClient';

type CountryDashboardMapProps = {
  countryId: string;
  countryCode?: string;
  adminLevels?: any;
};

// Component to auto-fit map bounds to features
function MapBoundsController({ features }: { features: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (features.length > 0) {
      try {
        const validFeatures = features.filter((f: any) => {
          const geomType = f.geometry?.type;
          return geomType && geomType !== 'Point';
        });
        
        if (validFeatures.length > 0) {
          const bounds = L.geoJSON(validFeatures).getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { 
              padding: [20, 20],
              maxZoom: 8
            });
          }
        }
      } catch (err) {
        console.error("Error fitting bounds:", err);
      }
    }
  }, [features, map]);

  return null;
}

// Default centers by country
const countryCenters: Record<string, [number, number]> = {
  'PHL': [12.8797, 121.774],
  'LKA': [7.8731, 80.7718],
  'BGD': [23.6850, 90.3563],
  'MOZ': [-18.6657, 35.5296],
  'PSE': [31.9522, 35.2332],
  'MDG': [-18.7669, 46.8691],
};

const defaultCenter: [number, number] = [12.8797, 121.774];

export default function CountryDashboardMap({ countryId, countryCode, adminLevels }: CountryDashboardMapProps) {
  const [adminLevelGeo, setAdminLevelGeo] = useState<Record<string, GeoJSONType | null>>({});
  const [datasetLayers, setDatasetLayers] = useState<Record<string, { data: GeoJSONType | null; color: string }>>({});
  const [visibleLevels, setVisibleLevels] = useState<Set<string>>(new Set(['ADM1']));
  const [visibleDatasets, setVisibleDatasets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState<any[]>([]);

  // Load admin boundaries for each level
  useEffect(() => {
    if (!countryId) return;

    const loadBoundaries = async () => {
      setLoading(true);
      const levels = ['ADM1', 'ADM2', 'ADM3', 'ADM4'];
      const newGeo: Record<string, GeoJSONType | null> = {};

      for (const level of levels) {
        try {
          const { data, error } = await supabase.rpc('get_admin_boundaries_geojson', {
            admin_level: level,
            country_id: countryId,
          });

          if (!error && data && data.features && data.features.length > 0) {
            const polygonFeatures = data.features.filter((f: any) => {
              const geomType = f.geometry?.type;
              return geomType === 'Polygon' || geomType === 'MultiPolygon';
            });

            if (polygonFeatures.length > 0) {
              newGeo[level] = {
                type: 'FeatureCollection',
                features: polygonFeatures,
              } as GeoJSONType;
            }
          }
        } catch (err) {
          console.warn(`Failed to load ${level} boundaries:`, err);
        }
      }

      setAdminLevelGeo(newGeo);
      setLoading(false);
    };

    loadBoundaries();
  }, [countryId]);

  // Load population and poverty datasets
  useEffect(() => {
    if (!countryId) return;

    const loadDatasets = async () => {
      const { data } = await supabase
        .from('datasets')
        .select('id, name, type, admin_level')
        .eq('country_id', countryId)
        .or('name.ilike.%Population%,name.ilike.%Poverty%')
        .order('name');

      if (data) {
        setDatasets(data);
      }
    };

    loadDatasets();
  }, [countryId]);

  // Load dataset values as map layers
  useEffect(() => {
    if (datasets.length === 0) return;

    const loadDatasetLayers = async () => {
      const newLayers: Record<string, { data: GeoJSONType | null; color: string }> = {};

      for (const dataset of datasets) {
        try {
          // Get values
          const { data: values } = await supabase
            .from(dataset.type === 'numeric' ? 'dataset_values_numeric' : 'dataset_values_categorical')
            .select('admin_pcode, value')
            .eq('dataset_id', dataset.id)
            .limit(1000); // Limit for performance

          if (!values || values.length === 0) continue;

          // Get boundaries for this admin level
          const { data: boundaries } = await supabase.rpc('get_admin_boundaries_geojson', {
            admin_level: dataset.admin_level,
            country_id: countryId,
          });

          if (!boundaries || !boundaries.features) continue;

          // Create value map
          const valueMap = new Map(values.map((v: any) => [v.admin_pcode, v.value]));

          // Color by value
          const maxValue = Math.max(...Array.from(valueMap.values()).filter((v: any) => typeof v === 'number' && !isNaN(v)));
          const minValue = Math.min(...Array.from(valueMap.values()).filter((v: any) => typeof v === 'number' && !isNaN(v)));

          // Create colored features
          const coloredFeatures = boundaries.features.map((f: any) => {
            const pcode = f.properties?.admin_pcode;
            const value = valueMap.get(pcode);
            const normalized = maxValue > minValue ? ((value - minValue) / (maxValue - minValue)) : 0.5;
            
            // Color scale: blue (low) to red (high)
            const hue = 240 - (normalized * 120); // 240 (blue) to 120 (green/yellow)
            const color = `hsl(${hue}, 70%, 50%)`;

            return {
              ...f,
              properties: {
                ...f.properties,
                value,
                _color: color,
              }
            };
          });

          newLayers[dataset.id] = {
            data: {
              type: 'FeatureCollection',
              features: coloredFeatures,
            } as GeoJSONType,
            color: dataset.name.toLowerCase().includes('population') ? '#3b82f6' : '#ef4444',
          };
        } catch (err) {
          console.warn(`Failed to load dataset layer for ${dataset.name}:`, err);
        }
      }

      setDatasetLayers(newLayers);
    };

    loadDatasetLayers();
  }, [datasets, countryId]);

  const allFeatures = useMemo(() => {
    const features: any[] = [];
    
    // Add visible admin level boundaries
    visibleLevels.forEach(level => {
      if (adminLevelGeo[level] && adminLevelGeo[level]!.type === 'FeatureCollection') {
        features.push(...adminLevelGeo[level]!.features);
      }
    });

    return features;
  }, [adminLevelGeo, visibleLevels]);

  const mapCenter = useMemo(() => {
    if (allFeatures.length > 0) {
      try {
        const validFeatures = allFeatures.filter((f: any) => {
          const geomType = f.geometry?.type;
          return geomType && geomType !== 'Point';
        });
        
        if (validFeatures.length > 0) {
          const bounds = L.geoJSON(validFeatures).getBounds();
          if (bounds.isValid()) {
            const center = bounds.getCenter();
            return [center.lat, center.lng] as [number, number];
          }
        }
      } catch (err) {
        console.warn('Error calculating center:', err);
      }
    }
    return countryCode && countryCenters[countryCode] ? countryCenters[countryCode] : defaultCenter;
  }, [allFeatures, countryCode]);

  const toggleLevel = (level: string) => {
    setVisibleLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const toggleDataset = (datasetId: string) => {
    setVisibleDatasets(prev => {
      const next = new Set(prev);
      if (next.has(datasetId)) {
        next.delete(datasetId);
      } else {
        next.add(datasetId);
      }
      return next;
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-amber-600 uppercase mb-1">
              Country Map
            </p>
            <p className="text-sm text-gray-600">
              Toggle admin levels and dataset overlays to explore country data
            </p>
          </div>
        </div>

        {/* Toggle Controls */}
        <div className="flex flex-wrap gap-3 mt-4">
          {/* Admin Level Toggles */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Admin Levels:</span>
            {['ADM1', 'ADM2', 'ADM3', 'ADM4'].map(level => {
              const hasData = adminLevelGeo[level] !== null;
              const isVisible = visibleLevels.has(level);
              return (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  disabled={!hasData}
                  className={`px-2 py-1 text-xs rounded border transition ${
                    isVisible && hasData
                      ? 'bg-amber-500 text-white border-amber-600'
                      : hasData
                      ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  {isVisible ? <Eye size={12} /> : <EyeOff size={12} />} {level}
                </button>
              );
            })}
          </div>

          {/* Dataset Toggles */}
          {datasets.length > 0 && (
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
              <span className="text-xs font-semibold text-gray-600">Datasets:</span>
              {datasets.map(dataset => {
                const isVisible = visibleDatasets.has(dataset.id);
                return (
                  <button
                    key={dataset.id}
                    onClick={() => toggleDataset(dataset.id)}
                    className={`px-2 py-1 text-xs rounded border transition ${
                      isVisible
                        ? 'bg-blue-500 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {isVisible ? <Eye size={12} /> : <EyeOff size={12} />} {dataset.name.split(' - ')[0]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="h-96">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            Loading map...
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={6}
            minZoom={3}
            maxZoom={11}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <LayersControl position="topright">
              {/* Admin Level Layers */}
              {Object.entries(adminLevelGeo).map(([level, geo]) => {
                if (!geo) return null;
                
                // Get level name from adminLevels config
                const levelNum = parseInt(level.replace('ADM', ''));
                const levelConfig = adminLevels?.find((l: any) => l.level_number === levelNum);
                const levelName = levelConfig?.name || level;
                
                return (
                  <LayersControl.Overlay key={level} name={levelName} checked={visibleLevels.has(level)}>
                    <GeoJSON
                      data={geo as GeoJsonObject}
                      style={() => ({
                        color: '#2563eb',
                        weight: visibleLevels.has(level) ? 2 : 0,
                        fillColor: '#93c5fd',
                        fillOpacity: 0.2,
                      })}
                    />
                  </LayersControl.Overlay>
                );
              })}

              {/* Dataset Layers - render outside LayersControl for better control */}
            </LayersControl>

            {/* Render visible dataset layers */}
            {Object.entries(datasetLayers).map(([datasetId, layer]) => {
              if (!layer.data || !visibleDatasets.has(datasetId)) return null;
              
              return (
                <GeoJSON
                  key={datasetId}
                  data={layer.data as GeoJsonObject}
                  style={(feature: any) => ({
                    color: feature?.properties?._color || layer.color,
                    weight: 1,
                    fillColor: feature?.properties?._color || layer.color,
                    fillOpacity: 0.6,
                  })}
                  onEachFeature={(feature, layer) => {
                    const value = feature.properties?.value;
                    if (value !== undefined) {
                      layer.bindPopup(`${feature.properties?.name || feature.properties?.admin_pcode}: ${value.toLocaleString()}`);
                    }
                  }}
                />
              );
            })}

            {allFeatures.length > 0 && <MapBoundsController features={allFeatures} />}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
