'use client';

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";
import { fetchHazardEventScores } from "@/lib/fetchHazardEventScoresClient";
import dynamic from "next/dynamic";
import Link from "next/link";
import ScoreLayerSelector, { LayerOption } from "@/components/ScoreLayerSelector";
import InstanceMetricsPanel from "@/components/InstanceMetricsPanel";
import VulnerableLocationsPanel from "@/components/VulnerableLocationsPanel";
import UploadHazardEventModal from "@/components/UploadHazardEventModal";
import HazardEventScoringModal from "@/components/HazardEventScoringModal";
import ImportHazardEventModal from "@/components/ImportHazardEventModal";
import ExportInstanceButton from "@/components/ExportInstanceButton";

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

// Wrapper component to force GeoJSON updates when data changes
function UpdatingGeoJSON({ data, onEachFeature, mapKey }: { data: GeoJSON.FeatureCollection, onEachFeature: (feature: any, layer: any) => void, mapKey: string }) {
  return <GeoJSON key={mapKey} data={data} onEachFeature={onEachFeature} />;
}

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [overallFeatures, setOverallFeatures] = useState<any[]>([]); // Store overall features for reuse
  const [featuresKey, setFeaturesKey] = useState(0); // Key to force GeoJSON re-render
  const [loading, setLoading] = useState(true);
  const [loadingFeatures, setLoadingFeatures] = useState(false); // Track feature loading separately
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [metricsRefreshKey, setMetricsRefreshKey] = useState(0); // Key to force metrics refresh
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [showDatasetConfigModal, setShowDatasetConfigModal] = useState(false);
  const [showAffectedAreaModal, setShowAffectedAreaModal] = useState(false);
  const [overallScoresMissing, setOverallScoresMissing] = useState(false);
  const [hasDatasetScores, setHasDatasetScores] = useState(false);
  const [showUploadHazardModal, setShowUploadHazardModal] = useState(false);
  const [showHazardScoringModal, setShowHazardScoringModal] = useState(false);
  const [selectedHazardEvent, setSelectedHazardEvent] = useState<any>(null);
  const [hazardEvents, setHazardEvents] = useState<any[]>([]);
  const [hazardEventLayers, setHazardEventLayers] = useState<any[]>([]);
  const [visibleHazardEvents, setVisibleHazardEvents] = useState<Set<string>>(new Set()); // Track which hazard events are visible
  const [hazardEventFilters, setHazardEventFilters] = useState<Record<string, { minMagnitude?: number, maxMagnitude?: number, visibleFeatureIds?: Set<string>, geometryTypes?: Set<string> }>>({}); // Feature-level filters per hazard event
  const [selectedLayer, setSelectedLayer] = useState<{ type: 'overall' | 'priority' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, datasetName?: string, categoryName?: string, hazardEventId?: string }>({ type: 'overall' });
  const [layerOptions, setLayerOptions] = useState<LayerOption[]>([]);
  const [categoryScoreMap, setCategoryScoreMap] = useState<Record<string, number>>({});
  const [showImportHazardModal, setShowImportHazardModal] = useState(false);
  const [mapDataDiagnostics, setMapDataDiagnostics] = useState<{ issue?: string, hasAdminScope?: boolean, hasGeometry?: boolean } | null>(null);

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
      let currentLayerOptions: LayerOption[] = [];
      
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
        console.error("❌ Error fetching instance data:", directError);
        if (directError) {
          setError(`Failed to load instance: ${directError.message || 'Unknown error'}`);
        }
        // Last resort: create minimal instance object with just the ID
        instanceData = { id: instanceId, name: `Instance ${instanceId}` };
      }
      setInstance(instanceData);

      // Fetch datasets - try view first, then fallback
      let dsData: any[] = [];
      let datasetMapById = new Map<string, { name: string; category: string }>();
      try {
        const { data, error: dsError } = await supabase
          .from("v_instance_datasets_view")
          .select("*")
          .eq("instance_id", instanceId);

        if (!dsError && data) {
          dsData = (data || []).map((row: any) => {
            const datasetId = row.dataset_id || row.id || row.datasetId;
            const datasetName = row.dataset_name || row.name || row.datasets?.name || `Dataset ${datasetId}`;
            const datasetCategory = row.dataset_category || row.category || row.datasets?.category || 'Uncategorized';

            if (datasetId) {
              datasetMapById.set(datasetId, { name: datasetName, category: datasetCategory });
            }

            return {
              dataset_id: datasetId,
              dataset_name: datasetName,
              dataset_type: row.dataset_type || row.type || row.datasets?.type || 'numeric',
              dataset_category: datasetCategory,
            };
          });
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

            dsData = fallbackData.map((d: any) => {
              const datasetCategory = d.datasets?.category || configMap.get(d.dataset_id)?.category || 'Uncategorized';
              const datasetName = d.datasets?.name || `Dataset ${d.dataset_id}`;

              if (d.dataset_id) {
                datasetMapById.set(d.dataset_id, { name: datasetName, category: datasetCategory });
              }

              return {
                id: d.id,
                dataset_id: d.dataset_id,
                dataset_name: datasetName,
                dataset_type: d.datasets?.type || 'numeric',
                dataset_category: datasetCategory,
                score_config: configMap.get(d.dataset_id) || null,
              };
            });
          }
        }
      } catch (e) {
        console.warn("Error fetching datasets:", e);
      }
      setDatasets(dsData);

      // Compute dataset averages & category scores for layer selector
      const datasetCategoryMap = new Map<string, string>();
      dsData.forEach((d: any) => {
        if (d.dataset_id) {
          datasetCategoryMap.set(d.dataset_id, d.dataset_category || datasetMapById.get(d.dataset_id)?.category || 'Uncategorized');
        }
      });

      const { data: datasetScoreRows } = await supabase
        .from("instance_dataset_scores")
        .select("dataset_id, score")
        .eq("instance_id", instanceId);

      const datasetTotals = new Map<string, { sum: number; count: number }>();
      const categoryTotals = new Map<string, { sum: number; count: number }>();

      (datasetScoreRows || []).forEach((row: any) => {
        if (!row?.dataset_id) return;
        const score = Number(row.score);
        if (Number.isNaN(score)) return;
        const dId = row.dataset_id;
        const cat = datasetCategoryMap.get(dId) || 'Uncategorized';

        if (!datasetTotals.has(dId)) datasetTotals.set(dId, { sum: 0, count: 0 });
        const dt = datasetTotals.get(dId)!;
        dt.sum += score;
        dt.count += 1;

        if (!categoryTotals.has(cat)) categoryTotals.set(cat, { sum: 0, count: 0 });
        const ct = categoryTotals.get(cat)!;
        ct.sum += score;
        ct.count += 1;
      });

      const datasetLayers = dsData.map((d: any) => {
        const stats = datasetTotals.get(d.dataset_id);
        const info = d.dataset_id ? datasetMapById.get(d.dataset_id) : null;
        return {
          dataset_id: d.dataset_id,
          dataset_name: info?.name || d.dataset_name,
          type: d.dataset_type || 'numeric',
          category: info?.category || d.dataset_category || 'Uncategorized',
          avg_score: stats ? stats.sum / stats.count : null,
        } as LayerOption;
      });
      currentLayerOptions = [...datasetLayers];

      const categoryScoreObj: Record<string, number> = {};
      categoryTotals.forEach((value, key) => {
        if (value.count > 0) {
          categoryScoreObj[key] = value.sum / value.count;
        }
      });
      setCategoryScoreMap(categoryScoreObj);

      // Load hazard events for this instance
      const { data: hazardEventsData, error: hazardError } = await supabase
        .rpc('get_hazard_events_for_instance', { in_instance_id: instanceId });
      
      if (!hazardError && hazardEventsData) {
        setHazardEvents(hazardEventsData);
        setVisibleHazardEvents(new Set(hazardEventsData.map((event: any) => event.id)));
        
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

        // Compute hazard event averages for display
        let hazardEventAvgScores: Record<string, number> = {};
        const hazardEventIds = hazardEventsData.map((event: any) => event.id);
        if (hazardEventIds.length > 0) {
          try {
            const hazardScoreRows = await fetchHazardEventScores({
              instanceId,
              hazardEventIds,
            });
            const hazardTotals = new Map<string, { sum: number; count: number }>();
            hazardScoreRows.forEach((row: any) => {
              const score = Number(row.score);
              if (Number.isNaN(score) || !row.hazard_event_id) return;
              if (!hazardTotals.has(row.hazard_event_id)) {
                hazardTotals.set(row.hazard_event_id, { sum: 0, count: 0 });
              }
              const agg = hazardTotals.get(row.hazard_event_id)!;
              agg.sum += score;
              agg.count += 1;
            });
            hazardTotals.forEach((value, key) => {
              if (value.count > 0) {
                hazardEventAvgScores[key] = value.sum / value.count;
              }
            });
          } catch (error) {
            console.error("Error loading hazard event scores via API:", error);
          }
        }

        const hazardLayerOptions: LayerOption[] = hazardEventsData.map((event: any) => ({
          dataset_id: `hazard_event_${event.id}`,
          dataset_name: event.name,
          type: 'numeric',
          category: 'Hazard',
          avg_score: hazardEventAvgScores[event.id] ?? null,
          is_hazard_event: true,
          hazard_event_id: event.id,
        }));

        currentLayerOptions = [...currentLayerOptions, ...hazardLayerOptions];
      }
      setLayerOptions(currentLayerOptions);

      // Load overall instance scores for initial view
      let parsed: any[] = [];
      try {
        console.log("Loading overall scores for initial view");
        
        // First, get all available admin_pcodes with geometry from geojson view (with pagination)
        // Use 1000 as chunk size to match Supabase's default limit
        const CHUNK_SIZE = 1000;
        let geoRows: any[] = [];
        let offset = 0;
        let hasMore = true;
        let consecutiveEmptyChunks = 0;
        let viewErrorOccurred = false;

        while (hasMore) {
          try {
            const { data: chunk, error: geoError } = await supabase
              .from("v_instance_admin_scores_geojson")
              .select("admin_pcode, geojson")
              .eq("instance_id", instanceId)
              .range(offset, offset + CHUNK_SIZE - 1);

            if (geoError) {
              console.error("❌ Error loading GeoJSON chunk:", geoError);
              console.error("Error details:", {
                message: geoError.message,
                details: geoError.details,
                hint: geoError.hint,
                code: geoError.code,
                instanceId: instanceId,
                offset: offset
              });
              
              // If it's a view/table error, try to diagnose
              if (geoError.code === '42P01' || geoError.message?.includes('does not exist')) {
                console.error("⚠️ The v_instance_admin_scores_geojson view may not exist or may have an error");
              }
              
              // If this is the first error, try fallback approach
              if (!viewErrorOccurred && offset === 0) {
                viewErrorOccurred = true;
                console.warn("⚠️ View query failed, will try fallback approach after diagnostics");
              }
              
              setError(`Failed to load map data: ${geoError.message || 'Unknown error'}`);
              hasMore = false;
              break;
            }

          if (!chunk || chunk.length === 0) {
            consecutiveEmptyChunks++;
            // Stop if we get 2 consecutive empty chunks (safety check)
            if (consecutiveEmptyChunks >= 2) {
              console.log("Got consecutive empty chunks, stopping pagination");
              hasMore = false;
              break;
            }
            // Still increment offset to continue searching
            offset += CHUNK_SIZE;
            continue;
          }

            consecutiveEmptyChunks = 0; // Reset counter on successful fetch
            geoRows = geoRows.concat(chunk);
            console.log(`Fetched GeoJSON chunk: ${chunk.length} rows (offset: ${offset}, total so far: ${geoRows.length})`);

            // Continue if we got a full chunk (might be more data)
            // Stop if we got fewer rows than requested (we've reached the end)
            if (chunk.length < CHUNK_SIZE) {
              console.log(`Got ${chunk.length} rows (less than ${CHUNK_SIZE}), stopping pagination`);
              hasMore = false;
            } else {
              offset += chunk.length; // Use actual length to handle edge cases
              console.log(`Got full chunk, continuing to offset ${offset}`);
            }
          } catch (queryError: any) {
            console.error("❌ Exception during GeoJSON query:", queryError);
            setError(`Failed to load map data: ${queryError.message || 'Query error'}`);
            hasMore = false;
            break;
          }
        }

        if (geoRows.length === 0) {
          console.warn("No geometry found for instance");
          
          // Run diagnostics to understand why
          try {
            const { data: diagnostics, error: diagError } = await supabase.rpc('diagnose_map_data', {
              in_instance_id: instanceId
            });
            
            if (!diagError && diagnostics && Array.isArray(diagnostics)) {
              const diagMap = new Map(diagnostics.map((d: any) => [d.check_type, d]));
              
              // Log all diagnostic results for debugging
              console.group("🔍 Map Data Diagnostics");
              diagnostics.forEach((d: any) => {
                console.log(`${d.check_type}: ${d.count_value} - ${d.message}`);
              });
              console.groupEnd();
              
              const hasAdminScope = instanceData?.admin_scope && Array.isArray(instanceData.admin_scope) && instanceData.admin_scope.length > 0;
              const affectedCount = diagMap.get('Affected ADM3 Areas')?.count_value || 0;
              const geometryCount = diagMap.get('Areas with Geometry')?.count_value || 0;
              const viewRows = diagMap.get('GeoJSON View Rows')?.count_value || 0;
              
              let issue = '';
              if (!hasAdminScope) {
                issue = 'no_admin_scope';
                console.warn("❌ Issue: Instance has no admin_scope (affected area) defined");
              } else if (affectedCount === 0) {
                issue = 'no_affected_areas';
                console.warn("❌ Issue: No ADM3 areas found matching the admin_scope");
              } else if (geometryCount === 0) {
                issue = 'no_geometry';
                console.warn("❌ Issue: Affected areas exist but have no geometry data in admin_boundaries");
              } else if (viewRows === 0) {
                issue = 'view_issue';
                console.warn("❌ Issue: Geometry exists but view returns no rows (possible view/join issue)");
              } else {
                issue = 'unknown';
                console.warn("⚠️ Issue: Unknown - geometry and view exist but map still not showing");
              }
              
              setMapDataDiagnostics({
                issue,
                hasAdminScope: hasAdminScope || false,
                hasGeometry: geometryCount > 0
              });
              
              console.warn("📊 Summary:", {
                hasAdminScope,
                affectedCount,
                geometryCount,
                viewRows,
                issue
              });
            } else if (diagError) {
              console.error("❌ Diagnostic function error:", diagError);
            }
          } catch (diagErr) {
            console.error("Error running diagnostics:", diagErr);
            // Fallback: check basic conditions
            const hasAdminScope = instanceData?.admin_scope && Array.isArray(instanceData.admin_scope) && instanceData.admin_scope.length > 0;
            setMapDataDiagnostics({
              issue: hasAdminScope ? 'unknown' : 'no_admin_scope',
              hasAdminScope: hasAdminScope || false,
              hasGeometry: undefined
            });
          }
        } else {
          // Clear diagnostics if we have data
          setMapDataDiagnostics(null);
          console.log(`Found ${geoRows.length} locations with geometry (loaded via pagination)`);
          
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
            
            // Diagnostic: Check if Overall scores exist at all for this instance
            if (allScores.length === 0 && adminPcodesWithGeometry.length > 0) {
              const { data: overallCheck, error: checkError } = await supabase
                .from("instance_category_scores")
                .select("admin_pcode, score")
                .eq("instance_id", instanceId)
                .eq("category", "Overall")
                .limit(5);
              
              if (checkError) {
                console.error("Error checking for Overall scores:", checkError);
              } else if (!overallCheck || overallCheck.length === 0) {
                setOverallScoresMissing(true);
                console.warn("⚠️ No Overall scores found in instance_category_scores for this instance.");
                console.warn("💡 SOLUTION: Go to 'Adjust Scoring' → Click 'Compute Final Rollup' to generate Overall scores.");
                
                // Also check if dataset scores exist
                const { data: datasetScoresCheck } = await supabase
                  .from("instance_dataset_scores")
                  .select("admin_pcode")
                  .eq("instance_id", instanceId)
                  .limit(1);
                
                if (datasetScoresCheck && datasetScoresCheck.length > 0) {
                  setHasDatasetScores(true);
                  console.warn("✓ Dataset scores exist, but Overall scores are missing. Run 'Compute Final Rollup'.");
                } else {
                  setHasDatasetScores(false);
                  console.warn("⚠️ No dataset scores found either. Apply scoring to datasets first, then compute rollups.");
                }
              } else {
                setOverallScoresMissing(false);
                console.warn(`Found ${overallCheck.length} Overall scores in database, but they don't match the ${adminPcodesWithGeometry.length} locations with geometry.`);
                console.warn("This might indicate an admin_pcode mismatch or scope issue.");
              }
            } else {
              setOverallScoresMissing(false);
            }

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
  // Helper function to filter features by admin_scope
  // Accepts admin_scope as parameter to use fresh data
  const filterFeaturesByAdminScope = async (features: any[], adminScope?: string[]): Promise<any[]> => {
    // Use provided adminScope or fall back to instance state
    const scopeToUse = adminScope || instance?.admin_scope;
    
    if (!scopeToUse || !Array.isArray(scopeToUse) || scopeToUse.length === 0) {
      console.log('No admin_scope defined, returning all features');
      return features; // No filtering if no admin_scope defined
    }
    
    console.log(`Filtering features by admin_scope: ${scopeToUse.length} ADM2 codes`);
    
    // Get valid ADM3 codes within the scope using pagination
    const CHUNK_SIZE = 2000;
    let allAdm3Codes: any[] = [];
    let offset = 0;
    let totalCount: number | null = null;
    let hasMore = true;

    while (hasMore) {
      const { data: affectedAdm3, error: adm3Error } = await supabase.rpc('get_affected_adm3', {
        in_scope: scopeToUse,
        in_limit: CHUNK_SIZE,
        in_offset: offset,
      });

      if (adm3Error) {
        console.error('Error getting affected ADM3 codes:', adm3Error);
        return features; // Return all if we can't get valid codes
      }

      if (!affectedAdm3 || affectedAdm3.length === 0) {
        hasMore = false;
        break;
      }

      // Get total count from first response
      if (totalCount === null && affectedAdm3.length > 0) {
        totalCount = affectedAdm3[0].total_count || affectedAdm3.length;
        console.log(`Total ADM3 codes available: ${totalCount}`);
      }

      allAdm3Codes = allAdm3Codes.concat(affectedAdm3);
      console.log(`Fetched chunk: ${affectedAdm3.length} ADM3 codes (offset: ${offset}, total so far: ${allAdm3Codes.length})`);

      // Check if we've fetched all data
      if (totalCount !== null && allAdm3Codes.length >= totalCount) {
        console.log(`✓ Reached total count: ${allAdm3Codes.length} >= ${totalCount}`);
        hasMore = false;
      } else if (affectedAdm3.length === 0) {
        console.log(`✓ Got 0 rows, stopping`);
        hasMore = false;
      } else if (totalCount !== null && allAdm3Codes.length < totalCount) {
        offset += affectedAdm3.length;
        console.log(`→ Continuing: ${allAdm3Codes.length} < ${totalCount}, next offset=${offset}`);
      } else if (affectedAdm3.length >= CHUNK_SIZE) {
        offset += affectedAdm3.length;
        console.log(`→ Got full chunk (${affectedAdm3.length}), continuing, next offset=${offset}`);
      } else {
        console.log(`✓ Got fewer rows than requested (${affectedAdm3.length} < ${CHUNK_SIZE}) and no totalCount, stopping`);
        hasMore = false;
      }
    }

    if (allAdm3Codes.length === 0) {
      console.warn('No affected ADM3 codes returned after pagination');
      return features; // Return all if we can't get valid codes
    }

    const validAdm3Codes = new Set(allAdm3Codes.map((row: any) => 
      typeof row === 'string' ? row : (row.admin_pcode || row.pcode || row.code)
    ).filter(Boolean));
    
    console.log(`Found ${validAdm3Codes.size} valid ADM3 codes within scope (loaded via pagination)`);
    
    const filtered = features.filter((f: any) => 
      validAdm3Codes.has(f.properties?.admin_pcode)
    );
    
    if (filtered.length !== features.length) {
      console.log(`Filtered features by admin_scope: ${features.length} -> ${filtered.length}`);
    }
    
    // Safety: if filtering removes all or an unexpectedly large share, fall back
    const removedAll = filtered.length === 0 && features.length > 0;
    const removedTooMany = features.length > 50 && filtered.length < features.length * 0.6;
    if (removedAll || removedTooMany) {
      console.warn(
        `Admin scope filtering removed too many features (${features.length} -> ${filtered.length}); returning unfiltered features to avoid gaps.`
      );
      return features;
    }
    
    return filtered;
  };

  const loadFeaturesForSelection = async (
    selection: { type: 'overall' | 'priority' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, categoryName?: string, hazardEventId?: string },
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
      
      if (selection.type === 'overall' || selection.type === 'priority') {
        // Use overall or priority instance scores
        const scoreCategory = selection.type === 'priority' ? 'Priority' : 'Overall';
        
        if (selection.type === 'overall' && overallFeatures) {
          console.log("Using cached overall features:", overallFeatures.length);
          setFeatures(overallFeatures);
          setLoadingFeatures(false);
          return;
        }
        
        console.log(`Loading ${scoreCategory.toLowerCase()} scores from instance_category_scores`);
        
        // First, get all available admin_pcodes with geometry from geojson view (with pagination)
        // Use 1000 as chunk size to match Supabase's default limit
        const CHUNK_SIZE = 1000;
        let geoRows: any[] = [];
        let offset = 0;
        let hasMore = true;
        let consecutiveEmptyChunks = 0;

        while (hasMore) {
          const { data: chunk, error: geoError } = await supabase
            .from("v_instance_admin_scores_geojson")
            .select("admin_pcode, geojson")
            .eq("instance_id", instanceId)
            .range(offset, offset + CHUNK_SIZE - 1);

          if (geoError) {
            console.error("Error fetching GeoJSON chunk:", geoError);
            setFeatures([]);
            setLoadingFeatures(false);
            return;
          }

          if (!chunk || chunk.length === 0) {
            consecutiveEmptyChunks++;
            if (consecutiveEmptyChunks >= 2) {
              console.log("Got consecutive empty chunks, stopping pagination");
              hasMore = false;
              break;
            }
            offset += CHUNK_SIZE;
            continue;
          }

          consecutiveEmptyChunks = 0;
          geoRows = geoRows.concat(chunk);
          console.log(`Fetched GeoJSON chunk: ${chunk.length} rows (offset: ${offset}, total so far: ${geoRows.length})`);

          if (chunk.length < CHUNK_SIZE) {
            console.log(`Got ${chunk.length} rows (less than ${CHUNK_SIZE}), stopping pagination`);
            hasMore = false;
          } else {
            offset += chunk.length;
            console.log(`Got full chunk, continuing to offset ${offset}`);
          }
        }

        if (geoRows.length === 0) {
          console.log("No geometry found for instance");
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }

        console.log(`Found ${geoRows.length} locations with geometry (loaded via pagination)`);

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
          // For Priority, query instance_category_scores directly
          // For Overall, use the view (which is faster)
          if (selection.type === 'priority') {
            const { data: scores, error: scoresError } = await supabase
              .from("instance_category_scores")
              .select("admin_pcode, score")
              .eq("instance_id", instanceId)
              .eq("category", "Priority")
              .in("admin_pcode", chunk);
            
            if (scoresError) {
              console.error("Error fetching priority scores:", scoresError);
              setFeatures([]);
              setLoadingFeatures(false);
              return;
            } else if (scores) {
              // Get names from admin_boundaries
              const pcodes = scores.map((s: any) => s.admin_pcode);
              const { data: boundaries } = await supabase
                .from("admin_boundaries")
                .select("admin_pcode, name")
                .eq("admin_level", "ADM3")
                .in("admin_pcode", pcodes);
              
              const nameMap = new Map((boundaries || []).map((b: any) => [b.admin_pcode, b.name]));
              allScores = [...allScores, ...scores.map((s: any) => ({
                admin_pcode: s.admin_pcode,
                name: nameMap.get(s.admin_pcode) || s.admin_pcode,
                avg_score: s.score
              }))];
            }
          } else {
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
        }
        
        console.log(`Loaded ${allScores.length} ${scoreCategory.toLowerCase()} scores for locations with geometry`);
        
        // Debug: Log priority scores if they exist
        if (selection.type === 'priority') {
          if (allScores.length === 0) {
            console.warn('⚠️ No priority scores found! Make sure you have computed priority ranking first.');
            console.warn('💡 Go to "Adjust Scoring" → Click "Compute Priority Ranking" button');
          } else {
            console.log(`✅ Found ${allScores.length} priority scores. Sample:`, allScores.slice(0, 5).map((s: any) => ({ pcode: s.admin_pcode, score: s.avg_score })));
          }
        }
        
        // Debug: Check for Cebu-related admin_pcodes (only for overall, not priority)
        if (selection.type === 'overall') {
          const cebuPcodes = adminPcodesWithGeometry.filter(pcode => {
            const feature = geoMap.get(pcode);
            const name = feature?.properties?.name?.toLowerCase() || '';
            return pcode.toLowerCase().includes('cebu') || name.includes('cebu');
          });
          if (cebuPcodes.length > 0) {
            console.log(`🔍 Found ${cebuPcodes.length} Cebu-related admin_pcodes with geometry:`, cebuPcodes);
            const cebuScores = allScores.filter(s => cebuPcodes.includes(s.admin_pcode));
            console.log(`🔍 Found ${cebuScores.length} Cebu-related overall scores:`, cebuScores.map(s => ({ pcode: s.admin_pcode, score: s.avg_score })));
            
            // Check if Cebu has hazard scores
            if (cebuPcodes.length > 0) {
              const { data: cebuHazardScores } = await supabase
                .from('hazard_event_scores')
                .select('admin_pcode, score, hazard_event_id')
                .eq('instance_id', instanceId)
                .in('admin_pcode', cebuPcodes);
              console.log(`🔍 Found ${cebuHazardScores?.length || 0} Cebu-related hazard event scores:`, cebuHazardScores);
              
              // Check if Cebu has Hazard category scores
              const { data: cebuCategoryScores } = await supabase
                .from('instance_category_scores')
                .select('admin_pcode, score, category')
                .eq('instance_id', instanceId)
                .in('admin_pcode', cebuPcodes)
                .in('category', ['Hazard', 'Overall']);
              console.log(`🔍 Found ${cebuCategoryScores?.length || 0} Cebu-related category scores:`, cebuCategoryScores);
              
              // Diagnostic: If hazard scores exist but no overall scores, suggest recomputing
              if (cebuHazardScores && cebuHazardScores.length > 0 && cebuScores.length === 0) {
                console.warn('⚠️ DIAGNOSIS: Cebu has hazard event scores but no overall scores!');
                console.warn('💡 SOLUTION: Go to "Adjust Scoring" → "Compute Framework Rollup" → "Compute Final Rollup" to aggregate hazard scores into overall scores.');
              } else if (cebuScores.length === 0 && cebuPcodes.length > 0) {
                console.warn('⚠️ DIAGNOSIS: Cebu areas found but no scores at all!');
                console.warn('💡 SOLUTION: Make sure the hazard event is scored, then recompute overall scores via "Adjust Scoring".');
              }
            }
          } else {
            console.warn('⚠️ No Cebu-related admin_pcodes found in geometry! Checking all admin_pcodes...');
            // Check if any admin_pcodes contain 'cebu' in the name
            const allCebuNames = Array.from(geoMap.entries()).filter(([pcode, feature]) => {
              const name = feature?.properties?.name?.toLowerCase() || '';
              return name.includes('cebu');
            });
            console.log(`🔍 Found ${allCebuNames.length} features with 'cebu' in name:`, allCebuNames.map(([pcode, f]) => ({ pcode, name: f.properties?.name })));
          }
        }

        // Create score map
        const scoreMap = new Map(allScores.map((s: any) => [s.admin_pcode, Number(s.avg_score)]));

        // Combine scores with geometry - include ALL features even if they don't have scores
        // This ensures areas like Cebu appear on the map even if scores are missing
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
        
        const featuresWithScores = features.filter((f: any) => f.properties.has_score).length;
        const featuresWithoutScores = features.filter((f: any) => !f.properties.has_score).length;
        console.log(`Created ${features.length} features with ${scoreCategory.toLowerCase()} scores (${featuresWithScores} with scores, ${featuresWithoutScores} without scores)`);
        
        // Warn if no scores found for priority
        if (selection.type === 'priority' && featuresWithScores === 0) {
          console.error('❌ No priority scores found in features! This means priority ranking has not been computed yet.');
          console.error('💡 SOLUTION: Go to "Adjust Scoring" → Click "Compute Priority Ranking" button');
        }
        
        // Filter by admin_scope if instance has one defined - use fresh instance state
        const currentAdminScope = instance?.admin_scope;
        console.log(`Filtering by admin_scope:`, currentAdminScope?.length || 0, 'ADM2 codes');
        const filteredFeatures = await filterFeaturesByAdminScope(features, currentAdminScope);
        console.log(`After filtering by admin_scope: ${filteredFeatures.length} features (from ${features.length})`);
        
        // Debug: Check if Cebu features survived filtering (only for overall, not priority)
        if (selection.type === 'overall') {
          const cebuAfterFilter = filteredFeatures.filter((f: any) => 
            f.properties.admin_pcode?.toLowerCase().includes('cebu') || 
            f.properties.admin_name?.toLowerCase().includes('cebu')
          );
          if (cebuAfterFilter.length > 0) {
            console.log(`Cebu features after filtering: ${cebuAfterFilter.length}`, cebuAfterFilter.map((f: any) => ({ pcode: f.properties.admin_pcode, name: f.properties.admin_name, has_score: f.properties.has_score })));
          } else {
            // Check if there were any Cebu features before filtering
            const cebuBeforeFilter = features.filter((f: any) => 
              f.properties.admin_pcode?.toLowerCase().includes('cebu') || 
              f.properties.admin_name?.toLowerCase().includes('cebu')
            );
            if (cebuBeforeFilter.length > 0) {
              console.error('Cebu features were filtered out! This suggests an admin_scope mismatch.');
            }
          }
        }
        
        setFeatures(filteredFeatures);
        // Only cache overall features, not priority (priority can change when overall changes)
        if (selection.type === 'overall') {
          setOverallFeatures(filteredFeatures); // Cache for future use
        }
        setFeaturesKey(prev => {
          const newKey = prev + 1;
          console.log(`Incrementing featuresKey to ${newKey} for ${scoreCategory.toLowerCase()} map refresh`);
          return newKey;
        }); // Force GeoJSON re-render
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

        // Get geometry from view - each row is a single Feature (not FeatureCollection) (with pagination)
        // Use 1000 as chunk size to match Supabase's default limit
        const CHUNK_SIZE = 1000;
        let geoRows: any[] = [];
        let offset = 0;
        let hasMore = true;
        let consecutiveEmptyChunks = 0;

        while (hasMore) {
          const { data: chunk, error: geoError } = await supabase
            .from("v_instance_admin_scores_geojson")
            .select("admin_pcode, geojson")
            .eq("instance_id", instanceId)
            .range(offset, offset + CHUNK_SIZE - 1);

          if (geoError) {
            console.error("Error fetching GeoJSON chunk:", geoError);
            setFeatures([]);
            setLoadingFeatures(false);
            return;
          }

          if (!chunk || chunk.length === 0) {
            consecutiveEmptyChunks++;
            if (consecutiveEmptyChunks >= 2) {
              console.log("Got consecutive empty chunks, stopping pagination");
              hasMore = false;
              break;
            }
            offset += CHUNK_SIZE;
            continue;
          }

          consecutiveEmptyChunks = 0;
          geoRows = geoRows.concat(chunk);
          console.log(`Fetched GeoJSON chunk: ${chunk.length} rows (offset: ${offset}, total so far: ${geoRows.length})`);

          if (chunk.length < CHUNK_SIZE) {
            console.log(`Got ${chunk.length} rows (less than ${CHUNK_SIZE}), stopping pagination`);
            hasMore = false;
          } else {
            offset += chunk.length;
            console.log(`Got full chunk, continuing to offset ${offset}`);
          }
        }

        if (geoRows.length === 0) {
          console.log("No GeoJSON features found for instance");
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        console.log(`Loaded ${geoRows.length} GeoJSON features from view (loaded via pagination)`);
        
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
        
        // Filter by admin_scope if instance has one defined - use fresh instance state
        const currentAdminScope = instance?.admin_scope;
        const filteredFeatures = await filterFeaturesByAdminScope(allFeatures, currentAdminScope);
        
        // Force a new array reference to ensure React detects the change
        setFeatures([...filteredFeatures]);
        setFeaturesKey(prev => {
          const newKey = prev + 1;
          console.log(`Incrementing featuresKey to ${newKey} for dataset map refresh`);
          return newKey;
        }); // Force GeoJSON re-render
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
        
        // Get geometry from view (with pagination)
        // Use 1000 as chunk size to match Supabase's default limit
        const CHUNK_SIZE = 1000;
        let geoRows: any[] = [];
        let offset = 0;
        let hasMore = true;
        let consecutiveEmptyChunks = 0;

        while (hasMore) {
          const { data: chunk, error: geoError } = await supabase
            .from("v_instance_admin_scores_geojson")
            .select("admin_pcode, geojson")
            .eq("instance_id", instanceId)
            .range(offset, offset + CHUNK_SIZE - 1);

          if (geoError) {
            console.error("Error fetching GeoJSON chunk:", geoError);
            setFeatures([]);
            setLoadingFeatures(false);
            return;
          }

          if (!chunk || chunk.length === 0) {
            consecutiveEmptyChunks++;
            if (consecutiveEmptyChunks >= 2) {
              console.log("Got consecutive empty chunks, stopping pagination");
              hasMore = false;
              break;
            }
            offset += CHUNK_SIZE;
            continue;
          }

          consecutiveEmptyChunks = 0;
          geoRows = geoRows.concat(chunk);
          console.log(`Fetched GeoJSON chunk: ${chunk.length} rows (offset: ${offset}, total so far: ${geoRows.length})`);

          if (chunk.length < CHUNK_SIZE) {
            console.log(`Got ${chunk.length} rows (less than ${CHUNK_SIZE}), stopping pagination`);
            hasMore = false;
          } else {
            offset += chunk.length;
            console.log(`Got full chunk, continuing to offset ${offset}`);
          }
        }

        if (geoRows.length === 0) {
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
        
        // Filter by admin_scope if instance has one defined - use fresh instance state
        const currentAdminScope = instance?.admin_scope;
        const filteredFeatures = await filterFeaturesByAdminScope(categoryFeatures, currentAdminScope);
        
        setFeatures([...filteredFeatures]);
        setFeaturesKey(prev => {
          const newKey = prev + 1;
          console.log(`Incrementing featuresKey to ${newKey} for category map refresh`);
          return newKey;
        }); // Force GeoJSON re-render
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
        
        // Fetch geometry using RPC function that returns GeoJSON with admin_pcode in properties
        // Try ADM3 first, then ADM2 if needed
        let geoData: any = null;
        let geoFeatures: any[] = [];
        
        // Get country_id from instance for filtering
        const countryId = instance?.country_id;
        
        // Try ADM3 first
        const { data: adm3Geo, error: adm3Error } = await supabase.rpc('get_admin_boundaries_geojson', {
          admin_pcodes: adminPcodes,
          admin_level: 'ADM3',
          country_id: countryId,
        });
        
        if (!adm3Error && adm3Geo) {
          if (typeof adm3Geo === 'string') {
            geoData = JSON.parse(adm3Geo);
          } else {
            geoData = adm3Geo;
          }
          
          if (geoData?.type === 'FeatureCollection' && Array.isArray(geoData.features)) {
            geoFeatures = geoData.features;
            console.log(`Fetched ${geoFeatures.length} ADM3 features via RPC for hazard scores`);
          }
        }
        
        // If no ADM3 matches, try ADM2
        if (geoFeatures.length === 0) {
          console.log("No ADM3 geometry found, trying ADM2");
          const { data: adm2Geo, error: adm2Error } = await supabase.rpc('get_admin_boundaries_geojson', {
            admin_pcodes: adminPcodes,
            admin_level: 'ADM2',
            country_id: countryId,
          });
          
          if (!adm2Error && adm2Geo) {
            if (typeof adm2Geo === 'string') {
              geoData = JSON.parse(adm2Geo);
            } else {
              geoData = adm2Geo;
            }
            
            if (geoData?.type === 'FeatureCollection' && Array.isArray(geoData.features)) {
              geoFeatures = geoData.features;
              console.log(`Fetched ${geoFeatures.length} ADM2 features via RPC for hazard scores`);
            }
          }
        }
        
        // Fallback: Use view if RPC didn't work
        if (geoFeatures.length === 0) {
          console.warn("RPC didn't return features, falling back to view");
          const CHUNK_SIZE = 1000;
          let geoRows: any[] = [];
          let offset = 0;
          let hasMore = true;
          let consecutiveEmptyChunks = 0;
          const adminPcodeSet = new Set(adminPcodes);

          while (hasMore) {
            const { data: chunk, error: geoViewError } = await supabase
              .from("v_instance_admin_scores_geojson")
              .select("admin_pcode, geojson")
              .eq("instance_id", instanceId)
              .range(offset, offset + CHUNK_SIZE - 1);
            
            if (geoViewError) {
              console.error("Error fetching GeoJSON chunk from view:", geoViewError);
              hasMore = false;
              break;
            }

            if (!chunk || chunk.length === 0) {
              consecutiveEmptyChunks++;
              if (consecutiveEmptyChunks >= 2) {
                hasMore = false;
                break;
              }
              offset += CHUNK_SIZE;
              continue;
            }

            consecutiveEmptyChunks = 0;
            const filteredChunk = chunk.filter((row: any) => adminPcodeSet.has(row.admin_pcode));
            geoRows = geoRows.concat(filteredChunk);

            if (chunk.length < CHUNK_SIZE) {
              hasMore = false;
            } else {
              offset += chunk.length;
            }
          }
          
          if (geoRows && geoRows.length > 0) {
            geoFeatures = geoRows.map((r: any) => {
              const feature = typeof r.geojson === 'string' ? JSON.parse(r.geojson) : r.geojson;
              // Ensure admin_pcode is in properties
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  admin_pcode: r.admin_pcode,
                }
              };
            });
            console.log(`Fetched ${geoFeatures.length} features from view fallback`);
          }
        }
        
        if (geoFeatures.length === 0) {
          console.log("No GeoJSON features found for admin areas with scores");
          setFeatures([]);
          setLoadingFeatures(false);
          return;
        }
        
        // Map scores to features - all features should have admin_pcode in properties from RPC
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
                has_score: true,
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
        // Only include filters that have actual filter criteria
        if (filter && (
          (filter.geometryTypes && filter.geometryTypes.size > 0) ||
          (filter.visibleFeatureIds && filter.visibleFeatureIds.size > 0) ||
          filter.minMagnitude !== undefined ||
          filter.maxMagnitude !== undefined
        )) {
          serializable[key] = {
            ...filter,
            visibleFeatureIds: filter.visibleFeatureIds ? Array.from(filter.visibleFeatureIds) : undefined,
            geometryTypes: filter.geometryTypes ? Array.from(filter.geometryTypes) : undefined,
          };
        }
      });
      
      // Only save if there are actual filters (don't overwrite with empty object)
      if (Object.keys(serializable).length > 0) {
        console.log('💾 Saving filters to localStorage:', serializable);
        localStorage.setItem(storageKey, JSON.stringify(serializable));
      } else {
        // If filters are empty, check if we should clear existing filters
        const existing = localStorage.getItem(storageKey);
        if (existing) {
          console.log('⚠️ Filters are empty, but keeping existing filters in localStorage');
        }
      }
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
    
    // Clear cached features immediately to prevent stale data
    setOverallFeatures([]);
    setFeatures([]);
    setFeaturesKey(prev => prev + 1); // Force map refresh
    
    // First, fetch the updated instance to get the new admin_scope
    const { data: updatedInstance, error: instanceError } = await supabase
      .from("instances")
      .select("*")
      .eq("id", instanceId)
      .single();
    
    if (instanceError) {
      console.error("Failed to fetch updated instance:", instanceError);
      return;
    }
    
    // Update instance state immediately
    setInstance(updatedInstance);
    
    // If admin_scope was updated, delete scores for areas outside the new scope
    if (updatedInstance?.admin_scope && Array.isArray(updatedInstance.admin_scope) && updatedInstance.admin_scope.length > 0) {
      // Get ADM3 codes that are within the new scope using pagination
      const CHUNK_SIZE = 2000;
      let allAdm3Codes: any[] = [];
      let offset = 0;
      let totalCount: number | null = null;
      let hasMore = true;

      while (hasMore) {
        const { data: affectedAdm3, error: adm3Error } = await supabase.rpc('get_affected_adm3', {
          in_scope: updatedInstance.admin_scope,
          in_limit: CHUNK_SIZE,
          in_offset: offset,
        });

        if (adm3Error) {
          console.error('Error getting affected ADM3 codes for cleanup:', adm3Error);
          break; // Stop pagination on error
        }

        if (!affectedAdm3 || affectedAdm3.length === 0) {
          hasMore = false;
          break;
        }

        // Get total count from first response
        if (totalCount === null && affectedAdm3.length > 0) {
          totalCount = affectedAdm3[0].total_count || affectedAdm3.length;
        }

        allAdm3Codes = allAdm3Codes.concat(affectedAdm3);

        // Check if we've fetched all data
        if (totalCount !== null && allAdm3Codes.length >= totalCount) {
          hasMore = false;
        } else if (affectedAdm3.length === 0) {
          hasMore = false;
        } else if (totalCount !== null && allAdm3Codes.length < totalCount) {
          offset += affectedAdm3.length;
        } else if (affectedAdm3.length >= CHUNK_SIZE) {
          offset += affectedAdm3.length;
        } else {
          hasMore = false;
        }
      }
      
      if (allAdm3Codes.length > 0) {
        const validAdm3Codes = allAdm3Codes.map((row: any) => 
          typeof row === 'string' ? row : (row.admin_pcode || row.pcode || row.code)
        ).filter(Boolean);
        
        console.log(`Found ${validAdm3Codes.length} valid ADM3 codes within new scope (loaded via pagination)`);
        
        if (validAdm3Codes.length > 0) {
          // Delete scores for admin_pcodes NOT in the valid list
          const batchSize = 1000;
          
          // Get all current scores to find which ones to delete
          const { data: allScores, error: scoresError } = await supabase
            .from("instance_dataset_scores")
            .select("admin_pcode")
            .eq("instance_id", instanceId);
          
          if (!scoresError && allScores) {
            const scoresToDelete = allScores
              .map((s: any) => s.admin_pcode)
              .filter((pcode: string) => !validAdm3Codes.includes(pcode));
            
            if (scoresToDelete.length > 0) {
              console.log(`Deleting ${scoresToDelete.length} dataset scores outside new scope`);
              // Delete in batches
              for (let i = 0; i < scoresToDelete.length; i += batchSize) {
                const batch = scoresToDelete.slice(i, i + batchSize);
                const { error: deleteError } = await supabase
                  .from("instance_dataset_scores")
                  .delete()
                  .eq("instance_id", instanceId)
                  .in("admin_pcode", batch);
                if (deleteError) {
                  console.error("Error deleting dataset scores:", deleteError);
                }
              }
            }
          }
          
          // Also delete category scores outside the scope
          const { data: allCategoryScores, error: catScoresError } = await supabase
            .from("instance_category_scores")
            .select("admin_pcode")
            .eq("instance_id", instanceId);
          
          if (!catScoresError && allCategoryScores) {
            const catScoresToDelete = allCategoryScores
              .map((s: any) => s.admin_pcode)
              .filter((pcode: string) => !validAdm3Codes.includes(pcode));
            
            if (catScoresToDelete.length > 0) {
              console.log(`Deleting ${catScoresToDelete.length} category scores outside new scope`);
              for (let i = 0; i < catScoresToDelete.length; i += batchSize) {
                const batch = catScoresToDelete.slice(i, i + batchSize);
                const { error: deleteError } = await supabase
                  .from("instance_category_scores")
                  .delete()
                  .eq("instance_id", instanceId)
                  .in("admin_pcode", batch);
                if (deleteError) {
                  console.error("Error deleting category scores:", deleteError);
                }
              }
            }
          }
        }
      }
    }
    
    // Add a small delay to ensure database updates are committed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Now refresh all data with the updated instance
    await fetchData();
    
    // Force reload features for current selection (don't use cached data)
    if (instanceId) {
      // Wait a bit more for views to update
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log('Reloading features after affected area update, selectedLayer:', selectedLayer);
      // Force clear features first to ensure map updates
      setFeatures([]);
      setFeaturesKey(prev => prev + 1);
      await loadFeaturesForSelection(selectedLayer, undefined);
    }
    
    // Refresh metrics panel
    setMetricsRefreshKey(prev => prev + 1);
  };

  const getColor = (score: number) => {
    // Consistent color thresholds across all score visualizations:
    // 1.0-1.5: green
    // 1.5-2.5: yellow-green
    // 2.5-3.5: yellow
    // 3.5-4.5: orange
    // 4.5+: red
    if (score < 1.5) return "#00FF00"; // green
    if (score < 2.5) return "#CCFF00"; // yellow-green
    if (score < 3.5) return "#FFCC00"; // yellow
    if (score < 4.5) return "#FF6600"; // orange
    return "#FF0000"; // red
  };

  const onEachFeature = (feature: any, layer: any) => {
    const adminName = feature.properties?.admin_name || feature.properties?.name || 'Unknown';
    const hasScore = feature.properties?.has_score === true;
    const score = feature.properties?.score !== undefined ? Number(feature.properties.score) : null;
    const rawValue = feature.properties?.raw_value !== undefined ? Number(feature.properties.raw_value) : null;
    
      let layerName = selectedLayer.type === 'priority' ? 'Priority Ranking' : 'Overall Score';
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
            <Link
              href={`/instances/${instanceId}/view`}
              className="btn text-xs py-1 px-2"
              style={{ backgroundColor: 'var(--gsc-blue)', color: 'white' }}
              title="Open view-only page (shareable link)"
            >
              👁️ View Only
            </Link>
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
            <button
              onClick={() => setShowImportHazardModal(true)}
              className="btn btn-secondary text-xs py-1 px-2"
              disabled={!instance}
              title="Import hazard event track from another instance"
            >
              Import Hazard Event
            </button>
            {instance && (
              <ExportInstanceButton
                instanceId={instanceId}
                instanceName={instance.name || 'instance'}
              />
            )}
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
              <div className="text-center p-4 border rounded-lg max-w-md" style={{ 
                backgroundColor: mapDataDiagnostics?.issue === 'no_admin_scope' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(251, 191, 36, 0.05)',
                borderColor: mapDataDiagnostics?.issue === 'no_admin_scope' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(251, 191, 36, 0.3)'
              }}>
                <p className="mb-2 font-semibold" style={{ 
                  color: mapDataDiagnostics?.issue === 'no_admin_scope' ? 'var(--gsc-red, #ef4444)' : 'var(--gsc-yellow, #fbbf24)'
                }}>
                  {mapDataDiagnostics?.issue === 'no_admin_scope' 
                    ? 'Affected Area Not Defined' 
                    : mapDataDiagnostics?.issue === 'no_geometry'
                    ? 'No Geometry Data Available'
                    : mapDataDiagnostics?.issue === 'no_affected_areas'
                    ? 'No Affected Areas Found'
                    : 'No Map Data Available'}
                </p>
                {mapDataDiagnostics?.issue === 'no_admin_scope' ? (
                  <>
                    <p className="text-sm mb-3">This instance does not have an affected area defined.</p>
                    <p className="text-xs mb-4">To fix this:</p>
                    <ol className="text-xs text-left list-decimal list-inside space-y-1 mb-4">
                      <li>Click "Edit Affected Area" button above</li>
                      <li>Select the administrative areas affected by this event</li>
                      <li>Save your selection</li>
                      <li>The map will appear once the affected area is defined</li>
                    </ol>
                    <button
                      onClick={() => setShowAffectedAreaModal(true)}
                      className="btn text-xs py-1 px-3"
                      style={{ backgroundColor: 'var(--gsc-blue)', color: 'white' }}
                    >
                      Define Affected Area
                    </button>
                  </>
                ) : mapDataDiagnostics?.issue === 'no_geometry' ? (
                  <>
                    <p className="text-sm mb-3">The affected area is defined, but geometry data is missing from the database.</p>
                    <p className="text-xs mb-4">This usually means:</p>
                    <ul className="text-xs text-left list-disc list-inside space-y-1 mb-4">
                      <li>The admin_boundaries table may not have geometry for these areas</li>
                      <li>The geometry data may need to be imported</li>
                      <li>Contact your administrator to check the database</li>
                    </ul>
                  </>
                ) : mapDataDiagnostics?.issue === 'no_affected_areas' ? (
                  <>
                    <p className="text-sm mb-3">The affected area is defined, but no matching administrative areas were found.</p>
                    <p className="text-xs mb-4">This might indicate:</p>
                    <ul className="text-xs text-left list-disc list-inside space-y-1 mb-4">
                      <li>The admin_scope codes don't match any ADM3 areas in the database</li>
                      <li>The affected area may need to be redefined</li>
                      <li>Try clicking "Edit Affected Area" to update the selection</li>
                    </ul>
                    <button
                      onClick={() => setShowAffectedAreaModal(true)}
                      className="btn text-xs py-1 px-3"
                      style={{ backgroundColor: 'var(--gsc-blue)', color: 'white' }}
                    >
                      Edit Affected Area
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm mb-2">Scores may not have been calculated yet.</p>
                    <p className="text-xs">If you've defined an affected area, try refreshing the page.</p>
                  </>
                )}
              </div>
            </div>
          ) : loadingFeatures ? (
            <div className="h-full flex items-center justify-center" style={{ color: 'var(--gsc-gray)' }}>
              <div className="text-center">
                <p className="mb-2">Loading map data...</p>
                <p className="text-sm">Switching to selected dataset...</p>
              </div>
            </div>
          ) : selectedLayer.type === 'priority' && features.length > 0 && features.filter((f: any) => f.properties.has_score).length === 0 ? (
            <div className="h-full flex items-center justify-center" style={{ color: 'var(--gsc-gray)' }}>
              <div className="text-center p-4 border rounded-lg" style={{ backgroundColor: 'rgba(147, 51, 234, 0.05)', borderColor: 'rgba(147, 51, 234, 0.3)' }}>
                <p className="mb-2 font-semibold" style={{ color: 'var(--gsc-purple, #9333ea)' }}>Priority Ranking Not Computed</p>
                <p className="text-sm mb-3">Priority scores have not been computed yet for this instance.</p>
                <p className="text-xs mb-4">To compute priority ranking:</p>
                <ol className="text-xs text-left list-decimal list-inside space-y-1 mb-4">
                  <li>Click "Adjust Scoring" button</li>
                  <li>Click "Compute Priority Ranking" button (purple button)</li>
                  <li>Wait for the computation to complete</li>
                  <li>Return here to view the priority ranking</li>
                </ol>
                <p className="text-xs italic">Note: Priority ranking creates relative scores (1-5) from absolute severity scores.</p>
              </div>
            </div>
          ) : overallScoresMissing && (selectedLayer.type === 'overall' || !selectedLayer.type) ? (
            <div className="h-full flex items-center justify-center" style={{ color: 'var(--gsc-gray)' }}>
              <div className="text-center p-4 border rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <p className="mb-2 font-semibold text-red-600">Overall Scores Not Computed</p>
                <p className="text-sm mb-3">Overall scores have not been computed yet for this instance.</p>
                {hasDatasetScores ? (
                  <>
                    <p className="text-xs mb-4">Dataset scores exist. To compute Overall scores:</p>
                    <ol className="text-xs text-left list-decimal list-inside space-y-1 mb-4">
                      <li>Click "Adjust Scoring" button</li>
                      <li>Click "Compute Final Rollup" button (blue button)</li>
                      <li>Wait for the computation to complete</li>
                      <li>Return here to view the overall scores</li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p className="text-xs mb-4">To compute Overall scores, first apply scoring to datasets:</p>
                    <ol className="text-xs text-left list-decimal list-inside space-y-1 mb-4">
                      <li>Click "Adjust Scoring" button</li>
                      <li>Apply scoring to each dataset (click "Adjust Scoring" for each dataset)</li>
                      <li>Click "Compute Framework Rollup" (if using framework categories)</li>
                      <li>Click "Compute Final Rollup" to generate Overall scores</li>
                    </ol>
                  </>
                )}
                <p className="text-xs italic">Note: Overall scores aggregate all category scores (Framework, Hazard, Underlying Vulnerability) into a single score per location.</p>
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
              key={`map-${selectedLayer.type}-${selectedLayer.datasetId || 'overall'}-${selectedLayer.category || ''}-${featuresKey}-${features.length}`}
            >
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapBoundsController features={features} />
              {features.length > 0 && (
                <UpdatingGeoJSON 
                  mapKey={`geojson-${selectedLayer.type}-${selectedLayer.datasetId || 'overall'}-${selectedLayer.category || ''}-${featuresKey}-${features.length}`}
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
              layers={layerOptions}
              categoryScores={categoryScoreMap}
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
              onDeleteHazardEvent={async (hazardEventId) => {
                if (!confirm('Are you sure you want to delete this hazard event? This will also delete all scores for this hazard event.')) {
                  return;
                }
                try {
                  const { error } = await supabase
                    .from('hazard_events')
                    .delete()
                    .eq('id', hazardEventId)
                    .eq('instance_id', instanceId);
                  
                  if (error) {
                    console.error('Error deleting hazard event:', error);
                    alert('Failed to delete hazard event: ' + error.message);
                    return;
                  }
                  
                  // Remove from local state
                  setHazardEvents(prev => prev.filter(e => e.id !== hazardEventId));
                  setVisibleHazardEvents(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(hazardEventId);
                    return newSet;
                  });
                  setLayerOptions(prev => prev.filter(l => l.hazard_event_id !== hazardEventId));
                  
                  // If this was the selected hazard, clear selection
                  if (selectedHazardEvent?.id === hazardEventId) {
                    setSelectedHazardEvent(null);
                    setSelectedLayer({ type: 'overall' });
                  }
                  
                  // Refresh data to update scores
                  await fetchData();
                } catch (err: any) {
                  console.error('Error deleting hazard event:', err);
                  alert('Failed to delete hazard event: ' + (err.message || 'Unknown error'));
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
                                        
                                        let newFilters;
                                        if (e.target.checked) {
                                          types.add(geomType);
                                          // If all types are selected, clear the filter (show all)
                                          if (types.size === geometryTypes.size) {
                                            newFilters = {
                                              ...prev,
                                              [selectedHazardEvent.id]: {
                                                ...current,
                                                geometryTypes: undefined,
                                              }
                                            };
                                          } else {
                                            newFilters = {
                                              ...prev,
                                              [selectedHazardEvent.id]: {
                                                ...current,
                                                geometryTypes: types,
                                              }
                                            };
                                          }
                                        } else {
                                          types.delete(geomType);
                                          newFilters = {
                                            ...prev,
                                            [selectedHazardEvent.id]: {
                                              ...current,
                                              geometryTypes: types.size > 0 ? types : new Set(),
                                            }
                                          };
                                        }
                                        
                                        // Immediately save to localStorage
                                        if (instanceId) {
                                          try {
                                            const storageKey = `hazard_filters_${instanceId}`;
                                            const serializable: Record<string, any> = {};
                                            Object.keys(newFilters).forEach((key) => {
                                              const filter = newFilters[key];
                                              if (filter && (
                                                (filter.geometryTypes && filter.geometryTypes.size > 0) ||
                                                (filter.visibleFeatureIds && filter.visibleFeatureIds.size > 0) ||
                                                filter.minMagnitude !== undefined ||
                                                filter.maxMagnitude !== undefined
                                              )) {
                                                serializable[key] = {
                                                  ...filter,
                                                  visibleFeatureIds: filter.visibleFeatureIds ? Array.from(filter.visibleFeatureIds) : undefined,
                                                  geometryTypes: filter.geometryTypes ? Array.from(filter.geometryTypes) : undefined,
                                                };
                                              }
                                            });
                                            localStorage.setItem(storageKey, JSON.stringify(serializable));
                                          } catch (e) {
                                            console.warn('Error immediately saving filter:', e);
                                          }
                                        }
                                        
                                        return newFilters;
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
                              const newFilters = {
                                ...hazardEventFilters,
                                [selectedHazardEvent.id]: {
                                  ...hazardEventFilters[selectedHazardEvent.id],
                                  geometryTypes: new Set(['LineString', 'MultiLineString']),
                                }
                              };
                              setHazardEventFilters(newFilters);
                              
                              // Immediately save to localStorage
                              if (instanceId) {
                                try {
                                  const storageKey = `hazard_filters_${instanceId}`;
                                  const serializable: Record<string, any> = {};
                                  Object.keys(newFilters).forEach((key) => {
                                    const filter = newFilters[key];
                                    if (filter && (
                                      (filter.geometryTypes && filter.geometryTypes.size > 0) ||
                                      (filter.visibleFeatureIds && filter.visibleFeatureIds.size > 0) ||
                                      filter.minMagnitude !== undefined ||
                                      filter.maxMagnitude !== undefined
                                    )) {
                                      serializable[key] = {
                                        ...filter,
                                        visibleFeatureIds: filter.visibleFeatureIds ? Array.from(filter.visibleFeatureIds) : undefined,
                                        geometryTypes: filter.geometryTypes ? Array.from(filter.geometryTypes) : undefined,
                                      };
                                    }
                                  });
                                  localStorage.setItem(storageKey, JSON.stringify(serializable));
                                  console.log('💾 Immediately saved filter (Track Only) to localStorage:', serializable);
                                } catch (e) {
                                  console.warn('Error immediately saving filter:', e);
                                }
                              }
                            }}
                            className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded w-full"
                            title="Show only the center track line"
                          >
                            Show Track Only (Hide Cone)
                          </button>
                          <button
                            onClick={() => {
                              const newFilters = {
                                ...hazardEventFilters,
                                [selectedHazardEvent.id]: {
                                  ...hazardEventFilters[selectedHazardEvent.id],
                                  geometryTypes: undefined,
                                }
                              };
                              setHazardEventFilters(newFilters);
                              
                              // Immediately save to localStorage
                              if (instanceId) {
                                try {
                                  const storageKey = `hazard_filters_${instanceId}`;
                                  const serializable: Record<string, any> = {};
                                  Object.keys(newFilters).forEach((key) => {
                                    const filter = newFilters[key];
                                    if (filter && (
                                      (filter.geometryTypes && filter.geometryTypes.size > 0) ||
                                      (filter.visibleFeatureIds && filter.visibleFeatureIds.size > 0) ||
                                      filter.minMagnitude !== undefined ||
                                      filter.maxMagnitude !== undefined
                                    )) {
                                      serializable[key] = {
                                        ...filter,
                                        visibleFeatureIds: filter.visibleFeatureIds ? Array.from(filter.visibleFeatureIds) : undefined,
                                        geometryTypes: filter.geometryTypes ? Array.from(filter.geometryTypes) : undefined,
                                      };
                                    }
                                  });
                                  localStorage.setItem(storageKey, JSON.stringify(serializable));
                                  console.log('💾 Immediately saved filter (Show All) to localStorage:', serializable);
                                } catch (e) {
                                  console.warn('Error immediately saving filter:', e);
                                }
                              }
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

      {/* Import Hazard Event Modal */}
      {showImportHazardModal && instance && (
        <ImportHazardEventModal
          instanceId={instanceId}
          onClose={() => setShowImportHazardModal(false)}
          onImported={async () => {
            await fetchData();
            setShowImportHazardModal(false);
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
