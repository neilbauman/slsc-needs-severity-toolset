'use client';

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import Link from "next/link";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";
import InstanceMetricsPanel from "@/components/InstanceMetricsPanel";
import VulnerableLocationsPanel from "@/components/VulnerableLocationsPanel";
import UploadHazardEventModal from "@/components/UploadHazardEventModal";
import HazardEventScoringModal from "@/components/HazardEventScoringModal";

// Dynamically import modals to avoid SSR issues
const InstanceScoringModal = dynamic(
  () => import("@/components/InstanceScoringModal"),
  { ssr: false }
);

const InstanceDatasetConfigModal = dynamic(
  () => import("@/components/InstanceDatasetConfigModal"),
  { ssr: false }
);

const DefineAffectedAreaModal = dynamic(
  () => import("@/components/DefineAffectedAreaModal"),
  { ssr: false }
);

// Component to handle map bounds after features load
function MapBoundsController({ features }: { features: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (features.length > 0) {
      try {
        const bounds = L.geoJSON(features).getBounds();
        // Fit bounds with minimal padding to zoom closer to affected area
        map.fitBounds(bounds, { 
          padding: [5, 5],
          maxZoom: 11 // Allow closer automatic zoom
        });
      } catch (err) {
        console.error("Error fitting bounds:", err);
      }
    }
  }, [features, map]);

  return null;
}

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [overallFeatures, setOverallFeatures] = useState<any[]>([]); // Store overall features for reuse
  const [loading, setLoading] = useState(true);
  const [loadingFeatures, setLoadingFeatures] = useState(false); // Track feature loading separately
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [metricsRefreshKey, setMetricsRefreshKey] = useState(0); // Key to force metrics refresh
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [showDatasetConfigModal, setShowDatasetConfigModal] = useState(false);
  const [showAffectedAreaModal, setShowAffectedAreaModal] = useState(false);
  const [showUploadHazardModal, setShowUploadHazardModal] = useState(false);
  const [showHazardScoringModal, setShowHazardScoringModal] = useState(false);
  const [selectedHazardEvent, setSelectedHazardEvent] = useState<any>(null);
  const [hazardEvents, setHazardEvents] = useState<any[]>([]);
  const [hazardEventLayers, setHazardEventLayers] = useState<any[]>([]);
  const [visibleHazardEvents, setVisibleHazardEvents] = useState<Set<string>>(new Set()); // Track which hazard events are visible
  const [hazardEventFilters, setHazardEventFilters] = useState<Record<string, { minMagnitude?: number, maxMagnitude?: number, visibleFeatureIds?: Set<string>, geometryTypes?: Set<string> }>>({}); // Feature-level filters per hazard event
  const [selectedLayer, setSelectedLayer] = useState<{ type: 'overall' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, datasetName?: string, categoryName?: string, hazardEventId?: string }>({ type: 'overall' });

  // Ensure instanceId exists
  const instanceId = params?.id;
  
  if (!instanceId) {
    return (
      <div className="p-4">
        <div 
          className="border rounded-lg p-4"
          style={{
            backgroundColor: 'rgba(99, 7, 16, 0.05)',
            borderColor: 'var(--gsc-red)'
          }}
        >
          <h2 
            className="font-semibold mb-2"
            style={{ color: 'var(--gsc-red)' }}
          >
            Invalid Instance ID
          </h2>
          <p 
            className="text-sm mb-4"
            style={{ color: 'var(--gsc-gray)' }}
          >
            No instance ID provided.
          </p>
          <Link
            href="/instances"
            className="btn btn-danger text-sm"
          >
            Back to Instances
          </Link>
        </div>
      </div>
    );
  }

  const fetchData = async () => {
    if (!instanceId) return;
    
    try {
      setError(null);
      
      // Fetch instance basic info - always fetch from instances table for name
      let instanceData = null;
      const { data: directData, error: directError } = await supabase
        .from("instances")
        .select("*")
        .eq("id", instanceId)
        .single();
      
      if (!directError && directData) {
        instanceData = directData;
      } else {
        // Last resort: create minimal instance object with just the ID
        instanceData = { id: instanceId, name: `Instance ${instanceId}` };
      }
      setInstance(instanceData);

      // Fetch datasets - try view first, then fallback
      let dsData: any[] = [];
      try {
        const { data, error: dsError } = await supabase
          .from("v_instance_datasets_view")
          .select("*")
          .eq("instance_id", instanceId);

        if (!dsError && data) {
          dsData = data;
        } else {
          // Fallback: fetch from instance_datasets with join
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("instance_datasets")
            .select(`
              id,
              dataset_id,
              instance_id,
              datasets (
                id,
                name,
                type,
                admin_level
              )
            `)
            .eq("instance_id", instanceId);

          if (!fallbackError && fallbackData) {
            // Load configs separately
            const datasetIds = fallbackData.map((d: any) => d.dataset_id).filter(Boolean);
            let configMap = new Map();
            if (datasetIds.length > 0) {
              const { data: configs } = await supabase
                .from("instance_dataset_config")
                .select("dataset_id, score_config")
                .eq("instance_id", instanceId)
                .in("dataset_id", datasetIds);
              
              configMap = new Map(
                (configs || []).map((c: any) => [c.dataset_id, c.score_config])
              );
            }

            dsData = fallbackData.map((d: any) => ({
              id: d.id,
              dataset_id: d.dataset_id,
              dataset_name: d.datasets?.name || `Dataset ${d.dataset_id}`,
              score_config: configMap.get(d.dataset_id) || null,
            }));
          }
        }
      } catch (e) {
        console.warn("Error fetching datasets:", e);
      }
      setDatasets(dsData);

      // Load hazard events for this instance
      const { data: hazardEventsData, error: hazardError } = await supabase
        .rpc('get_hazard_events_for_instance', { in_instance_id: instanceId });
      
      if (!hazardError && hazardEventsData) {
        setHazardEvents(hazardEventsData);
        
        // Convert hazard events to map layers
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
      }

      // Load overall instance scores for initial view
      let parsed: any[] = [];
      try {
        console.log("Loading overall scores for initial view");
        
        // First, get all available admin_pcodes with geometry from geojson view
        const { data: geoRows, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode, geojson")
          .eq("instance_id", instanceId);

        if (geoError) {
          console.warn("Error loading GeoJSON:", geoError);
        } else if (!geoRows || geoRows.length === 0) {
          console.warn("No geometry found for instance");
        } else {
          console.log(`Found ${geoRows.length} locations with geometry`);
          
          // Group by admin_pcode to get unique geometry
          const geoMap = new Map<string, any>();
          geoRows.forEach((row: any) => {
            if (!geoMap.has(row.admin_pcode)) {
              try {
                const feature = typeof row.geojson === 'string' 
                  ? JSON.parse(row.geojson) 
                  : row.geojson;
                geoMap.set(row.admin_pcode, feature);
              } catch (e) {
                console.warn("Error parsing GeoJSON for", row.admin_pcode, e);
              }
            }
          });
          
          console.log(`Parsed ${geoMap.size} unique locations with geometry`);
          
          // Now get scores only for admin_pcodes that have geometry
          const adminPcodesWithGeometry = Array.from(geoMap.keys());
          
          if (adminPcodesWithGeometry.length > 0) {
            // Split into chunks if too many (Supabase IN clause limit is ~1000)
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
              
              if (scoresError) {
                console.warn("Error loading scores for chunk:", scoresError);
              } else if (scores) {
                allScores = [...allScores, ...scores];
              }
            }
            
            console.log(`Loaded ${allScores.length} overall scores for locations with geometry`);

            // Create score map
            const scoreMap = new Map(allScores.map((s: any) => [s.admin_pcode, Number(s.avg_score)]));
          
            // Combine scores with geometry
            parsed = adminPcodesWithGeometry
              .map((pcode: string) => {
                const geoFeature = geoMap.get(pcode);
                if (!geoFeature) {
                  return null;
                }
                
                const score = scoreMap.get(pcode);
                
                // Merge score into feature properties
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
            
            console.log(`Created ${parsed.length} features with overall scores`);
          }
        }
      } catch (e) {
        console.warn("Error loading overall scores:", e);
      }
      
      // Set initial features (overall view)
      setFeatures(parsed);
      setOverallFeatures(parsed); // Store for reuse when switching back to overall
    } catch (err: any) {
      console.error("Error loading instance page:", err);
      setError(err?.message || "Failed to load instance data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ✅ Load features for selected layer (overall, dataset, category, category_score, or hazard_event)
  const loadFeaturesForSelection = async (
    selection: { type: 'overall' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, categoryName?: string, hazardEventId?: string },
    overallFeatures?: any[]
  ) => {
    try {
      // Clear features first to prevent stale data from showing
      setFeatures([]);
      setLoadingFeatures(true);
      
      console.log("loadFeaturesForSelection called with:", {
        type: selection.type,
        hazardEventId: selection.hazardEventId,
        datasetId: selection.datasetId,
        category: selection.category
      });
      
      if (selection.type === 'overall') {
        // Use overall instance scores
        if (overallFeatures) {
          console.log("Using cached overall features:", overallFeatures.length);
          setFeatures(overallFeatures);
          setLoadingFeatures(false);
          return;
        }
        
        console.log("Loading overall scores from v_instance_admin_scores");
        
        // First, get all available admin_pcodes with geometry from geojson view
        const { data: geoRows, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode, geojson")
          .eq("instance_id", instanceId);

        if (geoError) {
          console.error("Error fetching GeoJSON:", geoError);
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        if (!geoRows || geoRows.length === 0) {
          console.log("No geometry found for instance");
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        console.log(`Found ${geoRows.length} locations with geometry`);

        // Group by admin_pcode to get unique geometry
        const geoMap = new Map<string, any>();
        geoRows.forEach((row: any) => {
          if (!geoMap.has(row.admin_pcode)) {
            try {
              const feature = typeof row.geojson === 'string' 
                ? JSON.parse(row.geojson) 
                : row.geojson;
              geoMap.set(row.admin_pcode, feature);
            } catch (e) {
              console.warn("Error parsing GeoJSON for", row.admin_pcode, e);
            }
          }
        });
        
        console.log(`Parsed ${geoMap.size} unique locations with geometry`);

        // Get scores only for admin_pcodes that have geometry
        const adminPcodesWithGeometry = Array.from(geoMap.keys());
        
        if (adminPcodesWithGeometry.length === 0) {
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        // Split into chunks if too many (Supabase IN clause limit is ~1000)
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
          
          if (scoresError) {
            console.error("Error fetching overall scores:", scoresError);
            setFeatures([]);
            setLoadingFeatures(false);
            return;
          } else if (scores) {
            allScores = [...allScores, ...scores];
          }
        }
        
        console.log(`Loaded ${allScores.length} overall scores for locations with geometry`);

        // Create score map
        const scoreMap = new Map(allScores.map((s: any) => [s.admin_pcode, Number(s.avg_score)]));

        // Combine scores with geometry
        const features = adminPcodesWithGeometry
          .map((pcode: string) => {
            const geoFeature = geoMap.get(pcode);
            if (!geoFeature) {
              return null;
            }
            
            const score = scoreMap.get(pcode);
            
            // Merge score into feature properties
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
        
        console.log(`Created ${features.length} features with overall scores`);
        setFeatures(features);
        setOverallFeatures(features); // Cache for future use
        setLoadingFeatures(false);
      } else if (selection.type === 'dataset' && selection.datasetId) {
        console.log(`Loading features for dataset: ${selection.datasetId}`);
        
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

        // Create score map for this dataset (may be empty if no scores)
        const scoreMap = new Map(scores?.map((s: any) => [s.admin_pcode, Number(s.score)]) || []);
        console.log(`Loaded ${scores?.length || 0} scores for dataset ${selection.datasetId}`);
        
        // Load raw values for this dataset to show in tooltip
        const { data: rawValues, error: rawValuesError } = await supabase
          .from("dataset_values_numeric")
          .select("admin_pcode, value")
          .eq("dataset_id", selection.datasetId);
        
        if (rawValuesError) {
          console.warn("Error fetching raw values:", rawValuesError);
        }
        
        // Create raw value map
        const rawValueMap = new Map(rawValues?.map((v: any) => [v.admin_pcode, Number(v.value)]) || []);
        console.log(`Loaded ${rawValues?.length || 0} raw values for dataset ${selection.datasetId}`);

        // Get geometry from view - each row is a single Feature (not FeatureCollection)
        const { data: geoRows, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode, geojson")
          .eq("instance_id", instanceId);
        
        if (geoError) {
          console.error("Error fetching GeoJSON:", geoError);
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        if (!geoRows || geoRows.length === 0) {
          console.log("No GeoJSON features found for instance");
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        console.log(`Loaded ${geoRows.length} GeoJSON features from view`);
        
        // Parse ALL features (not just those with scores) - show locations without data in grey
        const allFeatures = geoRows
          .map((row: any) => {
            try {
              // Parse the geojson field (it's a single Feature, not FeatureCollection)
              const feature = typeof row.geojson === 'string' 
                ? JSON.parse(row.geojson) 
                : row.geojson;
              
              // Check if this admin_pcode has a score for this dataset
              const datasetScore = scoreMap.get(row.admin_pcode);
              const rawValue = rawValueMap.get(row.admin_pcode);
              
              // Include ALL features, even those without scores
              // Update the feature with the dataset-specific score and raw value
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  admin_pcode: row.admin_pcode,
                  admin_name: feature.properties?.admin_name || feature.properties?.name,
                  score: datasetScore, // May be undefined if no score
                  raw_value: rawValue, // Raw data value for tooltip
                  has_score: datasetScore !== undefined, // Flag to indicate if score exists
                }
              };
            } catch (e) {
              console.warn("Error parsing GeoJSON feature:", e, row);
              return null;
            }
          })
          .filter((f: any) => f !== null);
        
        console.log(`Processed ${allFeatures.length} features (${scoreMap.size} with scores, ${allFeatures.length - scoreMap.size} without scores)`);
        
        // Force a new array reference to ensure React detects the change
        setFeatures([...allFeatures]);
        setLoadingFeatures(false);
      } else if (selection.type === 'category_score' && selection.category) {
        // Load category score - aggregate all dataset scores within this category
        // Includes both regular datasets and hazard events for Hazard category
        console.log(`Loading category score for: ${selection.category}`);
        
        // Get all datasets in this category
        const { data: categoryDatasets } = await supabase
          .from("instance_datasets")
          .select("dataset_id, datasets!inner(id, name, category)")
          .eq("instance_id", instanceId);
        
        const categoryDatasetIds = (categoryDatasets || [])
          .filter((cd: any) => cd.datasets?.category === selection.category)
          .map((cd: any) => cd.dataset_id);
        
        // Load all scores for datasets in this category
        let categoryScores: any[] = [];
        if (categoryDatasetIds.length > 0) {
          const { data: datasetScores, error: datasetScoresError } = await supabase
            .from("instance_dataset_scores")
            .select("admin_pcode, score")
            .eq("instance_id", instanceId)
            .in("dataset_id", categoryDatasetIds);
          
          if (datasetScoresError) {
            console.error("Error fetching dataset scores:", datasetScoresError);
          } else if (datasetScores) {
            categoryScores = datasetScores;
          }
        }
        
        // For Hazard category, also include hazard event scores
        if (selection.category === 'Hazard') {
          const { data: hazardEventsData } = await supabase
            .rpc('get_hazard_events_for_instance', { in_instance_id: instanceId });
          
          if (hazardEventsData && hazardEventsData.length > 0) {
            const hazardEventIds = hazardEventsData.map((e: any) => e.id);
            const { data: hazardScores, error: hazardScoresError } = await supabase
              .from("hazard_event_scores")
              .select("admin_pcode, score")
              .eq("instance_id", instanceId)
              .in("hazard_event_id", hazardEventIds);
            
            if (hazardScoresError) {
              console.error("Error fetching hazard event scores:", hazardScoresError);
            } else if (hazardScores) {
              categoryScores = [...categoryScores, ...hazardScores];
            }
          }
        }
        
        if (categoryScores.length === 0) {
          console.log("No scores found for category:", selection.category);
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        // Aggregate scores by admin_pcode (average of all datasets/hazard events in category)
        const locationScoreMap: Record<string, { sum: number; count: number }> = {};
        categoryScores.forEach((s: any) => {
          if (!locationScoreMap[s.admin_pcode]) {
            locationScoreMap[s.admin_pcode] = { sum: 0, count: 0 };
          }
          locationScoreMap[s.admin_pcode].sum += Number(s.score);
          locationScoreMap[s.admin_pcode].count += 1;
        });
        
        // Calculate average score per location
        const avgCategoryScores = new Map<string, number>();
        Object.keys(locationScoreMap).forEach((pcode) => {
          avgCategoryScores.set(pcode, locationScoreMap[pcode].sum / locationScoreMap[pcode].count);
        });
        
        console.log(`Computed category scores for ${avgCategoryScores.size} locations`);
        
        // Get geometry from view
        const { data: geoRows, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode, geojson")
          .eq("instance_id", instanceId);
        
        if (geoError) {
          console.error("Error fetching GeoJSON:", geoError);
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        if (!geoRows || geoRows.length === 0) {
          console.log("No GeoJSON features found for instance");
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        // Map category scores to features
        const categoryFeatures = geoRows
          .map((row: any) => {
            try {
              const feature = typeof row.geojson === 'string' 
                ? JSON.parse(row.geojson) 
                : row.geojson;
              
              const categoryScore = avgCategoryScores.get(row.admin_pcode);
              
              // Include all features, but only those with scores will show colors
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  admin_pcode: row.admin_pcode,
                  admin_name: feature.properties?.admin_name || feature.properties?.name,
                  score: categoryScore, // Category aggregated score
                  has_score: categoryScore !== undefined,
                }
              };
            } catch (e) {
              console.warn("Error parsing GeoJSON feature:", e, row);
              return null;
            }
          })
          .filter((f: any) => f !== null);
        
        console.log(`Mapped ${categoryFeatures.length} features with category scores`);
        setFeatures([...categoryFeatures]);
        setLoadingFeatures(false);
      } else if (selection.type === 'category' && selection.datasetId && selection.category) {
        // For categorical datasets, if "overall" is selected, show dataset scores
        // If a specific category is selected, we'd need category-specific scoring
        // For now, show the dataset's overall scores (calculated from all categories)
        if (selection.category === 'overall') {
          await loadFeaturesForSelection({ type: 'dataset', datasetId: selection.datasetId }, overallFeatures);
        } else {
          // TODO: Implement category-specific score visualization
          // For now, fall back to dataset view
          await loadFeaturesForSelection({ type: 'dataset', datasetId: selection.datasetId }, overallFeatures);
        }
      } else if (selection.type === 'hazard_event' && selection.hazardEventId) {
        // Load hazard event scores
        console.log(`Loading features for hazard event: ${selection.hazardEventId}`);
        
        const { data: scores, error: scoresError } = await supabase
          .from("hazard_event_scores")
          .select("admin_pcode, score, magnitude_value")
          .eq("instance_id", instanceId)
          .eq("hazard_event_id", selection.hazardEventId);

        if (scoresError) {
          console.error("Error fetching hazard event scores:", scoresError);
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        if (!scores || scores.length === 0) {
          console.log("No scores found for hazard event - user needs to apply scoring first");
          console.log("Query details:", {
            instance_id: instanceId,
            hazard_event_id: selection.hazardEventId
          });
          // Check if hazard event exists
          const { data: eventCheck } = await supabase
            .from("hazard_events")
            .select("id, name")
            .eq("id", selection.hazardEventId)
            .single();
          console.log("Hazard event exists:", eventCheck);
          // Show a message that scoring needs to be applied
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        console.log(`Found ${scores.length} hazard event scores:`, scores.slice(0, 5));
        console.log("Sample scores:", scores.slice(0, 3).map((s: any) => ({
          admin_pcode: s.admin_pcode,
          score: s.score,
          magnitude: s.magnitude_value
        })));

        // Create score map
        const scoreMap = new Map(scores.map((s: any) => [s.admin_pcode, Number(s.score)]));
        const magnitudeMap = new Map(scores.map((s: any) => [s.admin_pcode, Number(s.magnitude_value)]));
        const adminPcodes = Array.from(scoreMap.keys());
        console.log(`Loaded ${scores.length} scores for hazard event ${selection.hazardEventId} across ${adminPcodes.length} admin areas`);
        
        // Get geometry for all admin_pcodes that have scores using get_admin_boundaries_geojson
        // Based on error message, function signature uses 'level' not 'in_level'
        // Since function may not support filtering by admin_pcodes, we'll query all ADM3 and filter client-side
        let geoData: any = null;
        let geoError: any = null;
        
        // Query all ADM3 boundaries (function doesn't support filtering by admin_pcodes)
        // Try both parameter names to handle different function signatures
        let allGeoData: any = null;
        let geoJsonRpcError: any = null;
        
        // First try with 'level' (as suggested by error message)
        const result1 = await supabase.rpc('get_admin_boundaries_geojson', {
          level: 'ADM3'
        });
        
        if (result1.error) {
          // Fallback to 'in_level' (as used in AffectedAreaModal)
          const result2 = await supabase.rpc('get_admin_boundaries_geojson', {
            in_level: 'ADM3'
          });
          if (result2.error) {
            geoJsonRpcError = result2.error;
          } else {
            allGeoData = result2.data;
          }
        } else {
          allGeoData = result1.data;
        }
        
        if (geoJsonRpcError) {
          console.warn("Error fetching GeoJSON via RPC, trying direct view:", geoJsonRpcError);
          // Fallback: try to get from view
          const { data: geoRows, error: geoViewError } = await supabase
            .from("v_instance_admin_scores_geojson")
            .select("admin_pcode, geojson")
            .eq("instance_id", instanceId)
            .in("admin_pcode", adminPcodes);
          
          if (geoViewError) {
            console.error("Error fetching GeoJSON from view:", geoViewError);
            geoError = geoViewError;
          } else if (geoRows && geoRows.length > 0) {
            geoData = { 
              type: 'FeatureCollection', 
              features: geoRows.map((r: any) => (typeof r.geojson === 'string' ? JSON.parse(r.geojson) : r.geojson))
            };
          }
        } else {
          // Filter to only admin_pcodes we need
          const adminPcodeSet = new Set(adminPcodes);
          if (allGeoData) {
            if (Array.isArray(allGeoData)) {
              geoData = allGeoData.filter((feature: any) => 
                adminPcodeSet.has(feature.properties?.admin_pcode)
              );
            } else if (allGeoData.type === 'FeatureCollection' && allGeoData.features) {
              geoData = {
                ...allGeoData,
                features: allGeoData.features.filter((feature: any) =>
                  adminPcodeSet.has(feature.properties?.admin_pcode)
                )
              };
            } else {
              geoData = allGeoData;
            }
          }
        }
        
        if (geoError) {
          console.error("Error fetching GeoJSON:", geoError);
          // Fallback: try to get from view
          const { data: geoRows } = await supabase
            .from("v_instance_admin_scores_geojson")
            .select("admin_pcode, geojson")
            .eq("instance_id", instanceId)
            .in("admin_pcode", adminPcodes);
          
          if (geoRows && geoRows.length > 0) {
            const hazardFeatures = geoRows
              .map((row: any) => {
                try {
                  const feature = typeof row.geojson === 'string' 
                    ? JSON.parse(row.geojson) 
                    : row.geojson;
                  
                  const hazardScore = scoreMap.get(row.admin_pcode);
                  const magnitudeValue = magnitudeMap.get(row.admin_pcode);
                  
                  return {
                    ...feature,
                    properties: {
                      ...feature.properties,
                      admin_pcode: row.admin_pcode,
                      admin_name: feature.properties?.admin_name || feature.properties?.name,
                      score: hazardScore,
                      magnitude_value: magnitudeValue,
                      has_score: hazardScore !== undefined,
                    }
                  };
                } catch (e) {
                  console.warn("Error parsing GeoJSON feature:", e, row);
                  return null;
                }
              })
              .filter((f: any) => f !== null);
            
            console.log(`Mapped ${hazardFeatures.length} features with hazard event scores (fallback)`);
            setFeatures([...hazardFeatures]);
            setLoadingFeatures(false);
            return;
          }
          
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        // Parse GeoJSON response (should be a FeatureCollection)
        let geoFeatures: any[] = [];
        if (geoData) {
          if (typeof geoData === 'string') {
            try {
              const parsed = JSON.parse(geoData);
              geoFeatures = parsed.type === 'FeatureCollection' ? parsed.features : [parsed];
            } catch (e) {
              console.error("Error parsing GeoJSON string:", e);
            }
          } else if (Array.isArray(geoData)) {
            // If it's an array of features
            geoFeatures = geoData;
          } else if (geoData.type === 'FeatureCollection') {
            geoFeatures = geoData.features || [];
          } else if (geoData.type === 'Feature') {
            geoFeatures = [geoData];
          }
        }
        
        if (geoFeatures.length === 0) {
          console.log("No GeoJSON features found for admin areas with scores");
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        // Map scores to features - only include features that have scores
        const hazardFeatures = geoFeatures
          .map((feature: any) => {
            const adminPcode = feature.properties?.admin_pcode;
            if (!adminPcode) {
              console.warn("Feature missing admin_pcode:", feature);
              return null;
            }
            
            const hazardScore = scoreMap.get(adminPcode);
            const magnitudeValue = magnitudeMap.get(adminPcode);
            
            // Only include features that have scores
            if (hazardScore === undefined) {
              console.warn(`No score found for admin_pcode: ${adminPcode}`);
              return null;
            }
            
            return {
              ...feature,
              properties: {
                ...feature.properties,
                admin_pcode: adminPcode,
                admin_name: feature.properties?.admin_name || feature.properties?.name || adminPcode,
                score: hazardScore,
                magnitude_value: magnitudeValue !== undefined ? magnitudeValue : null,
                has_score: true, // Always true since we filter out features without scores
              }
            };
          })
          .filter((f: any) => f !== null);
        
        console.log(`Mapped ${hazardFeatures.length} features with hazard event scores`);
        console.log(`Sample feature scores:`, hazardFeatures.slice(0, 3).map((f: any) => ({
          admin_pcode: f.properties.admin_pcode,
          score: f.properties.score,
          magnitude: f.properties.magnitude_value
        })));
        setFeatures([...hazardFeatures]);
        setLoadingFeatures(false);
      }
    } catch (err) {
      console.error("Error loading features for selection:", err);
      setFeatures([]);
      setLoadingFeatures(false);
    }
  };

  // Load persisted filters and visibility from localStorage on mount
  useEffect(() => {
    if (!instanceId) return;
    
    const storageKey = `hazard_filters_${instanceId}`;
    const visibilityKey = `hazard_visibility_${instanceId}`;
    
    try {
      // Load filters
      const savedFilters = localStorage.getItem(storageKey);
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        // Convert Sets back from arrays
        const filters: Record<string, any> = {};
        Object.keys(parsed).forEach((key) => {
          const filter = parsed[key];
          filters[key] = {
            ...filter,
            visibleFeatureIds: filter.visibleFeatureIds ? new Set(filter.visibleFeatureIds) : undefined,
            geometryTypes: filter.geometryTypes ? new Set(filter.geometryTypes) : undefined,
          };
        });
        setHazardEventFilters(filters);
      }
      
      // Load visibility
      const savedVisibility = localStorage.getItem(visibilityKey);
      if (savedVisibility) {
        const parsed = JSON.parse(savedVisibility);
        setVisibleHazardEvents(new Set(parsed));
      }
    } catch (e) {
      console.warn('Error loading persisted filters:', e);
    }
  }, [instanceId]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (!instanceId) return;
    
    const storageKey = `hazard_filters_${instanceId}`;
    try {
      // Convert Sets to arrays for JSON serialization
      const serializable: Record<string, any> = {};
      Object.keys(hazardEventFilters).forEach((key) => {
        const filter = hazardEventFilters[key];
        serializable[key] = {
          ...filter,
          visibleFeatureIds: filter.visibleFeatureIds ? Array.from(filter.visibleFeatureIds) : undefined,
          geometryTypes: filter.geometryTypes ? Array.from(filter.geometryTypes) : undefined,
        };
      });
      localStorage.setItem(storageKey, JSON.stringify(serializable));
    } catch (e) {
      console.warn('Error saving filters to localStorage:', e);
    }
  }, [hazardEventFilters, instanceId]);

  // Save visibility to localStorage whenever it changes
  useEffect(() => {
    if (!instanceId) return;
    
    const visibilityKey = `hazard_visibility_${instanceId}`;
    try {
      localStorage.setItem(visibilityKey, JSON.stringify(Array.from(visibleHazardEvents)));
    } catch (e) {
      console.warn('Error saving visibility to localStorage:', e);
    }
  }, [visibleHazardEvents, instanceId]);

  useEffect(() => {
    if (instanceId) {
      fetchData();
    }
  }, [instanceId]);

  // ✅ Load features when selection changes
  useEffect(() => {
    // Only reload if we have instance loaded
    if (!loading && instance && instanceId) {
      console.log("Selection changed, loading features for:", {
        type: selectedLayer.type,
        hazardEventId: selectedLayer.hazardEventId,
        datasetId: selectedLayer.datasetId,
        category: selectedLayer.category
      });
      // Don't pass overallFeatures for hazard_event - we want fresh data
      const featuresToUse = selectedLayer.type === 'hazard_event' ? undefined : overallFeatures;
      loadFeaturesForSelection(selectedLayer, featuresToUse);
      
      // Update selected hazard event if needed
      if (selectedLayer.type === 'hazard_event' && selectedLayer.hazardEventId) {
        const event = hazardEvents.find((e: any) => e.id === selectedLayer.hazardEventId);
        if (event) {
          setSelectedHazardEvent(event);
        }
      } else {
        setSelectedHazardEvent(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer.type, selectedLayer.datasetId, selectedLayer.category, selectedLayer.categoryName, selectedLayer.hazardEventId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setMetricsRefreshKey(prev => prev + 1); // Force metrics panel to refresh
  };

  const handleScoringSaved = async () => {
    setShowScoringModal(false);
    setRefreshing(true);
    // Clear cached features to force fresh load
    setOverallFeatures([]);
    setFeatures([]);
    await fetchData(); // Refresh data after scoring changes (this updates overallFeatures)
    // Add a delay to ensure database updates are complete
    await new Promise(resolve => setTimeout(resolve, 800));
    // Reload features for current selection to show updated scores
    // Force reload by passing undefined for overallFeatures to fetch fresh data
    if (instance && instanceId) {
      await loadFeaturesForSelection(selectedLayer, undefined);
    }
    // Refresh metrics panel
    setTimeout(() => {
      setMetricsRefreshKey(prev => prev + 1); // Force metrics panel to refresh
    }, 200);
    setRefreshing(false);
  };

  const handleAffectedAreaSaved = async () => {
    setShowAffectedAreaModal(false);
    await fetchData(); // Refresh data after affected area changes
    // Reload features for current selection
    if (instance && instanceId) {
      const featuresToUse = selectedLayer.type === 'hazard_event' ? undefined : overallFeatures;
      await loadFeaturesForSelection(selectedLayer, featuresToUse);
    }
    setMetricsRefreshKey(prev => prev + 1);
  };

  const getColor = (score: number) => {
    if (score <= 1) return "#00FF00"; // green
    if (score <= 2) return "#CCFF00"; // yellow-green
    if (score <= 3) return "#FFCC00"; // yellow
    if (score <= 4) return "#FF6600"; // orange
    return "#FF0000"; // red
  };

  const onEachFeature = (feature: any, layer: any) => {
    const adminName = feature.properties?.admin_name || feature.properties?.name || 'Unknown';
    const hasScore = feature.properties?.has_score === true;
    const score = feature.properties?.score !== undefined ? Number(feature.properties.score) : null;
    const rawValue = feature.properties?.raw_value !== undefined ? Number(feature.properties.raw_value) : null;
    
      let layerName = 'Overall Score';
      if (selectedLayer.type === 'dataset') {
        layerName = selectedLayer.datasetName || 'Dataset Score';
      } else if (selectedLayer.type === 'category_score') {
        layerName = `${selectedLayer.categoryName || selectedLayer.category || 'Category'} Score`;
      } else if (selectedLayer.type === 'category') {
        if (selectedLayer.category === 'overall') {
          layerName = `${selectedLayer.datasetName || 'Dataset'} - Overall`;
        } else {
          layerName = `${selectedLayer.datasetName || 'Dataset'} - ${selectedLayer.category}`;
        }
      } else if (selectedLayer.type === 'hazard_event') {
        const event = hazardEvents.find((e: any) => e.id === selectedLayer.hazardEventId);
        layerName = event?.name || 'Hazard Event Score';
      }
    
    if (hasScore && score !== null) {
      // Has score - use color based on score
      const color = getColor(score);
      
      // Make hazard events more visually prominent with higher opacity (keep border same thickness)
      const isHazardEvent = selectedLayer.type === 'hazard_event';
      const fillOpacity = isHazardEvent ? 0.75 : 0.6; // More opaque for hazard events
      const borderWeight = 1; // Same border thickness for all datasets
      
      // Set initial style with thin black borders
      layer.setStyle({ 
        color: '#000000', // Black border
        fillColor: color, 
        fillOpacity: fillOpacity,
        weight: borderWeight, // Thicker border for hazard events
        opacity: 1
      });
      
      // Build tooltip text with name, raw value (if available), and score
      let tooltipText = `<strong>${adminName}</strong>`;
      const magnitudeValue = feature.properties?.magnitude_value !== undefined ? Number(feature.properties.magnitude_value) : null;
      if (rawValue !== null) {
        // Format raw value appropriately (check if it's a percentage or regular number)
        const formattedValue = rawValue % 1 === 0 ? rawValue.toFixed(0) : rawValue.toFixed(2);
        tooltipText += `<br/>Value: ${formattedValue}`;
      } else if (magnitudeValue !== null && selectedLayer.type === 'hazard_event') {
        // For hazard events, show magnitude value
        const formattedMagnitude = magnitudeValue % 1 === 0 ? magnitudeValue.toFixed(0) : magnitudeValue.toFixed(2);
        tooltipText += `<br/>Magnitude: ${formattedMagnitude}`;
      }
      tooltipText += `<br/>${layerName}: ${score.toFixed(2)}`;
      
      // Bind tooltip for hover (shows name, value, and score)
      layer.bindTooltip(
        tooltipText,
        {
          permanent: false,
          direction: 'top',
          offset: [0, -10],
          className: 'custom-tooltip'
        }
      );
      
      // Bind popup for click
      let popupText = `<strong>${adminName}</strong>`;
      if (rawValue !== null) {
        const formattedValue = rawValue % 1 === 0 ? rawValue.toFixed(0) : rawValue.toFixed(2);
        popupText += `<br/>Value: ${formattedValue}`;
      } else if (magnitudeValue !== null && selectedLayer.type === 'hazard_event') {
        const formattedMagnitude = magnitudeValue % 1 === 0 ? magnitudeValue.toFixed(0) : magnitudeValue.toFixed(2);
        popupText += `<br/>Magnitude: ${formattedMagnitude}`;
      }
      popupText += `<br/>${layerName}: ${score.toFixed(2)}`;
      layer.bindPopup(popupText);
      
      // Add hover effects - make hazard events more prominent with higher opacity
      // isHazardEvent already defined above, reuse it
      layer.on({
        mouseover: (e: any) => {
          const hoverLayer = e.target;
          hoverLayer.setStyle({
            weight: 2, // Same border thickness on hover for all datasets
            fillOpacity: isHazardEvent ? 0.9 : 0.8,
            color: '#000000',
            fillColor: color
          });
        },
        mouseout: (e: any) => {
          const hoverLayer = e.target;
          hoverLayer.setStyle({
            weight: 1, // Same border thickness for all datasets
            fillOpacity: isHazardEvent ? 0.75 : 0.6,
            color: '#000000',
            fillColor: color
          });
        }
      });
    } else {
      // No score - use gray
      layer.setStyle({ 
        color: '#000000', // Black border
        fillColor: '#999999', // Grey fill
        fillOpacity: 0.4,
        weight: 1, // Thin border
        opacity: 1
      });
      
      // Build tooltip text with name (and raw value if available)
      let tooltipText = `<strong>${adminName}</strong>`;
      const magnitudeValueNoScore = feature.properties?.magnitude_value !== undefined ? Number(feature.properties.magnitude_value) : null;
      if (rawValue !== null) {
        const formattedValue = rawValue % 1 === 0 ? rawValue.toFixed(0) : rawValue.toFixed(2);
        tooltipText += `<br/>Value: ${formattedValue}`;
        tooltipText += `<br/>No score available`;
      } else if (magnitudeValueNoScore !== null && selectedLayer.type === 'hazard_event') {
        const formattedMagnitude = magnitudeValueNoScore % 1 === 0 ? magnitudeValueNoScore.toFixed(0) : magnitudeValueNoScore.toFixed(2);
        tooltipText += `<br/>Magnitude: ${formattedMagnitude}`;
        tooltipText += `<br/>No score available`;
      } else {
        tooltipText += `<br/>No data available`;
      }
      
      // Bind tooltip for hover
      layer.bindTooltip(
        tooltipText,
        {
          permanent: false,
          direction: 'top',
          offset: [0, -10],
          className: 'custom-tooltip'
        }
      );
      
      // Bind popup for click
      let popupText = `<strong>${adminName}</strong>`;
      if (rawValue !== null) {
        const formattedValue = rawValue % 1 === 0 ? rawValue.toFixed(0) : rawValue.toFixed(2);
        popupText += `<br/>Value: ${formattedValue}`;
        popupText += `<br/>No score available`;
      } else if (magnitudeValueNoScore !== null && selectedLayer.type === 'hazard_event') {
        const formattedMagnitude = magnitudeValueNoScore % 1 === 0 ? magnitudeValueNoScore.toFixed(0) : magnitudeValueNoScore.toFixed(2);
        popupText += `<br/>Magnitude: ${formattedMagnitude}`;
        popupText += `<br/>No score available`;
      } else {
        popupText += `<br/>No data available`;
      }
      layer.bindPopup(popupText);
      
      // Add hover effects
      layer.on({
        mouseover: (e: any) => {
          const hoverLayer = e.target;
          hoverLayer.setStyle({
            weight: 2,
            fillOpacity: 0.6,
            color: '#000000',
            fillColor: '#999999'
          });
        },
        mouseout: (e: any) => {
          const hoverLayer = e.target;
          hoverLayer.setStyle({
            weight: 1,
            fillOpacity: 0.4,
            color: '#000000',
            fillColor: '#999999'
          });
        }
      });
    }
  };

  // Get dataset name helper
  const getDatasetName = (d: any) => {
    return d.dataset_name || d.datasets?.name || `Dataset ${d.dataset_id || d.id}`;
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div style={{ color: 'var(--gsc-gray)' }}>Loading instance data...</div>
        </div>
      </div>
    );
  }

  if (error && !instance) {
    return (
      <div className="p-4">
        <div 
          className="border rounded-lg p-4"
          style={{
            backgroundColor: 'rgba(99, 7, 16, 0.05)',
            borderColor: 'var(--gsc-red)'
          }}
        >
          <h2 
            className="font-semibold mb-2"
            style={{ color: 'var(--gsc-red)' }}
          >
            Error Loading Instance
          </h2>
          <p 
            className="text-sm mb-4"
            style={{ color: 'var(--gsc-gray)' }}
          >
            {error}
          </p>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="btn btn-danger text-sm"
            >
              Try Again
            </button>
            <Link
              href="/instances"
              className="btn btn-secondary text-sm"
            >
              Back to Instances
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ maxWidth: '8.5in', margin: '0 auto' }}>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAffectedAreaModal(true)}
              className="btn btn-secondary text-xs py-1 px-2"
              disabled={!instance}
              title="Edit affected area for this instance"
            >
              Edit Affected Area
            </button>
            <button
              onClick={() => setShowUploadHazardModal(true)}
              className="btn btn-secondary text-xs py-1 px-2"
              disabled={!instance}
              title="Upload hazard event (GeoJSON)"
            >
              Upload Hazard Event
            </button>
            <Link
              href="/instances"
              className="btn btn-secondary text-xs py-1 px-2"
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Panel */}
      <InstanceMetricsPanel refreshKey={metricsRefreshKey} instanceId={instanceId} />

      {/* Main Content */}
      <div className="flex gap-2">
        {/* Map - Sized for letter page */}
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
                <p className="text-sm">Switching to selected dataset...</p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={[12.8797, 121.774]} // Philippines center
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
              {/* Render hazard event layers as overlays - only if visible */}
              {hazardEventLayers
                .filter((layer) => visibleHazardEvents.has(layer.id))
                .map((layer) => {
                  const filter = hazardEventFilters[layer.id] || {};
                  // Filter features based on magnitude range or visible feature IDs
                  const filteredFeatures = (layer.geojson as GeoJSON.FeatureCollection).features.filter((feature: any, idx: number) => {
                    // Check geometry type filter
                    if (filter.geometryTypes && filter.geometryTypes.size > 0) {
                      const geomType = feature?.geometry?.type || '';
                      if (!filter.geometryTypes.has(geomType)) return false;
                    }
                    // Check magnitude range filter
                    if (filter.minMagnitude !== undefined || filter.maxMagnitude !== undefined) {
                      const magnitude = feature?.properties?.[layer.magnitude_field] || feature?.properties?.value;
                      const magValue = Number(magnitude);
                      if (!isNaN(magValue)) {
                        if (filter.minMagnitude !== undefined && magValue < filter.minMagnitude) return false;
                        if (filter.maxMagnitude !== undefined && magValue > filter.maxMagnitude) return false;
                      }
                    }
                    // Check feature ID filter (if specific features are selected)
                    if (filter.visibleFeatureIds && filter.visibleFeatureIds.size > 0) {
                      // Use feature index as ID if no explicit ID exists
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

        {/* Sidebar - Independent of map height */}
        <div className="w-64 space-y-1 flex flex-col">
          {/* Action Buttons */}
          <div className="bg-white border rounded p-1.5 space-y-1">
            <button
              onClick={() => setShowDatasetConfigModal(true)}
              disabled={!instance || refreshing}
              className="btn btn-secondary w-full text-xs py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Configure Datasets
            </button>
            <button
              onClick={() => setShowScoringModal(true)}
              disabled={!instance || refreshing}
              className="btn btn-primary w-full text-xs py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Adjust Scoring
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn w-full text-xs py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: refreshing ? 'var(--gsc-light-gray)' : 'var(--gsc-green)',
                color: refreshing ? 'var(--gsc-gray)' : '#fff'
              }}
            >
              {refreshing ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>

          {/* Score Layers */}
          <div className="bg-white border rounded p-1.5 flex-1 overflow-y-auto">
            <h3 
              className="font-semibold mb-1 text-xs"
              style={{ color: 'var(--gsc-gray)' }}
            >
              Score Layers
            </h3>
            <ScoreLayerSelector
              instanceId={instanceId}
              onSelect={(selection) => {
                setSelectedLayer(selection);
                // If a hazard event is selected, load it for potential scoring
                if (selection.type === 'hazard_event' && selection.hazardEventId) {
                  const event = hazardEvents.find(e => e.id === selection.hazardEventId);
                  if (event) {
                    setSelectedHazardEvent(event);
                  }
                }
              }}
              onScoreHazardEvent={(hazardEventId) => {
                // Find the hazard event and open scoring modal
                const event = hazardEvents.find(e => e.id === hazardEventId);
                if (event) {
                  setSelectedHazardEvent(event);
                  setShowHazardScoringModal(true);
                }
              }}
              visibleHazardEvents={visibleHazardEvents}
              onToggleHazardEventVisibility={(hazardEventId, visible) => {
                setVisibleHazardEvents(prev => {
                  const newSet = new Set(prev);
                  if (visible) {
                    newSet.add(hazardEventId);
                  } else {
                    newSet.delete(hazardEventId);
                  }
                  return newSet;
                });
              }}
            />
            {/* Hazard Event Actions */}
            {selectedHazardEvent && (
              <div className="mt-2 pt-2 border-t space-y-2">
                <button
                  onClick={() => setShowHazardScoringModal(true)}
                  className="btn btn-primary w-full text-xs py-1 px-2"
                  title="Score this hazard event"
                >
                  Score Hazard Event
                </button>
                
                {/* Feature Filter Panel */}
                {(() => {
                  const layer = hazardEventLayers.find(l => l.id === selectedHazardEvent.id);
                  if (!layer || !layer.geojson?.features) return null;
                  
                  const features = layer.geojson.features;
                  const magnitudeField = layer.magnitude_field || 'value';
                  const filter = hazardEventFilters[selectedHazardEvent.id] || {};
                  
                  // Get unique magnitude values for range selection
                  const magnitudes = features
                    .map((f: any) => Number(f?.properties?.[magnitudeField] || f?.properties?.value))
                    .filter((m: number) => !isNaN(m))
                    .sort((a: number, b: number) => a - b);
                  const minMag = magnitudes.length > 0 ? Math.min(...magnitudes) : undefined;
                  const maxMag = magnitudes.length > 0 ? Math.max(...magnitudes) : undefined;
                  
                  // Get unique geometry types
                  const geometryTypes = new Set<string>();
                  features.forEach((f: any) => {
                    const geomType = f?.geometry?.type || '';
                    if (geomType) geometryTypes.add(geomType);
                  });
                  
                  return (
                    <div className="border rounded p-2 bg-gray-50 text-xs">
                      <div className="font-semibold mb-2">Filter Features</div>
                      
                      {/* Geometry Type Filter */}
                      {geometryTypes.size > 1 && (
                        <div className="mb-2 pb-2 border-b">
                          <label className="block text-xs font-medium mb-1">Show Geometry Types:</label>
                          <div className="space-y-1">
                            {Array.from(geometryTypes).map((geomType) => {
                              const isChecked = !filter.geometryTypes || filter.geometryTypes.size === 0 || filter.geometryTypes.has(geomType);
                              return (
                                <label key={geomType} className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setHazardEventFilters(prev => {
                                        const current = prev[selectedHazardEvent.id] || {};
                                        const types = new Set(current.geometryTypes || []);
                                        
                                        if (e.target.checked) {
                                          types.add(geomType);
                                          // If all types are selected, clear the filter (show all)
                                          if (types.size === geometryTypes.size) {
                                            return {
                                              ...prev,
                                              [selectedHazardEvent.id]: {
                                                ...current,
                                                geometryTypes: undefined,
                                              }
                                            };
                                          }
                                        } else {
                                          types.delete(geomType);
                                        }
                                        
                                        return {
                                          ...prev,
                                          [selectedHazardEvent.id]: {
                                            ...current,
                                            geometryTypes: types.size > 0 ? types : new Set(),
                                          }
                                        };
                                      });
                                    }}
                                    className="cursor-pointer"
                                  />
                                  <span className="text-xs">
                                    {geomType === 'LineString' || geomType === 'MultiLineString' ? 'Track (Line)' : 
                                     geomType === 'Polygon' || geomType === 'MultiPolygon' ? 'Cone/Area (Polygon)' : 
                                     geomType}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Quick Filter: Track Only (for typhoons) */}
                      {selectedHazardEvent.event_type === 'typhoon' && geometryTypes.has('LineString') && (
                        <div className="mb-2 pb-2 border-b">
                          <button
                            onClick={() => {
                              setHazardEventFilters(prev => ({
                                ...prev,
                                [selectedHazardEvent.id]: {
                                  ...prev[selectedHazardEvent.id],
                                  geometryTypes: new Set(['LineString', 'MultiLineString']),
                                }
                              }));
                            }}
                            className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded w-full"
                            title="Show only the center track line"
                          >
                            Show Track Only (Hide Cone)
                          </button>
                          <button
                            onClick={() => {
                              setHazardEventFilters(prev => ({
                                ...prev,
                                [selectedHazardEvent.id]: {
                                  ...prev[selectedHazardEvent.id],
                                  geometryTypes: undefined,
                                }
                              }));
                            }}
                            className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded w-full mt-1"
                            title="Show all features"
                          >
                            Show All Features
                          </button>
                        </div>
                      )}
                      
                      {/* Magnitude Range Filter */}
                      {minMag !== undefined && maxMag !== undefined && (
                        <div className="space-y-1 mb-2">
                          <label className="block text-xs font-medium">Magnitude Range:</label>
                          <div className="flex gap-1 items-center">
                            <input
                              type="number"
                              step="0.1"
                              value={filter.minMagnitude ?? minMag}
                              onChange={(e) => {
                                const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                setHazardEventFilters(prev => ({
                                  ...prev,
                                  [selectedHazardEvent.id]: {
                                    ...prev[selectedHazardEvent.id],
                                    minMagnitude: val,
                                  }
                                }));
                              }}
                              className="border rounded px-1 py-0.5 w-16 text-xs"
                              placeholder="Min"
                              min={minMag}
                              max={maxMag}
                            />
                            <span className="text-gray-500">to</span>
                            <input
                              type="number"
                              step="0.1"
                              value={filter.maxMagnitude ?? maxMag}
                              onChange={(e) => {
                                const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                setHazardEventFilters(prev => ({
                                  ...prev,
                                  [selectedHazardEvent.id]: {
                                    ...prev[selectedHazardEvent.id],
                                    maxMagnitude: val,
                                  }
                                }));
                              }}
                              className="border rounded px-1 py-0.5 w-16 text-xs"
                              placeholder="Max"
                              min={minMag}
                              max={maxMag}
                            />
                            <button
                              onClick={() => {
                                setHazardEventFilters(prev => {
                                  const newFilters = { ...prev };
                                  delete newFilters[selectedHazardEvent.id];
                                  return newFilters;
                                });
                              }}
                              className="text-xs px-1 py-0.5 bg-gray-200 hover:bg-gray-300 rounded"
                              title="Clear filters"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            Showing {features.filter((f: any) => {
                              const mag = Number(f?.properties?.[magnitudeField] || f?.properties?.value);
                              if (isNaN(mag)) return true;
                              const min = filter.minMagnitude ?? minMag;
                              const max = filter.maxMagnitude ?? maxMag;
                              return mag >= min && mag <= max;
                            }).length} of {features.length} features
                          </div>
                        </div>
                      )}
                      
                      {/* Feature List (for small datasets) */}
                      {features.length <= 20 && (
                        <div className="mt-2 max-h-32 overflow-y-auto">
                          <div className="font-medium mb-1">Individual Features:</div>
                          {features.map((feature: any, idx: number) => {
                            const featureId = feature?.id || feature?.properties?.id || `feature-${idx}`;
                            const magnitude = feature?.properties?.[magnitudeField] || feature?.properties?.value;
                            const isVisible = !filter.visibleFeatureIds || filter.visibleFeatureIds.size === 0 || filter.visibleFeatureIds.has(featureId);
                            
                            return (
                              <label key={idx} className="flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded">
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={(e) => {
                                    setHazardEventFilters(prev => {
                                      const current = prev[selectedHazardEvent.id] || {};
                                      const visibleIds = new Set(current.visibleFeatureIds || []);
                                      
                                      if (e.target.checked) {
                                        // If this is the first feature being checked, show all by default
                                        if (visibleIds.size === 0) {
                                          // Don't add to set - empty set means all visible
                                          return {
                                            ...prev,
                                            [selectedHazardEvent.id]: {
                                              ...current,
                                              visibleFeatureIds: new Set(), // Empty = all visible
                                            }
                                          };
                                        } else {
                                          visibleIds.add(featureId);
                                        }
                                      } else {
                                        // If unchecking, we need to track which are hidden
                                        // First time: add all others to visible set
                                        if (visibleIds.size === 0) {
                                          features.forEach((f: any, i: number) => {
                                            const fid = f?.id || f?.properties?.id || `feature-${i}`;
                                            if (fid !== featureId) visibleIds.add(fid);
                                          });
                                        } else {
                                          visibleIds.delete(featureId);
                                        }
                                      }
                                      
                                      return {
                                        ...prev,
                                        [selectedHazardEvent.id]: {
                                          ...current,
                                          visibleFeatureIds: visibleIds,
                                        }
                                      };
                                    });
                                  }}
                                  className="cursor-pointer"
                                />
                                <span className="flex-1">
                                  Feature {idx + 1}
                                  {magnitude !== undefined && ` (${magnitude})`}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div 
              className="border rounded-lg p-2"
              style={{
                backgroundColor: 'rgba(211, 84, 0, 0.1)',
                borderColor: 'var(--gsc-orange)'
              }}
            >
              <p 
                className="text-xs"
                style={{ color: 'var(--gsc-orange)' }}
              >
                ⚠️ Some data may be incomplete: {error}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Vulnerable Locations Panel */}
      <div className="mt-4">
        <VulnerableLocationsPanel instanceId={instanceId} refreshKey={metricsRefreshKey} />
      </div>

      {/* Scoring Modal */}
      {showScoringModal && instance && (
        <InstanceScoringModal
          instance={instance}
          onClose={() => setShowScoringModal(false)}
          onSaved={handleScoringSaved}
        />
      )}

      {/* Dataset Configuration Modal */}
      {showDatasetConfigModal && instance && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowDatasetConfigModal(false)}
          onSaved={async () => {
            await fetchData(); // Refresh data after config changes
            // Reload features for current selection
            if (instance && instanceId) {
              const featuresToUse = selectedLayer.type === 'hazard_event' ? undefined : overallFeatures;
              await loadFeaturesForSelection(selectedLayer, featuresToUse);
            }
            setMetricsRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {/* Define Affected Area Modal */}
      {showAffectedAreaModal && instance && (
        <DefineAffectedAreaModal
          instance={instance}
          onClose={() => setShowAffectedAreaModal(false)}
          onSaved={handleAffectedAreaSaved}
        />
      )}

      {/* Upload Hazard Event Modal */}
      {showUploadHazardModal && instance && (
        <UploadHazardEventModal
          instanceId={instanceId}
          onClose={() => setShowUploadHazardModal(false)}
          onUploaded={async () => {
            await fetchData();
            setShowUploadHazardModal(false);
          }}
        />
      )}

      {/* Hazard Event Scoring Modal */}
      {showHazardScoringModal && instance && selectedHazardEvent && (
        <HazardEventScoringModal
          hazardEvent={selectedHazardEvent}
          instance={instance}
          onClose={() => {
            setShowHazardScoringModal(false);
            setSelectedHazardEvent(null);
          }}
          onSaved={async () => {
            await fetchData();
            // Reload features if hazard event is still selected
            if (selectedLayer.type === 'hazard_event' && selectedLayer.hazardEventId === selectedHazardEvent?.id) {
              console.log("Reloading features after scoring applied");
              await loadFeaturesForSelection(selectedLayer);
            }
            // Refresh metrics panel
            setTimeout(() => {
              setMetricsRefreshKey(prev => prev + 1);
            }, 500);
            setShowHazardScoringModal(false);
            setSelectedHazardEvent(null);
          }}
        />
      )}
    </div>
  );
}
