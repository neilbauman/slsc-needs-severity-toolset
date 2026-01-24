'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import type { GeoJSON as GeoJSONType, GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { Eye, EyeOff, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import supabase from '@/lib/supabaseClient';

type CountryDashboardMapProps = {
  countryId: string;
  countryCode?: string;
  adminLevels?: any;
};

// Cache configuration
const CACHE_PREFIX = 'ssc_geo_cache_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// LocalStorage cache helpers
function getCachedGeoJSON(key: string): GeoJSONType | null {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function setCachedGeoJSON(key: string, data: GeoJSONType): void {
  try {
    const cacheEntry = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheEntry));
  } catch (e) {
    // localStorage might be full - clear old cache entries
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
  }
}

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
  const [visibleLevels, setVisibleLevels] = useState<Set<string>>(new Set(['ADM0']));
  const [visibleDatasets, setVisibleDatasets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState<any[]>([]);
  
  // Track loading states for individual layers
  const [loadingLevels, setLoadingLevels] = useState<Set<string>>(new Set(['ADM0']));
  const [loadingDatasets, setLoadingDatasets] = useState<Set<string>>(new Set());
  
  // Track failed/error states
  const [failedLevels, setFailedLevels] = useState<Set<string>>(new Set());
  const [failedDatasets, setFailedDatasets] = useState<Set<string>>(new Set());

  // Load a single admin level boundary (with caching)
  const loadAdminLevel = useCallback(async (level: string) => {
    if (!countryId) return;
    
    // Check cache first
    const cacheKey = `${countryId}_${level}`;
    const cached = getCachedGeoJSON(cacheKey);
    
    if (cached) {
      setAdminLevelGeo(prev => ({ ...prev, [level]: cached }));
      setLoadingLevels(prev => {
        const next = new Set(prev);
        next.delete(level);
        return next;
      });
      return;
    }
    
    // Mark as loading
    setLoadingLevels(prev => new Set(prev).add(level));
    setFailedLevels(prev => {
      const next = new Set(prev);
      next.delete(level);
      return next;
    });
    
    try {
      const { data, error } = await supabase.rpc('get_admin_boundaries_geojson', {
        admin_level: level,
        country_id: countryId,
      });

      if (error) {
        console.warn(`${level} load error:`, error);
        setFailedLevels(prev => new Set(prev).add(level));
      } else if (data && data.features && data.features.length > 0) {
        const polygonFeatures = data.features.filter((f: any) => {
          const geomType = f.geometry?.type;
          return geomType === 'Polygon' || geomType === 'MultiPolygon';
        });

        if (polygonFeatures.length > 0) {
          const geoData = {
            type: 'FeatureCollection',
            features: polygonFeatures,
          } as GeoJSONType;
          
          setAdminLevelGeo(prev => ({ ...prev, [level]: geoData }));
          setCachedGeoJSON(cacheKey, geoData); // Cache for future use
        }
      }
    } catch (err) {
      console.warn(`Failed to load ${level} boundaries:`, err);
      setFailedLevels(prev => new Set(prev).add(level));
    } finally {
      setLoadingLevels(prev => {
        const next = new Set(prev);
        next.delete(level);
        return next;
      });
    }
  }, [countryId]);

  // Load only ADM0 on mount (lazy load others when toggled)
  useEffect(() => {
    if (!countryId) return;

    // Reset states
    setAdminLevelGeo({});
    setFailedLevels(new Set());
    setLoading(true);

    const initMap = async () => {
      await loadAdminLevel('ADM0');
      setLoading(false);
    };

    initMap();
  }, [countryId, loadAdminLevel]);

  // Load datasets metadata (but NOT their layers - those are lazy loaded)
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
        // Don't mark as loading until user toggles them
        setLoadingDatasets(new Set());
        setFailedDatasets(new Set());
      }
    };

    loadDatasets();
  }, [countryId]);

  // Load a single dataset layer (lazy, when toggled)
  const loadDatasetLayer = useCallback(async (dataset: any) => {
    if (!countryId) return;
    
    setLoadingDatasets(prev => new Set(prev).add(dataset.id));
    setFailedDatasets(prev => {
      const next = new Set(prev);
      next.delete(dataset.id);
      return next;
    });
    
    try {
      // Get values
      const { data: values } = await supabase
        .from(dataset.type === 'numeric' ? 'dataset_values_numeric' : 'dataset_values_categorical')
        .select('admin_pcode, value')
        .eq('dataset_id', dataset.id)
        .limit(1000);

      if (!values || values.length === 0) {
        setLoadingDatasets(prev => {
          const next = new Set(prev);
          next.delete(dataset.id);
          return next;
        });
        return;
      }

      // Check cache for boundaries
      const cacheKey = `${countryId}_${dataset.admin_level}`;
      let boundaries: any = adminLevelGeo[dataset.admin_level] || getCachedGeoJSON(cacheKey);
      
      if (!boundaries) {
        const { data: boundaryData } = await supabase.rpc('get_admin_boundaries_geojson', {
          admin_level: dataset.admin_level,
          country_id: countryId,
        });
        boundaries = boundaryData;
        
        // Cache boundaries
        if (boundaries && boundaries.features?.length > 0) {
          const polygonFeatures = boundaries.features.filter((f: any) => {
            const geomType = f.geometry?.type;
            return geomType === 'Polygon' || geomType === 'MultiPolygon';
          });
          
          if (polygonFeatures.length > 0) {
            const geoData = {
              type: 'FeatureCollection',
              features: polygonFeatures,
            } as GeoJSONType;
            
            setAdminLevelGeo(prev => ({ ...prev, [dataset.admin_level]: geoData }));
            setCachedGeoJSON(cacheKey, geoData);
          }
        }
      }

      if (!boundaries || !boundaries.features) {
        setFailedDatasets(prev => new Set(prev).add(dataset.id));
        setLoadingDatasets(prev => {
          const next = new Set(prev);
          next.delete(dataset.id);
          return next;
        });
        return;
      }

      // Create value map and calculate min/max
      const numericValues = values
        .map((v: any) => typeof v.value === 'number' ? v.value : parseFloat(v.value))
        .filter((v: any) => !isNaN(v) && v !== null && v !== undefined);
      
      if (numericValues.length === 0) {
        setLoadingDatasets(prev => {
          const next = new Set(prev);
          next.delete(dataset.id);
          return next;
        });
        return;
      }

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
        
        const hue = 240 - (normalized * 120);
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

      setDatasetLayers(prev => ({
        ...prev,
        [dataset.id]: {
          data: {
            type: 'FeatureCollection',
            features: coloredFeatures,
          } as GeoJSONType,
          color: dataset.name.toLowerCase().includes('population') ? '#3b82f6' : '#ef4444',
          minValue,
          maxValue,
          datasetName: dataset.name,
        } as DatasetLayerInfo,
      }));
    } catch (err) {
      console.warn(`Failed to load dataset layer for ${dataset.name}:`, err);
      setFailedDatasets(prev => new Set(prev).add(dataset.id));
    } finally {
      setLoadingDatasets(prev => {
        const next = new Set(prev);
        next.delete(dataset.id);
        return next;
      });
    }
  }, [countryId, adminLevelGeo]);

  const allFeatures = useMemo(() => {
    const features: any[] = [];
    
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

  // Toggle admin level - lazy load if not already loaded
  const toggleLevel = useCallback((level: string) => {
    const isCurrentlyVisible = visibleLevels.has(level);
    
    if (!isCurrentlyVisible) {
      // Turning ON - check if we need to load
      if (!adminLevelGeo[level] && !loadingLevels.has(level)) {
        loadAdminLevel(level);
      }
    }
    
    setVisibleLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, [visibleLevels, adminLevelGeo, loadingLevels, loadAdminLevel]);

  // Toggle dataset - lazy load if not already loaded
  const toggleDataset = useCallback((datasetId: string) => {
    const isCurrentlyVisible = visibleDatasets.has(datasetId);
    
    if (!isCurrentlyVisible) {
      // Turning ON - check if we need to load
      if (!datasetLayers[datasetId] && !loadingDatasets.has(datasetId)) {
        const dataset = datasets.find(d => d.id === datasetId);
        if (dataset) {
          loadDatasetLayer(dataset);
        }
      }
    }
    
    setVisibleDatasets(prev => {
      const next = new Set(prev);
      if (next.has(datasetId)) {
        next.delete(datasetId);
      } else {
        next.add(datasetId);
      }
      return next;
    });
  }, [visibleDatasets, datasetLayers, loadingDatasets, datasets, loadDatasetLayer]);

  // Retry loading a failed level
  const retryLevel = useCallback((level: string) => {
    setFailedLevels(prev => {
      const next = new Set(prev);
      next.delete(level);
      return next;
    });
    loadAdminLevel(level);
  }, [loadAdminLevel]);

  // Retry loading a failed dataset
  const retryDataset = useCallback((datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (dataset) {
      setFailedDatasets(prev => {
        const next = new Set(prev);
        next.delete(datasetId);
        return next;
      });
      loadDatasetLayer(dataset);
    }
  }, [datasets, loadDatasetLayer]);

  // Generate color scale for legend
  const generateColorScale = (steps: number = 5) => {
    const colors: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const normalized = i / steps;
      const hue = 240 - (normalized * 120);
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
        {/* Map - Constrained height to fit on screen */}
        <div className="flex-1 h-[450px] max-h-[60vh] relative">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <Loader2 className="animate-spin mr-2" size={20} />
              Loading map...
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={6}
              minZoom={3}
              maxZoom={11}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              dragging={true}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <LayersControl position="topright">
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
              <p className="text-xs text-gray-500 mb-2">Click to load & toggle layers</p>
              <div className="space-y-2">
                {['ADM0', 'ADM1', 'ADM2', 'ADM3', 'ADM4'].map(level => {
                  const isLoading = loadingLevels.has(level);
                  const hasFailed = failedLevels.has(level);
                  const hasData = adminLevelGeo[level] !== null && adminLevelGeo[level] !== undefined;
                  const isVisible = visibleLevels.has(level);
                  const levelNum = parseInt(level.replace('ADM', ''));
                  const levelConfig = adminLevels?.find((l: any) => l.level_number === levelNum);
                  const levelName = levelConfig?.name || level;
                  
                  return (
                    <div key={level} className="flex items-center gap-1">
                      <button
                        onClick={() => toggleLevel(level)}
                        disabled={isLoading}
                        className={`flex-1 flex items-center justify-between px-3 py-2 text-sm rounded-l border transition ${
                          isLoading
                            ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-wait'
                            : hasFailed && !hasData
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : isVisible && hasData
                            ? 'bg-amber-500 text-white border-amber-600'
                            : hasData
                            ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {isLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : isVisible && hasData ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                          <span>{level}</span>
                          {levelName !== level && (
                            <span className="text-xs opacity-75">({levelName})</span>
                          )}
                        </span>
                        {isLoading && (
                          <span className="text-xs opacity-75">Loading...</span>
                        )}
                        {hasFailed && !hasData && !isLoading && (
                          <span className="text-xs text-red-500">Timeout</span>
                        )}
                      </button>
                      {hasFailed && !isLoading && (
                        <button
                          onClick={() => retryLevel(level)}
                          className="px-2 py-2 border border-gray-300 rounded-r bg-white hover:bg-gray-50 text-gray-600"
                          title="Retry loading"
                        >
                          <RefreshCw size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dataset Toggles */}
            {datasets.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Datasets</p>
                <p className="text-xs text-gray-500 mb-2">Click to load & visualize</p>
                <div className="space-y-2">
                  {datasets.map(dataset => {
                    const isLoading = loadingDatasets.has(dataset.id);
                    const hasFailed = failedDatasets.has(dataset.id);
                    const hasData = datasetLayers[dataset.id] !== undefined;
                    const isVisible = visibleDatasets.has(dataset.id);
                    
                    return (
                      <div key={dataset.id} className="flex items-center gap-1">
                        <button
                          onClick={() => toggleDataset(dataset.id)}
                          disabled={isLoading}
                          className={`flex-1 flex items-center justify-between px-3 py-2 text-sm rounded-l border transition ${
                            isLoading
                              ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-wait'
                              : hasFailed && !hasData
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : isVisible && hasData
                              ? 'bg-blue-500 text-white border-blue-600'
                              : hasData
                              ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="flex items-center gap-2 flex-1 min-w-0">
                            {isLoading ? (
                              <Loader2 size={14} className="animate-spin flex-shrink-0" />
                            ) : isVisible && hasData ? (
                              <Eye size={14} className="flex-shrink-0" />
                            ) : (
                              <EyeOff size={14} className="flex-shrink-0" />
                            )}
                            <span className="text-left truncate">{dataset.name.split(' - ')[0]}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                              isVisible ? 'bg-blue-600' : hasFailed ? 'bg-red-200 text-red-700' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {dataset.admin_level}
                            </span>
                          </span>
                          {isLoading && (
                            <span className="text-xs opacity-75 flex-shrink-0">Loading...</span>
                          )}
                          {hasFailed && !hasData && !isLoading && (
                            <span className="text-xs text-red-500 flex-shrink-0">Error</span>
                          )}
                        </button>
                        {hasFailed && !isLoading && (
                          <button
                            onClick={() => retryDataset(dataset.id)}
                            className="px-2 py-2 border border-gray-300 rounded-r bg-white hover:bg-gray-50 text-gray-600"
                            title="Retry loading"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                      </div>
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
              <div className="text-center">
                <AlertTriangle size={20} className="mx-auto mb-2 text-amber-500" />
                <p className="text-xs text-gray-500">
                  Click a layer to load it. Boundaries are cached locally to reduce database load.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
