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
        map.fitBounds(bounds, { padding: [20, 20] });
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
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [showDatasetConfigModal, setShowDatasetConfigModal] = useState(false);
  const [showAffectedAreaModal, setShowAffectedAreaModal] = useState(false);
  const [showUploadHazardModal, setShowUploadHazardModal] = useState(false);
  const [showHazardScoringModal, setShowHazardScoringModal] = useState(false);
  const [selectedHazardEvent, setSelectedHazardEvent] = useState<any>(null);
  const [hazardEvents, setHazardEvents] = useState<any[]>([]);
  const [hazardEventLayers, setHazardEventLayers] = useState<any[]>([]);
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

        // Create score map
        const scoreMap = new Map(scores?.map((s: any) => [s.admin_pcode, Number(s.score)]) || []);
        const magnitudeMap = new Map(scores?.map((s: any) => [s.admin_pcode, Number(s.magnitude_value)]) || []);
        console.log(`Loaded ${scores?.length || 0} scores for hazard event ${selection.hazardEventId}`);
        
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
        
        // Map scores to features
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
        
        console.log(`Mapped ${hazardFeatures.length} features with hazard event scores`);
        setFeatures([...hazardFeatures]);
        setLoadingFeatures(false);
      }
    } catch (err) {
      console.error("Error loading features for selection:", err);
      setFeatures([]);
      setLoadingFeatures(false);
    }
  };

  useEffect(() => {
    if (instanceId) {
      fetchData();
    }
  }, [instanceId]);

  // ✅ Load features when selection changes
  useEffect(() => {
    // Only reload if we have instance loaded
    if (!loading && instance && instanceId) {
      console.log("Selection changed, loading features:", selectedLayer);
      loadFeaturesForSelection(selectedLayer, overallFeatures);
      
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
  };

  const handleScoringSaved = async () => {
    setShowScoringModal(false);
    await fetchData(); // Refresh data after scoring changes
  };

  const handleAffectedAreaSaved = async () => {
    setShowAffectedAreaModal(false);
    await fetchData(); // Refresh data after affected area changes
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
      
      // Set initial style with thin black borders
      layer.setStyle({ 
        color: '#000000', // Black border
        fillColor: color, 
        fillOpacity: 0.6,
        weight: 1, // Thin border
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
      
      // Add hover effects
      layer.on({
        mouseover: (e: any) => {
          const hoverLayer = e.target;
          hoverLayer.setStyle({
            weight: 2, // Thicker border on hover
            fillOpacity: 0.8,
            color: '#000000',
            fillColor: color
          });
        },
        mouseout: (e: any) => {
          const hoverLayer = e.target;
          hoverLayer.setStyle({
            weight: 1, // Back to thin border
            fillOpacity: 0.6,
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
      <InstanceMetricsPanel instanceId={instanceId} />

      {/* Main Content */}
      <div className="flex gap-2">
        {/* Map - Sized for letter page */}
        <div className="flex-1 border rounded overflow-hidden bg-white" style={{ height: '400px', minHeight: '400px' }}>
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
              zoom={6}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
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
              {/* Render hazard event layers as overlays */}
              {hazardEventLayers.map((layer) => (
                <GeoJSON
                  key={`hazard-${layer.id}`}
                  data={layer.geojson as GeoJSON.FeatureCollection}
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
              ))}
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
            />
            {/* Hazard Event Actions */}
            {selectedHazardEvent && (
              <div className="mt-2 pt-2 border-t">
                <button
                  onClick={() => setShowHazardScoringModal(true)}
                  className="btn btn-primary w-full text-xs py-1 px-2"
                  title="Score this hazard event"
                >
                  Score Hazard Event
                </button>
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
        <VulnerableLocationsPanel instanceId={instanceId} />
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
            setShowHazardScoringModal(false);
            setSelectedHazardEvent(null);
          }}
        />
      )}
    </div>
  );
}
