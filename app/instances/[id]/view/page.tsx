'use client';

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";
import InstanceMetricsPanel from "@/components/InstanceMetricsPanel";
import VulnerableLocationsPanel from "@/components/VulnerableLocationsPanel";

// Component to handle map bounds after features load
function MapBoundsController({ features }: { features: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (features.length > 0) {
      try {
        const bounds = L.geoJSON(features).getBounds();
        map.fitBounds(bounds, { 
          padding: [5, 5],
          maxZoom: 11
        });
      } catch (err) {
        console.error("Error fitting bounds:", err);
      }
    }
  }, [features, map]);

  return null;
}

export default function InstanceViewPage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [overallFeatures, setOverallFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricsRefreshKey, setMetricsRefreshKey] = useState(0);
  const [hazardEvents, setHazardEvents] = useState<any[]>([]);
  const [hazardEventLayers, setHazardEventLayers] = useState<any[]>([]);
  const [visibleHazardEvents, setVisibleHazardEvents] = useState<Set<string>>(new Set());
  const [hazardEventFilters, setHazardEventFilters] = useState<Record<string, { minMagnitude?: number, maxMagnitude?: number, visibleFeatureIds?: Set<string>, geometryTypes?: Set<string> }>>({});
  const [selectedLayer, setSelectedLayer] = useState<{ type: 'overall' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, datasetName?: string, categoryName?: string, hazardEventId?: string }>({ type: 'overall' });

  const instanceId = params?.id;
  
  if (!instanceId) {
    return (
      <div className="p-4">
        <div className="border rounded-lg p-4" style={{ backgroundColor: 'rgba(99, 7, 16, 0.05)', borderColor: 'var(--gsc-red)' }}>
          <h2 className="font-semibold mb-2" style={{ color: 'var(--gsc-red)' }}>Invalid Instance ID</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--gsc-gray)' }}>No instance ID provided.</p>
          <Link href="/instances" className="btn btn-danger text-sm">Back to Instances</Link>
        </div>
      </div>
    );
  }

  // Load localStorage filters on mount (using same keys as edit page)
  useEffect(() => {
    if (instanceId) {
      // Load filters (same key as edit page: hazard_filters_${instanceId})
      const savedFilters = localStorage.getItem(`hazard_filters_${instanceId}`);
      if (savedFilters) {
        try {
          const parsed = JSON.parse(savedFilters);
          // Convert arrays back to Sets
          const filtersWithSets: Record<string, any> = {};
          Object.keys(parsed).forEach(key => {
            filtersWithSets[key] = {
              ...parsed[key],
              visibleFeatureIds: parsed[key].visibleFeatureIds ? new Set(parsed[key].visibleFeatureIds) : undefined,
              geometryTypes: parsed[key].geometryTypes ? new Set(parsed[key].geometryTypes) : undefined,
            };
          });
          setHazardEventFilters(filtersWithSets);
        } catch (e) {
          console.warn('Error loading saved filters:', e);
        }
      }
      
      // Load visibility (same key as edit page: hazard_visibility_${instanceId})
      const savedVisible = localStorage.getItem(`hazard_visibility_${instanceId}`);
      if (savedVisible) {
        try {
          setVisibleHazardEvents(new Set(JSON.parse(savedVisible)));
        } catch (e) {
          console.warn('Error loading saved visible events:', e);
        }
      }
    }
  }, [instanceId]);

  // Save visibility changes to localStorage (so view-only toggles persist)
  useEffect(() => {
    if (!instanceId) return;
    
    const visibilityKey = `hazard_visibility_${instanceId}`;
    try {
      localStorage.setItem(visibilityKey, JSON.stringify(Array.from(visibleHazardEvents)));
    } catch (e) {
      console.warn('Error saving visibility to localStorage:', e);
    }
  }, [visibleHazardEvents, instanceId]);

  const fetchData = async () => {
    if (!instanceId) return;
    
    try {
      setError(null);
      
      const { data: directData, error: directError } = await supabase
        .from("instances")
        .select("*")
        .eq("id", instanceId)
        .single();
      
      if (!directError && directData) {
        setInstance(directData);
      } else {
        setInstance({ id: instanceId, name: `Instance ${instanceId}` });
      }

      // Load hazard events
      const { data: hazardEventsData, error: hazardError } = await supabase
        .rpc('get_hazard_events_for_instance', { in_instance_id: instanceId });
      
      if (!hazardError && hazardEventsData) {
        setHazardEvents(hazardEventsData);
        const layers: any[] = [];
        hazardEventsData.forEach((event: any) => {
          if (event.geojson && event.geojson.features) {
            layers.push({
              id: event.id,
              name: event.name,
              geojson: event.geojson,
              event_type: event.event_type,
              magnitude_field: event.magnitude_field,
            });
          }
        });
        setHazardEventLayers(layers);
        // Make all hazard events visible by default
        setVisibleHazardEvents(new Set(layers.map(l => l.id)));
      }

      // Load overall instance scores
      let parsed: any[] = [];
      try {
        const { data: geoRows, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode, geojson")
          .eq("instance_id", instanceId);

        if (!geoError && geoRows && geoRows.length > 0) {
          const geoMap = new Map<string, any>();
          geoRows.forEach((row: any) => {
            if (!geoMap.has(row.admin_pcode)) {
              try {
                const feature = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
                geoMap.set(row.admin_pcode, feature);
              } catch (e) {
                console.warn("Error parsing GeoJSON for", row.admin_pcode, e);
              }
            }
          });
          
          const adminPcodesWithGeometry = Array.from(geoMap.keys());
          
          if (adminPcodesWithGeometry.length > 0) {
            const chunkSize = 1000;
            const chunks: string[][] = [];
            for (let i = 0; i < adminPcodesWithGeometry.length; i += chunkSize) {
              chunks.push(adminPcodesWithGeometry.slice(i, i + chunkSize));
            }
            
            let allScores: any[] = [];
            for (const chunk of chunks) {
              const { data: scores, error: scoresError } = await supabase
                .from("v_instance_admin_scores")
                .select("admin_pcode, name, avg_score")
                .eq("instance_id", instanceId)
                .in("admin_pcode", chunk);
              
              if (!scoresError && scores) {
                allScores = [...allScores, ...scores];
              }
            }
            
            const scoreMap = new Map(allScores.map((s: any) => [s.admin_pcode, Number(s.avg_score)]));
          
            parsed = adminPcodesWithGeometry
              .map((pcode: string) => {
                const geoFeature = geoMap.get(pcode);
                if (!geoFeature) return null;
                
                const score = scoreMap.get(pcode);
                
                return {
                  ...geoFeature,
                  properties: {
                    ...geoFeature.properties,
                    admin_pcode: pcode,
                    admin_name: geoFeature.properties?.name || geoFeature.properties?.admin_name || allScores.find(s => s.admin_pcode === pcode)?.name || 'Unknown',
                    score: score,
                    has_score: score !== undefined,
                  }
                };
              })
              .filter((f: any) => f !== null);
          }
        }
      } catch (e) {
        console.warn("Error loading overall scores:", e);
      }
      
      setFeatures(parsed);
      setOverallFeatures(parsed);
    } catch (err: any) {
      console.error("Error loading instance page:", err);
      setError(err?.message || "Failed to load instance data");
    } finally {
      setLoading(false);
    }
  };

  // Load features for selected layer (simplified version)
  const loadFeaturesForSelection = async (
    selection: { type: 'overall' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, categoryName?: string, hazardEventId?: string },
    overallFeatures?: any[]
  ) => {
    try {
      setFeatures([]);
      setLoadingFeatures(true);
      
      if (selection.type === 'overall') {
        if (overallFeatures) {
          setFeatures(overallFeatures);
          setLoadingFeatures(false);
          return;
        }
        
        const { data: geoRows, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode, geojson")
          .eq("instance_id", instanceId);

        if (geoError || !geoRows || geoRows.length === 0) {
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        const geoMap = new Map<string, any>();
        geoRows.forEach((row: any) => {
          if (!geoMap.has(row.admin_pcode)) {
            try {
              const feature = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
              geoMap.set(row.admin_pcode, feature);
            } catch (e) {
              console.warn("Error parsing GeoJSON:", e);
            }
          }
        });
        
        const adminPcodesWithGeometry = Array.from(geoMap.keys());
        
        if (adminPcodesWithGeometry.length === 0) {
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        const chunkSize = 1000;
        const chunks: string[][] = [];
        for (let i = 0; i < adminPcodesWithGeometry.length; i += chunkSize) {
          chunks.push(adminPcodesWithGeometry.slice(i, i + chunkSize));
        }
        
        let allScores: any[] = [];
        for (const chunk of chunks) {
          const { data: scores, error: scoresError } = await supabase
            .from("v_instance_admin_scores")
            .select("admin_pcode, name, avg_score")
            .eq("instance_id", instanceId)
            .in("admin_pcode", chunk);
          
          if (!scoresError && scores) {
            allScores = [...allScores, ...scores];
          }
        }
        
        const scoreMap = new Map(allScores.map((s: any) => [s.admin_pcode, Number(s.avg_score)]));

        const features = adminPcodesWithGeometry
          .map((pcode: string) => {
            const geoFeature = geoMap.get(pcode);
            if (!geoFeature) return null;
            
            const score = scoreMap.get(pcode);
            
            return {
              ...geoFeature,
              properties: {
                ...geoFeature.properties,
                admin_pcode: pcode,
                admin_name: geoFeature.properties?.name || geoFeature.properties?.admin_name || allScores.find(s => s.admin_pcode === pcode)?.name || 'Unknown',
                score: score,
                has_score: score !== undefined,
              }
            };
          })
          .filter((f: any) => f !== null);
        
        setFeatures(features);
        setOverallFeatures(features);
        setLoadingFeatures(false);
      } else {
        // For other types, just use overall for now (can be enhanced later)
        setFeatures(overallFeatures || []);
        setLoadingFeatures(false);
      }
    } catch (err: any) {
      console.error("Error loading features:", err);
      setFeatures([]);
      setLoadingFeatures(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [instanceId]);

  useEffect(() => {
    loadFeaturesForSelection(selectedLayer, overallFeatures);
  }, [selectedLayer.type, selectedLayer.datasetId, selectedLayer.category, selectedLayer.hazardEventId]);

  const getColor = (score: number) => {
    if (score <= 1) return "#00FF00";
    if (score <= 2) return "#CCFF00";
    if (score <= 3) return "#FFCC00";
    if (score <= 4) return "#FF6600";
    return "#FF0000";
  };

  const onEachFeature = (feature: any, layer: any) => {
    const score = feature.properties?.score;
    const name = feature.properties?.admin_name || feature.properties?.name || 'Unknown';
    
    if (score !== undefined && !isNaN(score)) {
      const color = getColor(score);
      layer.setStyle({
        fillColor: color,
        color: '#333',
        weight: 1,
        opacity: 0.7,
        fillOpacity: 0.75,
      });
      
      layer.on({
        mouseover: (e: any) => {
          const layer = e.target;
          layer.setStyle({
            weight: 2,
            fillOpacity: 0.9,
          });
        },
        mouseout: (e: any) => {
          const layer = e.target;
          layer.setStyle({
            weight: 1,
            fillOpacity: 0.75,
          });
        },
      });
      
      layer.bindPopup(`<strong>${name}</strong><br/>Score: ${score.toFixed(2)}`);
    } else {
      layer.setStyle({
        fillColor: '#ccc',
        color: '#999',
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.3,
      });
      layer.bindPopup(`<strong>${name}</strong><br/>No score available`);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center" style={{ color: 'var(--gsc-gray)' }}>
          <p>Loading instance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ maxWidth: '8.5in', margin: '0 auto' }}>
      {/* View Only Banner */}
      <div className="mb-2 p-2 rounded border" style={{ backgroundColor: 'rgba(0, 75, 135, 0.1)', borderColor: 'var(--gsc-blue)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--gsc-blue)' }}>👁️ VIEW ONLY MODE</span>
          <span className="text-xs" style={{ color: 'var(--gsc-gray)' }}>This is a read-only view. No changes can be made.</span>
        </div>
      </div>

      {/* Header */}
      <div className="mb-2 p-2 bg-white rounded shadow-sm border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--gsc-gray)' }}>
              {instance?.name || 'Loading...'}
            </h1>
            {instance?.description && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--gsc-gray)' }}>
                {instance.description}
              </p>
            )}
          </div>
          <Link href="/instances" className="btn btn-secondary text-xs py-1 px-2">
            ← Back
          </Link>
        </div>
      </div>

      {/* Metrics Panel */}
      <InstanceMetricsPanel refreshKey={metricsRefreshKey} instanceId={instanceId} />

      {/* Main Content */}
      <div className="flex gap-2">
        {/* Map */}
        <div className="flex-1 border rounded overflow-hidden bg-white" style={{ height: '700px', minHeight: '700px' }}>
          {features.length === 0 && !loading && !loadingFeatures ? (
            <div className="h-full flex items-center justify-center" style={{ color: 'var(--gsc-gray)' }}>
              <div className="text-center">
                <p className="mb-2">No map data available</p>
                <p className="text-sm">Scores may not have been calculated yet.</p>
              </div>
            </div>
          ) : loadingFeatures ? (
            <div className="h-full flex items-center justify-center" style={{ color: 'var(--gsc-gray)' }}>
              <div className="text-center">
                <p className="mb-2">Loading map data...</p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={8}
              minZoom={3}
              maxZoom={18}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
              key={`map-${selectedLayer.type}-${selectedLayer.datasetId || 'overall'}-${selectedLayer.category || ''}`}
            >
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapBoundsController features={features} />
              {features.length > 0 && (
                <GeoJSON 
                  key={`geojson-${selectedLayer.type}-${selectedLayer.datasetId || 'overall'}-${selectedLayer.category || ''}`}
                  data={{
                    type: 'FeatureCollection',
                    features: features
                  } as GeoJSON.FeatureCollection}
                  onEachFeature={onEachFeature}
                />
              )}
              {/* Render hazard event layers */}
              {hazardEventLayers
                .filter((layer) => visibleHazardEvents.has(layer.id))
                .map((layer) => {
                  const filter = hazardEventFilters[layer.id] || {};
                  const filteredFeatures = (layer.geojson as GeoJSON.FeatureCollection).features.filter((feature: any, idx: number) => {
                    if (filter.geometryTypes && filter.geometryTypes.size > 0) {
                      const geomType = feature?.geometry?.type || '';
                      if (!filter.geometryTypes.has(geomType)) return false;
                    }
                    if (filter.minMagnitude !== undefined || filter.maxMagnitude !== undefined) {
                      const magnitude = feature?.properties?.[layer.magnitude_field] || feature?.properties?.value;
                      const magValue = Number(magnitude);
                      if (!isNaN(magValue)) {
                        if (filter.minMagnitude !== undefined && magValue < filter.minMagnitude) return false;
                        if (filter.maxMagnitude !== undefined && magValue > filter.maxMagnitude) return false;
                      }
                    }
                    if (filter.visibleFeatureIds && filter.visibleFeatureIds.size > 0) {
                      const featureId = feature?.id || feature?.properties?.id || `feature-${idx}`;
                      if (!filter.visibleFeatureIds.has(featureId)) return false;
                    }
                    return true;
                  });

                  const filteredGeoJSON: GeoJSON.FeatureCollection = {
                    type: 'FeatureCollection',
                    features: filteredFeatures,
                  };

                  return (
                    <GeoJSON
                      key={`hazard-${layer.id}`}
                      data={filteredGeoJSON}
                      style={(feature: any) => {
                        const magnitude = feature?.properties?.[layer.magnitude_field] || feature?.properties?.value;
                        const color = feature?.properties?.color || '#ff0000';
                        const weight = feature?.properties?.weight || 2;
                        return {
                          color: color,
                          weight: weight,
                          opacity: 0.7,
                        };
                      }}
                      onEachFeature={(feature, leafletLayer) => {
                        const magnitude = feature?.properties?.[layer.magnitude_field] || feature?.properties?.value;
                        const units = feature?.properties?.units || '';
                        leafletLayer.bindPopup(
                          `<strong>${layer.name}</strong><br/>Magnitude: ${magnitude} ${units}`
                        );
                      }}
                    />
                  );
                })}
            </MapContainer>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-64 space-y-1 flex flex-col">
          {/* Score Layers */}
          <div className="bg-white border rounded p-1.5 flex-1 overflow-y-auto">
            <h3 className="font-semibold mb-1 text-xs" style={{ color: 'var(--gsc-gray)' }}>
              Score Layers
            </h3>
            <ScoreLayerSelector
              instanceId={instanceId}
              onSelect={(selection) => {
                setSelectedLayer(selection);
              }}
              visibleHazardEvents={visibleHazardEvents}
              onToggleHazardEventVisibility={(hazardEventId, visible) => {
                setVisibleHazardEvents(prev => {
                  const next = new Set(prev);
                  if (visible) {
                    next.add(hazardEventId);
                  } else {
                    next.delete(hazardEventId);
                  }
                  // Note: Saving is handled by useEffect above
                  return next;
                });
              }}
            />
          </div>
        </div>
      </div>

      {/* Vulnerable Locations Panel */}
      <div className="mt-4">
        <VulnerableLocationsPanel instanceId={instanceId} refreshKey={metricsRefreshKey} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="border rounded-lg p-2 mt-4" style={{ backgroundColor: 'rgba(211, 84, 0, 0.1)', borderColor: 'var(--gsc-orange)' }}>
          <p className="text-xs" style={{ color: 'var(--gsc-orange)' }}>
            ⚠️ Some data may be incomplete: {error}
          </p>
        </div>
      )}
    </div>
  );
}

