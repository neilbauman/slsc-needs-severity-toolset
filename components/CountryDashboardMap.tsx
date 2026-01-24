'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { GeoJSON as GeoJSONType, GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { Loader2, RefreshCw } from 'lucide-react';
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
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
  }
}

// Minimum expected bounds size for a country (in degrees)
// If bounds are smaller than this, they're likely incomplete data
const MIN_COUNTRY_BOUNDS_SIZE = 2; // ~220km

// Component to auto-fit map bounds to features
function MapBoundsController({ features, countryCode }: { features: any[]; countryCode?: string }) {
  const map = useMap();
  const prevFeaturesLengthRef = useRef(0);
  const hasInitializedRef = useRef(false);
  
  // Set initial view based on country center immediately
  useEffect(() => {
    if (countryCode && countryCenters[countryCode] && !hasInitializedRef.current) {
      const center = countryCenters[countryCode];
      map.setView(center, 6, { animate: false });
      hasInitializedRef.current = true;
    }
  }, [countryCode, map]);

  // Reset refs when country changes
  useEffect(() => {
    prevFeaturesLengthRef.current = 0;
    hasInitializedRef.current = false;
  }, [countryCode]);
  
  // Fit bounds when features change, but validate bounds are reasonable
  useEffect(() => {
    if (features.length > 0 && features.length !== prevFeaturesLengthRef.current) {
      prevFeaturesLengthRef.current = features.length;
      
      try {
        const validFeatures = features.filter((f: any) => {
          const geomType = f.geometry?.type;
          return geomType && geomType !== 'Point';
        });
        
        if (validFeatures.length > 0) {
          const geoJsonLayer = L.geoJSON(validFeatures);
          const bounds = geoJsonLayer.getBounds();
          
          if (bounds.isValid()) {
            // Check if bounds are reasonable (not too small)
            const latSpan = bounds.getNorth() - bounds.getSouth();
            const lngSpan = bounds.getEast() - bounds.getWest();
            const boundsSize = Math.max(latSpan, lngSpan);
            
            // Only fit if bounds are large enough to be a real country boundary
            // or if we have more than just ADM0 features
            if (boundsSize >= MIN_COUNTRY_BOUNDS_SIZE || features.length > 1) {
              requestAnimationFrame(() => {
                map.fitBounds(bounds, { 
                  padding: [20, 20],
                  maxZoom: 8,
                  animate: false
                });
              });
            } else {
              // Bounds too small - likely incomplete ADM0, use country center
              if (countryCode && countryCenters[countryCode]) {
                const center = countryCenters[countryCode];
                map.setView(center, 6, { animate: false });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fitting bounds:", err);
      }
    }
  }, [features, map, countryCode]);

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
  
  const [loadingLevels, setLoadingLevels] = useState<Set<string>>(new Set(['ADM0']));
  const [loadingDatasets, setLoadingDatasets] = useState<Set<string>>(new Set());
  const [failedLevels, setFailedLevels] = useState<Set<string>>(new Set());
  const [failedDatasets, setFailedDatasets] = useState<Set<string>>(new Set());

  // Load a single admin level boundary (with caching)
  const loadAdminLevel = useCallback(async (level: string) => {
    if (!countryId) return;
    
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
          setCachedGeoJSON(cacheKey, geoData);
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

  // Clear cache for this country (helps with corrupted cache issues)
  const clearCountryCache = useCallback(() => {
    if (!countryId) return;
    
    const levels = ['ADM0', 'ADM1', 'ADM2', 'ADM3', 'ADM4'];
    levels.forEach(level => {
      const cacheKey = `${countryId}_${level}`;
      try {
        localStorage.removeItem(CACHE_PREFIX + cacheKey);
      } catch {}
    });
    
    // Reset state and reload
    setAdminLevelGeo({});
    setDatasetLayers({});
    setFailedLevels(new Set());
    setLoading(true);
    
    // Reload ADM0
    loadAdminLevel('ADM0').then(() => setLoading(false));
  }, [countryId, loadAdminLevel]);

  // Load only ADM0 on mount - clear cache first to ensure fresh data
  useEffect(() => {
    if (!countryId) return;

    // Clear cache for this country to fix any corrupted cache issues
    const levels = ['ADM0', 'ADM1', 'ADM2', 'ADM3', 'ADM4'];
    levels.forEach(level => {
      const cacheKey = `${countryId}_${level}`;
      try {
        localStorage.removeItem(CACHE_PREFIX + cacheKey);
      } catch {}
    });

    setAdminLevelGeo({});
    setDatasetLayers({});
    setFailedLevels(new Set());
    setLoading(true);

    const initMap = async () => {
      await loadAdminLevel('ADM0');
      setLoading(false);
    };

    initMap();
  }, [countryId, loadAdminLevel]);

  // Load datasets metadata
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
        setLoadingDatasets(new Set());
        setFailedDatasets(new Set());
      }
    };

    loadDatasets();
  }, [countryId]);

  // Load a single dataset layer
  const loadDatasetLayer = useCallback(async (dataset: any) => {
    if (!countryId) return;
    
    setLoadingDatasets(prev => new Set(prev).add(dataset.id));
    setFailedDatasets(prev => {
      const next = new Set(prev);
      next.delete(dataset.id);
      return next;
    });
    
    try {
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

      const cacheKey = `${countryId}_${dataset.admin_level}`;
      let boundaries: any = adminLevelGeo[dataset.admin_level] || getCachedGeoJSON(cacheKey);
      
      if (!boundaries) {
        const { data: boundaryData } = await supabase.rpc('get_admin_boundaries_geojson', {
          admin_level: dataset.admin_level,
          country_id: countryId,
        });
        boundaries = boundaryData;
        
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

  const toggleLevel = useCallback((level: string) => {
    const isCurrentlyVisible = visibleLevels.has(level);
    
    if (!isCurrentlyVisible) {
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

  const toggleDataset = useCallback((datasetId: string) => {
    const isCurrentlyVisible = visibleDatasets.has(datasetId);
    
    if (!isCurrentlyVisible) {
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

  const retryLevel = useCallback((level: string) => {
    setFailedLevels(prev => {
      const next = new Set(prev);
      next.delete(level);
      return next;
    });
    loadAdminLevel(level);
  }, [loadAdminLevel]);

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
      <div className="flex gap-0">
        {/* Map */}
        <div className="flex-1 h-[380px] relative">
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
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Render visible admin level boundaries directly */}
              {Object.entries(adminLevelGeo).map(([level, geo]) => {
                if (!geo || !visibleLevels.has(level)) return null;
                
                return (
                  <GeoJSON
                    key={`${level}-${countryId}`}
                    data={geo as GeoJsonObject}
                    style={() => ({
                      color: '#2563eb',
                      weight: 2,
                      fillColor: '#93c5fd',
                      fillOpacity: 0.15,
                    })}
                  />
                );
              })}

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

              <MapBoundsController features={allFeatures} countryCode={countryCode} />
            </MapContainer>
          )}
        </div>

        {/* Right Panel - Compact */}
        <div className="w-56 border-l border-gray-200 bg-gray-50 flex flex-col">
          {/* Compact Toggle Controls */}
          <div className="p-3 space-y-3 flex-shrink-0">
            {/* Admin Level Chips */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Boundaries</p>
              <div className="flex flex-wrap gap-1">
                {['ADM0', 'ADM1', 'ADM2', 'ADM3', 'ADM4'].map(level => {
                  const isLoading = loadingLevels.has(level);
                  const hasFailed = failedLevels.has(level);
                  const hasData = adminLevelGeo[level] !== null && adminLevelGeo[level] !== undefined;
                  const isVisible = visibleLevels.has(level);
                  
                  return (
                    <button
                      key={level}
                      onClick={() => hasFailed ? retryLevel(level) : toggleLevel(level)}
                      disabled={isLoading}
                      title={hasFailed ? 'Click to retry' : undefined}
                      className={`px-2 py-1 text-[11px] font-medium rounded transition ${
                        isLoading
                          ? 'bg-gray-200 text-gray-400'
                          : hasFailed
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : isVisible && hasData
                          ? 'bg-amber-500 text-white'
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : hasFailed ? (
                        <span className="flex items-center gap-0.5">
                          <RefreshCw size={9} />
                          {level.replace('ADM', '')}
                        </span>
                      ) : (
                        level.replace('ADM', '')
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dataset Chips */}
            {datasets.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Data Layers</p>
                <div className="space-y-1">
                  {datasets.map(dataset => {
                    const isLoading = loadingDatasets.has(dataset.id);
                    const hasFailed = failedDatasets.has(dataset.id);
                    const hasData = datasetLayers[dataset.id] !== undefined;
                    const isVisible = visibleDatasets.has(dataset.id);
                    
                    // Shorten name
                    const shortName = dataset.name
                      .replace(/Sri Lanka\s*/i, '')
                      .replace(/Mozambique\s*/i, '')
                      .replace(/\s*\([^)]*\)/g, '')
                      .split(' - ')[0]
                      .trim();
                    
                    return (
                      <button
                        key={dataset.id}
                        onClick={() => hasFailed ? retryDataset(dataset.id) : toggleDataset(dataset.id)}
                        disabled={isLoading}
                        title={hasFailed ? 'Click to retry' : dataset.name}
                        className={`w-full flex items-center justify-between px-2 py-1 text-[11px] rounded transition ${
                          isLoading
                            ? 'bg-gray-200 text-gray-400'
                            : hasFailed
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : isVisible && hasData
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <span className="flex items-center gap-1 truncate">
                          {isLoading && <Loader2 size={10} className="animate-spin flex-shrink-0" />}
                          {hasFailed && <RefreshCw size={9} className="flex-shrink-0" />}
                          <span className="truncate">{shortName}</span>
                        </span>
                        <span className={`text-[9px] px-1 py-0.5 rounded flex-shrink-0 ml-1 ${
                          isVisible ? 'bg-blue-600' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {dataset.admin_level?.replace('ADM', '')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Legend - Fixed height placeholder */}
          <div className="flex-1 border-t border-gray-200 min-h-[140px]">
            {activeDatasetLayer ? (
              <div className="p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Legend</p>
                <p className="text-[11px] text-gray-700 font-medium mb-2 truncate" title={activeDatasetLayer.datasetName}>
                  {activeDatasetLayer.datasetName.replace(/Sri Lanka\s*/i, '').replace(/Mozambique\s*/i, '').split(' - ')[0]}
                </p>
                
                {/* Compact Color Scale */}
                <div className="mb-2">
                  <div className="flex items-center gap-0.5 mb-1">
                    {generateColorScale(5).map((color, idx) => (
                      <div
                        key={idx}
                        className="flex-1 h-3 first:rounded-l last:rounded-r"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500">
                    <span>{formatValue(activeDatasetLayer.minValue)}</span>
                    <span>{formatValue(activeDatasetLayer.maxValue)}</span>
                  </div>
                </div>

                {/* Simplified breakpoints */}
                <div className="space-y-0.5 text-[9px] text-gray-500">
                  {[0, 0.5, 1].map((pct, idx) => {
                    const value = activeDatasetLayer.minValue + (activeDatasetLayer.maxValue - activeDatasetLayer.minValue) * pct;
                    const hue = 240 - (pct * 120);
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }} />
                        <span>{pct === 0 ? 'Low' : pct === 0.5 ? 'Mid' : 'High'}: {formatValue(value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-3">
                <p className="text-[10px] text-gray-400 text-center">
                  Select a data layer to see legend
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
