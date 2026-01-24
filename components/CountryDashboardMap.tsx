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

type DatasetLayerInfo = {
  data: GeoJSONType | null;
  color: string;
  minValue: number;
  maxValue: number;
  datasetName: string;
};

export default function CountryDashboardMap({ countryId, countryCode, adminLevels }: CountryDashboardMapProps) {
  const [adminLevelGeo, setAdminLevelGeo] = useState<Record<string, GeoJSONType | null>>({});
  const [datasetLayers, setDatasetLayers] = useState<Record<string, DatasetLayerInfo>>({});
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
      const newLayers: Record<string, DatasetLayerInfo> = {};

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

          // Create value map and calculate min/max
          const numericValues = values
            .map((v: any) => typeof v.value === 'number' ? v.value : parseFloat(v.value))
            .filter((v: any) => !isNaN(v) && v !== null && v !== undefined);
          
          if (numericValues.length === 0) continue;

          const maxValue = Math.max(...numericValues);
          const minValue = Math.min(...numericValues);
          const valueMap = new Map(values.map((v: any) => [v.admin_pcode, typeof v.value === 'number' ? v.value : parseFloat(v.value)]));

          // Create colored features
          const coloredFeatures = boundaries.features.map((f: any) => {
            const pcode = f.properties?.admin_pcode;
            const value = valueMap.get(pcode);
            const normalized = maxValue > minValue && value !== undefined && !isNaN(value) 
              ? ((value - minValue) / (maxValue - minValue)) 
              : 0.5;
            
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
            minValue,
            maxValue,
            datasetName: dataset.name,
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

  // Generate color scale for legend
  const generateColorScale = (steps: number = 5) => {
    const colors: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const normalized = i / steps;
      const hue = 240 - (normalized * 120); // 240 (blue) to 120 (green/yellow)
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const activeDatasetLayer = useMemo(() => {
    const visibleIds = Array.from(visibleDatasets);
    if (visibleIds.length === 0) return null;
    return datasetLayers[visibleIds[0]] || null;
  }, [visibleDatasets, datasetLayers]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-amber-600 uppercase mb-1">
            Country Map
          </p>
          <p className="text-sm text-gray-600">
            Toggle admin levels and dataset overlays to explore country data
          </p>
        </div>
      </div>

      <div className="flex gap-0">
        {/* Map - Square format */}
        <div className="flex-1 aspect-square min-h-[500px] relative">
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

        {/* Right Panel - Toggles and Legend */}
        <div className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col">
          {/* Toggle Controls */}
          <div className="p-4 space-y-4 border-b border-gray-200">
            {/* Admin Level Toggles */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Admin Levels</p>
              <div className="space-y-2">
                {['ADM1', 'ADM2', 'ADM3', 'ADM4'].map(level => {
                  const hasData = adminLevelGeo[level] !== null && adminLevelGeo[level] !== undefined;
                  const isVisible = visibleLevels.has(level);
                  const levelNum = parseInt(level.replace('ADM', ''));
                  const levelConfig = adminLevels?.find((l: any) => l.level_number === levelNum);
                  const levelName = levelConfig?.name || level;
                  
                  return (
                    <button
                      key={level}
                      onClick={() => toggleLevel(level)}
                      disabled={!hasData}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded border transition ${
                        isVisible && hasData
                          ? 'bg-amber-500 text-white border-amber-600'
                          : hasData
                          ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span>{level}</span>
                        {levelName !== level && (
                          <span className="text-xs opacity-75">({levelName})</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dataset Toggles */}
            {datasets.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Datasets</p>
                <div className="space-y-2">
                  {datasets.map(dataset => {
                    const isVisible = visibleDatasets.has(dataset.id);
                    return (
                      <button
                        key={dataset.id}
                        onClick={() => toggleDataset(dataset.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded border transition ${
                          isVisible
                            ? 'bg-blue-500 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                          <span className="text-left truncate">{dataset.name.split(' - ')[0]}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          {activeDatasetLayer && (
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-700 mb-3">Legend</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-2 font-medium">{activeDatasetLayer.datasetName}</p>
                  
                  {/* Color Scale */}
                  <div className="mb-3">
                    <div className="flex items-center gap-1 mb-2">
                      {generateColorScale(5).map((color, idx) => (
                        <div
                          key={idx}
                          className="flex-1 h-6 rounded-sm border border-gray-300"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    
                    {/* Value Range */}
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Low: {formatValue(activeDatasetLayer.minValue)}</span>
                      <span>High: {formatValue(activeDatasetLayer.maxValue)}</span>
                    </div>
                  </div>

                  {/* Value Breakpoints */}
                  <div className="space-y-1 text-xs text-gray-600">
                    <p className="font-semibold mb-2">Value Ranges:</p>
                    {(() => {
                      const steps = 5;
                      const range = activeDatasetLayer.maxValue - activeDatasetLayer.minValue;
                      const breakpoints: Array<{ color: string; min: number; max: number }> = [];
                      
                      for (let i = 0; i <= steps; i++) {
                        const normalized = i / steps;
                        const value = activeDatasetLayer.minValue + (range * normalized);
                        const hue = 240 - (normalized * 120);
                        const color = `hsl(${hue}, 70%, 50%)`;
                        
                        const min = i === 0 ? activeDatasetLayer.minValue : activeDatasetLayer.minValue + (range * ((i - 1) / steps));
                        const max = i === steps ? activeDatasetLayer.maxValue : value;
                        
                        breakpoints.push({ color, min, max });
                      }
                      
                      return breakpoints.map((bp, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border border-gray-300"
                            style={{ backgroundColor: bp.color }}
                          />
                          <span>
                            {formatValue(bp.min)} - {formatValue(bp.max)}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!activeDatasetLayer && (
            <div className="p-4 flex-1 flex items-center justify-center">
              <p className="text-xs text-gray-500 text-center">
                Toggle a dataset to see its legend and value ranges
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
