'use client';

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import Link from "next/link";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";

// Dynamically import modals to avoid SSR issues
const InstanceScoringModal = dynamic(
  () => import("@/components/InstanceScoringModal"),
  { ssr: false }
);

const InstanceDatasetConfigModal = dynamic(
  () => import("@/components/InstanceDatasetConfigModal"),
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
  const [selectedLayer, setSelectedLayer] = useState<{ type: 'overall' | 'dataset' | 'category', datasetId?: string, category?: string, datasetName?: string }>({ type: 'overall' });

  // Ensure instanceId exists
  const instanceId = params?.id;
  
  if (!instanceId) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold mb-2">Invalid Instance ID</h2>
          <p className="text-red-600 text-sm mb-4">No instance ID provided.</p>
          <Link
            href="/instances"
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
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
      
      // Fetch instance basic info (fallback if view doesn't exist)
      let instanceData = null;
      try {
        const { data, error: instanceError } = await supabase
          .from("v_instance_affected_summary")
          .select("*")
          .eq("instance_id", instanceId)
          .single();

        if (!instanceError) {
          instanceData = data;
          // Ensure instance_id is set as id for consistency
          if (instanceData && !instanceData.id) {
            instanceData.id = instanceData.instance_id || instanceId;
          }
          // If view doesn't have admin_scope, fetch it separately
          if (!instanceData.admin_scope) {
            const { data: scopeData } = await supabase
              .from("instances")
              .select("admin_scope")
              .eq("id", instanceId)
              .single();
            if (scopeData) {
              instanceData.admin_scope = scopeData.admin_scope;
            }
          }
        }
      } catch (e) {
        // View might not exist, try direct table
        const { data, error: directError } = await supabase
          .from("instances")
          .select("*")
          .eq("id", instanceId)
          .single();
        
        if (!directError && data) {
          instanceData = data;
        } else if (!instanceData) {
          // Last resort: create minimal instance object with just the ID
          instanceData = { id: instanceId, name: `Instance ${instanceId}` };
        }
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

      // Fetch affected area geojson
      let geoData: any[] = [];
      try {
        const { data, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("geojson")
          .eq("instance_id", instanceId);

        if (!geoError && data) {
          geoData = data;
        }
      } catch (e) {
        console.warn("GeoJSON view not available:", e);
      }

      const parsed = geoData
        .map((g: any) => {
          try {
            return typeof g.geojson === 'string' ? JSON.parse(g.geojson) : g.geojson;
          } catch (e) {
            console.warn("Error parsing GeoJSON:", e);
            return null;
          }
        })
        .filter((f: any) => f !== null);
      
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

  // ✅ Load features for selected layer (overall, dataset, or category)
  const loadFeaturesForSelection = async (
    selection: { type: 'overall' | 'dataset' | 'category', datasetId?: string, category?: string },
    overallFeatures?: any[]
  ) => {
    try {
      // Clear features first to prevent stale data from showing
      setFeatures([]);
      setLoadingFeatures(true);
      
      if (selection.type === 'overall') {
        // Use overall instance scores
        if (overallFeatures) {
          setFeatures(overallFeatures);
          return;
        }
        
        const { data: geoData, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("geojson")
          .eq("instance_id", instanceId);

        if (geoError) {
          console.error("Error fetching overall GeoJSON:", geoError);
          setFeatures([]);
          return;
        }

        // Each row contains a single Feature in the geojson field
        const parsed = (geoData || [])
          .map((row: any) => {
            try {
              const feature = typeof row.geojson === 'string' 
                ? JSON.parse(row.geojson) 
                : row.geojson;
              return feature;
            } catch (e) {
              console.warn("Error parsing GeoJSON feature:", e);
              return null;
            }
          })
          .filter((f: any) => f !== null);
        
        setFeatures(parsed);
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
          return;
        }

        if (!scores || scores.length === 0) {
          console.log("No scores found for dataset:", selection.datasetId);
          setFeatures([]);
          return;
        }

        // Create score map for this dataset
        const scoreMap = new Map(scores.map((s: any) => [s.admin_pcode, Number(s.score)]));
        console.log(`Loaded ${scores.length} scores for dataset ${selection.datasetId}`);
        console.log("Sample scores:", Array.from(scoreMap.entries()).slice(0, 5));

        // Get geometry from view - each row is a single Feature (not FeatureCollection)
        const { data: geoRows, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode, geojson")
          .eq("instance_id", instanceId);
        
        if (geoError) {
          console.error("Error fetching GeoJSON:", geoError);
          setFeatures([]);
          return;
        }
        
        if (!geoRows || geoRows.length === 0) {
          console.log("No GeoJSON features found for instance");
          setFeatures([]);
          return;
        }
        
        console.log(`Loaded ${geoRows.length} GeoJSON features from view`);
        
        // Parse and filter features - each row has a single Feature in the geojson field
        const filteredFeatures = geoRows
          .map((row: any) => {
            try {
              // Parse the geojson field (it's a single Feature, not FeatureCollection)
              const feature = typeof row.geojson === 'string' 
                ? JSON.parse(row.geojson) 
                : row.geojson;
              
              // Check if this admin_pcode has a score for this dataset
              const datasetScore = scoreMap.get(row.admin_pcode);
              
              // Only include features that have scores for this dataset
              if (datasetScore === undefined) return null;
              
              // Update the feature with the dataset-specific score
              // Create a new object to ensure React detects the change
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  admin_pcode: row.admin_pcode,
                  admin_name: feature.properties?.admin_name || feature.properties?.name,
                  score: datasetScore, // Use dataset-specific score
                }
              };
            } catch (e) {
              console.warn("Error parsing GeoJSON feature:", e, row);
              return null;
            }
          })
          .filter((f: any) => f !== null);
        
        console.log(`Filtered to ${filteredFeatures.length} features with dataset scores`);
        console.log("Sample feature scores:", filteredFeatures.slice(0, 5).map((f: any) => ({
          admin_pcode: f.properties?.admin_pcode,
          score: f.properties?.score,
          admin_name: f.properties?.admin_name
        })));
        
        // Force a new array reference to ensure React detects the change
        setFeatures([...filteredFeatures]);
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer.type, selectedLayer.datasetId, selectedLayer.category]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const handleScoringSaved = async () => {
    setShowScoringModal(false);
    await fetchData(); // Refresh data after scoring changes
  };

  const getColor = (score: number) => {
    if (score <= 1) return "#00FF00"; // green
    if (score <= 2) return "#CCFF00"; // yellow-green
    if (score <= 3) return "#FFCC00"; // yellow
    if (score <= 4) return "#FF6600"; // orange
    return "#FF0000"; // red
  };

  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties && feature.properties.score !== undefined) {
      const score = Number(feature.properties.score);
      const color = getColor(score);
      const adminName = feature.properties.admin_name || feature.properties.name || 'Unknown';
      let layerName = 'Overall Score';
      if (selectedLayer.type === 'dataset') {
        layerName = selectedLayer.datasetName || 'Dataset Score';
      } else if (selectedLayer.type === 'category') {
        if (selectedLayer.category === 'overall') {
          layerName = `${selectedLayer.datasetName || 'Dataset'} - Overall`;
        } else {
          layerName = `${selectedLayer.datasetName || 'Dataset'} - ${selectedLayer.category}`;
        }
      }
      
      // Set initial style with thin black borders
      layer.setStyle({ 
        color: '#000000', // Black border
        fillColor: color, 
        fillOpacity: 0.6,
        weight: 1, // Thin border
        opacity: 1
      });
      
      // Bind tooltip for hover (shows name and score)
      layer.bindTooltip(
        `<strong>${adminName}</strong><br/>${layerName}: ${score.toFixed(2)}`,
        {
          permanent: false,
          direction: 'top',
          offset: [0, -10],
          className: 'custom-tooltip'
        }
      );
      
      // Bind popup for click
      layer.bindPopup(
        `<strong>${adminName}</strong><br/>${layerName}: ${score.toFixed(2)}`
      );
      
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
      const adminName = feature.properties?.admin_name || feature.properties?.name || 'Unknown';
      
      layer.setStyle({ 
        color: '#000000', // Black border
        fillColor: '#ddd', 
        fillOpacity: 0.3,
        weight: 1, // Thin border
        opacity: 1
      });
      
      // Bind tooltip for hover
      layer.bindTooltip(
        `<strong>${adminName}</strong><br/>No score available`,
        {
          permanent: false,
          direction: 'top',
          offset: [0, -10],
          className: 'custom-tooltip'
        }
      );
      
      // Bind popup for click
      layer.bindPopup(
        `<strong>${adminName}</strong><br/>No score available`
      );
      
      // Add hover effects
      layer.on({
        mouseover: (e: any) => {
          const hoverLayer = e.target;
          hoverLayer.setStyle({
            weight: 2,
            fillOpacity: 0.5,
            color: '#000000',
            fillColor: '#ddd'
          });
        },
        mouseout: (e: any) => {
          const hoverLayer = e.target;
          hoverLayer.setStyle({
            weight: 1,
            fillOpacity: 0.3,
            color: '#000000',
            fillColor: '#ddd'
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
          <div className="text-gray-600">Loading instance data...</div>
        </div>
      </div>
    );
  }

  if (error && !instance) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold mb-2">Error Loading Instance</h2>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              Try Again
            </button>
            <Link
              href="/instances"
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              Back to Instances
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 p-2 bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              {instance?.name || `Instance ${instanceId}`}
            </h1>
            {instance?.description && (
              <p className="text-sm text-gray-600 mt-1">{instance.description}</p>
            )}
          </div>
          <Link
            href="/instances"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to Instances
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-2">
        {/* Map - Fixed height for laptop viewing */}
        <div className="flex-1 border rounded-lg overflow-hidden bg-white" style={{ height: '600px', minHeight: '600px' }}>
          {features.length === 0 && !loading && !loadingFeatures ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="mb-2">No map data available</p>
                <p className="text-sm">Scores may not have been calculated yet.</p>
              </div>
            </div>
          ) : loadingFeatures ? (
            <div className="h-full flex items-center justify-center text-gray-500">
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
            </MapContainer>
          )}
        </div>

        {/* Sidebar - Independent of map height */}
        <div className="w-72 space-y-2 flex flex-col">
          {/* Action Buttons */}
          <div className="bg-white border rounded-lg p-3 space-y-2">
            <button
              onClick={() => setShowDatasetConfigModal(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded text-sm font-medium transition-colors"
            >
              Configure Datasets
            </button>
            <button
              onClick={() => setShowScoringModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium transition-colors"
            >
              Adjust Scoring
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 rounded text-sm font-medium transition-colors"
            >
              {refreshing ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>

          {/* Score Layers */}
          <div className="bg-white border rounded-lg p-3 flex-1 overflow-y-auto">
            <h3 className="font-semibold mb-2 text-gray-800">Score Layers</h3>
            <ScoreLayerSelector
              instanceId={instanceId}
              onSelect={(selection) => {
                setSelectedLayer(selection);
              }}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
              <p className="text-xs text-yellow-800">
                ⚠️ Some data may be incomplete: {error}
              </p>
            </div>
          )}
        </div>
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
    </div>
  );
}
