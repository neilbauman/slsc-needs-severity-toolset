'use client';

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";
import { fetchHazardEventScores } from "@/lib/fetchHazardEventScoresClient";
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
  const [showCopySuccess, setShowCopySuccess] = useState(false);

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
  // This runs early to ensure filters are loaded before hazard events are processed
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
        
        // Load filters from localStorage right after loading hazard events
        // This ensures filters are available when layers are rendered
        const filterKey = `hazard_filters_${instanceId}`;
        const savedFilters = localStorage.getItem(filterKey);
        console.log('Checking localStorage for filters:', {
          key: filterKey,
          found: !!savedFilters,
          instanceId: instanceId,
          allKeys: typeof window !== 'undefined' ? Object.keys(localStorage).filter(k => k.includes('hazard')) : []
        });
        
        if (savedFilters) {
          try {
            const parsed = JSON.parse(savedFilters);
            const filtersWithSets: Record<string, any> = {};
            Object.keys(parsed).forEach(key => {
              filtersWithSets[key] = {
                ...parsed[key],
                visibleFeatureIds: parsed[key].visibleFeatureIds ? new Set(parsed[key].visibleFeatureIds) : undefined,
                geometryTypes: parsed[key].geometryTypes ? new Set(parsed[key].geometryTypes) : undefined,
              };
            });
            console.log('Loaded filters from localStorage in fetchData:', filtersWithSets);
            setHazardEventFilters(filtersWithSets);
          } catch (e) {
            console.warn('Error loading saved filters in fetchData:', e);
          }
        } else {
          console.log('No saved filters found in localStorage for instance:', instanceId, 'Key:', filterKey);
          // Check if there are any hazard-related keys at all
          if (typeof window !== 'undefined') {
            const allHazardKeys = Object.keys(localStorage).filter(k => k.includes('hazard'));
            console.log('All hazard-related localStorage keys:', allHazardKeys);
          }
        }
        
        // Check if we already have saved visibility from the earlier useEffect
        // If not, load it now or default to all visible
        const savedVisible = localStorage.getItem(`hazard_visibility_${instanceId}`);
        if (savedVisible) {
          try {
            const savedSet = new Set(JSON.parse(savedVisible));
            // Only include IDs that exist in the loaded layers
            const validIds = layers.filter(l => savedSet.has(l.id)).map(l => l.id);
            if (validIds.length > 0) {
              setVisibleHazardEvents(new Set(validIds));
            } else {
              // If saved set doesn't match any current layers, default to all visible
              setVisibleHazardEvents(new Set(layers.map(l => l.id)));
            }
          } catch (e) {
            console.warn('Error loading saved visibility, defaulting to all visible:', e);
            setVisibleHazardEvents(new Set(layers.map(l => l.id)));
          }
        } else {
          // Make all hazard events visible by default if no saved preference
          setVisibleHazardEvents(new Set(layers.map(l => l.id)));
        }
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

  // Load features for selected layer (full implementation)
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
      } else if (selection.type === 'dataset' && selection.datasetId) {
        // Load scores for specific dataset
        const { data: scores, error: scoresError } = await supabase
          .from("instance_dataset_scores")
          .select("admin_pcode, score")
          .eq("instance_id", instanceId)
          .eq("dataset_id", selection.datasetId);

        if (scoresError) {
          console.error("Error fetching dataset scores:", scoresError);
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        const scoreMap = new Map(scores?.map((s: any) => [s.admin_pcode, Number(s.score)]) || []);
        
        // Load raw values for this dataset
        const { data: rawValues } = await supabase
          .from("dataset_values_numeric")
          .select("admin_pcode, value")
          .eq("dataset_id", selection.datasetId);
        
        const rawValueMap = new Map(rawValues?.map((v: any) => [v.admin_pcode, Number(v.value)]) || []);

        // Get geometry from view
        const { data: geoRows, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode, geojson")
          .eq("instance_id", instanceId);
        
        if (geoError || !geoRows || geoRows.length === 0) {
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        const allFeatures = geoRows
          .map((row: any) => {
            try {
              const feature = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
              const datasetScore = scoreMap.get(row.admin_pcode);
              const rawValue = rawValueMap.get(row.admin_pcode);
              
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  admin_pcode: row.admin_pcode,
                  admin_name: feature.properties?.admin_name || feature.properties?.name,
                  score: datasetScore,
                  raw_value: rawValue,
                  has_score: datasetScore !== undefined,
                }
              };
            } catch (e) {
              console.warn("Error parsing GeoJSON feature:", e);
              return null;
            }
          })
          .filter((f: any) => f !== null);
        
        setFeatures(allFeatures);
        setLoadingFeatures(false);
      } else if (selection.type === 'category_score' && selection.category) {
        // Load category score - aggregate all dataset scores within this category
        const { data: categoryDatasets } = await supabase
          .from("instance_datasets")
          .select("dataset_id, datasets!inner(id, name, category)")
          .eq("instance_id", instanceId);
        
        const categoryDatasetIds = (categoryDatasets || [])
          .filter((cd: any) => cd.datasets?.category === selection.category)
          .map((cd: any) => cd.dataset_id);
        
        let categoryScores: any[] = [];
        if (categoryDatasetIds.length > 0) {
          const { data: datasetScores } = await supabase
            .from("instance_dataset_scores")
            .select("admin_pcode, score")
            .eq("instance_id", instanceId)
            .in("dataset_id", categoryDatasetIds);
          
          if (datasetScores) {
            categoryScores = datasetScores;
          }
        }
        
        // For Hazard category, also include hazard event scores
        if (selection.category === 'Hazard') {
          const { data: hazardEventsData } = await supabase
            .rpc('get_hazard_events_for_instance', { in_instance_id: instanceId });
          
          if (hazardEventsData && hazardEventsData.length > 0) {
            const hazardEventIds = hazardEventsData.map((e: any) => e.id);
            try {
              const hazardScores = await fetchHazardEventScores({
                instanceId,
                hazardEventIds,
              });
              if (hazardScores.length > 0) {
                categoryScores = [...categoryScores, ...hazardScores];
              }
            } catch (error) {
              console.error("Error fetching hazard event scores:", error);
            }
          }
        }
        
        if (categoryScores.length === 0) {
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        // Aggregate scores by admin_pcode (average)
        const locationScoreMap: Record<string, { sum: number; count: number }> = {};
        categoryScores.forEach((s: any) => {
          if (!locationScoreMap[s.admin_pcode]) {
            locationScoreMap[s.admin_pcode] = { sum: 0, count: 0 };
          }
          locationScoreMap[s.admin_pcode].sum += Number(s.score);
          locationScoreMap[s.admin_pcode].count += 1;
        });
        
        const avgCategoryScores = new Map<string, number>();
        Object.keys(locationScoreMap).forEach((pcode) => {
          avgCategoryScores.set(pcode, locationScoreMap[pcode].sum / locationScoreMap[pcode].count);
        });
        
        // Get geometry from view
        const { data: geoRows, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode, geojson")
          .eq("instance_id", instanceId);
        
        if (geoError || !geoRows || geoRows.length === 0) {
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        const categoryFeatures = geoRows
          .map((row: any) => {
            try {
              const feature = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
              const categoryScore = avgCategoryScores.get(row.admin_pcode);
              
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  admin_pcode: row.admin_pcode,
                  admin_name: feature.properties?.admin_name || feature.properties?.name,
                  score: categoryScore,
                  has_score: categoryScore !== undefined,
                }
              };
            } catch (e) {
              console.warn("Error parsing GeoJSON feature:", e);
              return null;
            }
          })
          .filter((f: any) => f !== null);
        
        setFeatures(categoryFeatures);
        setLoadingFeatures(false);
      } else if (selection.type === 'category' && selection.datasetId && selection.category) {
        // For categorical datasets, show dataset scores
        if (selection.category === 'overall') {
          await loadFeaturesForSelection({ type: 'dataset', datasetId: selection.datasetId }, overallFeatures);
        } else {
          await loadFeaturesForSelection({ type: 'dataset', datasetId: selection.datasetId }, overallFeatures);
        }
      } else if (selection.type === 'hazard_event' && selection.hazardEventId) {
        // Load hazard event scores
        let scores: any[] = [];
        try {
          scores = await fetchHazardEventScores({
            instanceId,
            hazardEventId: selection.hazardEventId,
            includeMagnitude: true,
          });
        } catch (error) {
          console.error("Error fetching hazard event scores:", error);
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        if (!scores || scores.length === 0) {
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        const scoreMap = new Map(scores.map((s: any) => [s.admin_pcode, Number(s.score)]));
        const magnitudeMap = new Map(scores.map((s: any) => [s.admin_pcode, Number(s.magnitude_value)]));
        
        // Get geometry from view
        const { data: geoRows, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode, geojson")
          .eq("instance_id", instanceId);
        
        if (geoError || !geoRows || geoRows.length === 0) {
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        const hazardFeatures = geoRows
          .map((row: any) => {
            try {
              const feature = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
              const hazardScore = scoreMap.get(row.admin_pcode);
              const magnitude = magnitudeMap.get(row.admin_pcode);
              
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  admin_pcode: row.admin_pcode,
                  admin_name: feature.properties?.admin_name || feature.properties?.name,
                  score: hazardScore,
                  magnitude_value: magnitude,
                  has_score: hazardScore !== undefined,
                }
              };
            } catch (e) {
              console.warn("Error parsing GeoJSON feature:", e);
              return null;
            }
          })
          .filter((f: any) => f !== null);
        
        setFeatures(hazardFeatures);
        setLoadingFeatures(false);
      } else {
        // Fallback to overall
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

  // Ensure filters are loaded when hazard layers are available
  // This fixes timing issues in iframe context where filters might not be applied
  useEffect(() => {
    if (hazardEventLayers.length > 0 && instanceId && typeof window !== 'undefined') {
      // Re-load filters from localStorage to ensure they're applied
      // This is important for iframe context where timing can be different
      const savedFilters = localStorage.getItem(`hazard_filters_${instanceId}`);
      if (savedFilters) {
        try {
          const parsed = JSON.parse(savedFilters);
          const filtersWithSets: Record<string, any> = {};
          Object.keys(parsed).forEach(key => {
            filtersWithSets[key] = {
              ...parsed[key],
              visibleFeatureIds: parsed[key].visibleFeatureIds ? new Set(parsed[key].visibleFeatureIds) : undefined,
              geometryTypes: parsed[key].geometryTypes ? new Set(parsed[key].geometryTypes) : undefined,
            };
          });
          // Always set filters when layers are loaded to ensure they're applied
          console.log('Re-applying filters after layers loaded (iframe fix):', filtersWithSets);
          setHazardEventFilters(prev => {
            // Only update if there's a meaningful difference to avoid unnecessary re-renders
            const prevKeys = Object.keys(prev).sort();
            const newKeys = Object.keys(filtersWithSets).sort();
            if (prevKeys.length !== newKeys.length) {
              return filtersWithSets;
            }
            // Check if geometryTypes filters differ
            for (const key of newKeys) {
              const prevFilter = prev[key];
              const newFilter = filtersWithSets[key];
              if (!prevFilter && newFilter) return filtersWithSets;
              if (prevFilter && !newFilter) return filtersWithSets;
              if (prevFilter && newFilter) {
                const prevTypes = prevFilter.geometryTypes ? Array.from(prevFilter.geometryTypes).sort().join(',') : '';
                const newTypes = newFilter.geometryTypes ? Array.from(newFilter.geometryTypes).sort().join(',') : '';
                if (prevTypes !== newTypes) return filtersWithSets;
              }
            }
            return prev; // No change needed
          });
        } catch (e) {
          console.warn('Error re-loading filters:', e);
        }
      }
    }
  }, [hazardEventLayers.length, instanceId]); // Re-run when layers are loaded

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
    const rawValue = feature.properties?.raw_value;
    const magnitude = feature.properties?.magnitude_value;
    
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
      
      // Build popup content based on available data
      let popupContent = `<strong>${name}</strong><br/>Score: ${score.toFixed(2)}`;
      if (rawValue !== undefined && !isNaN(rawValue)) {
        popupContent += `<br/>Value: ${rawValue.toFixed(2)}`;
      }
      if (magnitude !== undefined && !isNaN(magnitude)) {
        popupContent += `<br/>Magnitude: ${magnitude.toFixed(2)}`;
      }
      layer.bindPopup(popupContent);
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

  // Copy iframe code to clipboard
  const copyIframeCode = async () => {
    if (!instanceId) return;
    
    const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const embedUrl = `${currentUrl}/instances/${instanceId}/embed`;
    
    const iframeCode = `<iframe 
  src="${embedUrl}" 
  width="100%" 
  height="900px" 
  frameborder="0"
  allowfullscreen>
</iframe>`;
    
    try {
      await navigator.clipboard.writeText(iframeCode);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = iframeCode;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 3000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        alert('Failed to copy. Please copy manually:\n\n' + iframeCode);
      }
      document.body.removeChild(textArea);
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
                  // CRITICAL: Always check localStorage directly during rendering (iframe fix)
                  // In iframe context, React state might not update in time, so we always check localStorage
                  let filter = hazardEventFilters[layer.id] || {};
                  
                  // Always prefer localStorage over state for iframe reliability
                  if (typeof window !== 'undefined') {
                    try {
                      const filterKey = `hazard_filters_${instanceId}`;
                      const savedFilters = localStorage.getItem(filterKey);
                      if (savedFilters) {
                        const parsed = JSON.parse(savedFilters);
                        const layerFilter = parsed[layer.id];
                        if (layerFilter && (layerFilter.geometryTypes || layerFilter.visibleFeatureIds)) {
                          // Always use localStorage filter if it has geometryTypes or visibleFeatureIds
                          // This ensures filters work in iframe even if state is stale
                          const localStorageFilter = {
                            ...layerFilter,
                            geometryTypes: layerFilter.geometryTypes ? new Set(layerFilter.geometryTypes) : undefined,
                            visibleFeatureIds: layerFilter.visibleFeatureIds ? new Set(layerFilter.visibleFeatureIds) : undefined,
                          };
                          
                          // Prefer localStorage if it has geometryTypes (the main filter we care about)
                          if (localStorageFilter.geometryTypes && localStorageFilter.geometryTypes.size > 0) {
                            filter = localStorageFilter;
                            // Silently update state in background (don't log every render)
                            if (!hazardEventFilters[layer.id] || 
                                !hazardEventFilters[layer.id].geometryTypes || 
                                hazardEventFilters[layer.id].geometryTypes.size === 0) {
                              setHazardEventFilters(prev => ({
                                ...prev,
                                [layer.id]: filter
                              }));
                            }
                          } else if (filter.geometryTypes && filter.geometryTypes.size > 0) {
                            // State has filter, keep it
                          } else {
                            // Use localStorage filter even if it doesn't have geometryTypes (might have other filters)
                            filter = localStorageFilter;
                          }
                        }
                      }
                    } catch (e) {
                      // Silently fail - don't spam console
                    }
                  }
                  
                  const totalFeatures = (layer.geojson as GeoJSON.FeatureCollection).features.length;
                  
                  const filteredFeatures = (layer.geojson as GeoJSON.FeatureCollection).features.filter((feature: any, idx: number) => {
                    // Apply geometry type filter
                    if (filter.geometryTypes && filter.geometryTypes.size > 0) {
                      const geomType = feature?.geometry?.type || '';
                      if (!filter.geometryTypes.has(geomType)) {
                        return false;
                      }
                    }
                    // Apply magnitude range filter
                    if (filter.minMagnitude !== undefined || filter.maxMagnitude !== undefined) {
                      const magnitude = feature?.properties?.[layer.magnitude_field] || feature?.properties?.value;
                      const magValue = Number(magnitude);
                      if (!isNaN(magValue)) {
                        if (filter.minMagnitude !== undefined && magValue < filter.minMagnitude) return false;
                        if (filter.maxMagnitude !== undefined && magValue > filter.maxMagnitude) return false;
                      }
                    }
                    // Apply feature ID filter
                    if (filter.visibleFeatureIds && filter.visibleFeatureIds.size > 0) {
                      const featureId = feature?.id || feature?.properties?.id || `feature-${idx}`;
                      if (!filter.visibleFeatureIds.has(featureId)) return false;
                    }
                    return true;
                  });
                  
                  // Debug logging
                  if (filter.geometryTypes && filter.geometryTypes.size > 0) {
                    console.log(`Layer ${layer.id}: Filtering by geometry types:`, Array.from(filter.geometryTypes), `- Showing ${filteredFeatures.length} of ${totalFeatures} features`);
                  }

                  const filteredGeoJSON: GeoJSON.FeatureCollection = {
                    type: 'FeatureCollection',
                    features: filteredFeatures,
                  };

                  // Create a key that includes filter state to force re-render when filters change
                  const filterKey = filter.geometryTypes ? Array.from(filter.geometryTypes).sort().join(',') : 'all';
                  const filterKeyFull = `${layer.id}-${filterKey}-${filter.minMagnitude || ''}-${filter.maxMagnitude || ''}`;
                  
                  return (
                    <GeoJSON
                      key={`hazard-${filterKeyFull}`}
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

      {/* Copy iFrame Code Button - Subtle placement at bottom right */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={copyIframeCode}
          className="text-xs px-2.5 py-1 rounded border hover:opacity-80 transition-all"
          style={{ 
            backgroundColor: 'rgba(0, 75, 135, 0.03)', 
            borderColor: 'rgba(0, 75, 135, 0.2)',
            color: 'var(--gsc-gray)',
            fontSize: '11px'
          }}
          title="Copy iframe embed code to clipboard for sharing on other websites"
        >
          {showCopySuccess ? (
            <span className="flex items-center gap-1">
              <span style={{ color: 'var(--gsc-green)' }}>✓</span> Copied!
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span style={{ opacity: 0.6 }}>📋</span> Copy iFrame Code
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

