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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [showDatasetConfigModal, setShowDatasetConfigModal] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<{ type: 'overall' | 'dataset' | 'category', datasetId?: string, category?: string, datasetName?: string }>({ type: 'overall' });

  const fetchData = async () => {
    try {
      setError(null);
      
      // Fetch instance basic info (fallback if view doesn't exist)
      let instanceData = null;
      try {
        const { data, error: instanceError } = await supabase
          .from("v_instance_affected_summary")
          .select("*")
          .eq("instance_id", params.id)
          .single();

        if (!instanceError) {
          instanceData = data;
          // Ensure instance_id is set as id for consistency
          if (instanceData && !instanceData.id) {
            instanceData.id = instanceData.instance_id || params.id;
          }
          // If view doesn't have admin_scope, fetch it separately
          if (!instanceData.admin_scope) {
            const { data: scopeData } = await supabase
              .from("instances")
              .select("admin_scope")
              .eq("id", params.id)
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
          .eq("id", params.id)
          .single();
        
        if (!directError && data) {
          instanceData = data;
        } else if (!instanceData) {
          // Last resort: create minimal instance object with just the ID
          instanceData = { id: params.id, name: `Instance ${params.id}` };
        }
      }
      setInstance(instanceData);

      // Fetch datasets - try view first, then fallback
      let dsData: any[] = [];
      try {
        const { data, error: dsError } = await supabase
          .from("v_instance_datasets_view")
          .select("*")
          .eq("instance_id", params.id);

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
            .eq("instance_id", params.id);

          if (!fallbackError && fallbackData) {
            // Load configs separately
            const datasetIds = fallbackData.map((d: any) => d.dataset_id).filter(Boolean);
            let configMap = new Map();
            if (datasetIds.length > 0) {
              const { data: configs } = await supabase
                .from("instance_dataset_config")
                .select("dataset_id, score_config")
                .eq("instance_id", params.id)
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
          .eq("instance_id", params.id);

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
      if (selection.type === 'overall') {
        // Use overall instance scores
        if (overallFeatures) {
          setFeatures(overallFeatures);
          return;
        }
        
        const { data: geoData } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("geojson")
          .eq("instance_id", params.id);

        const parsed = (geoData || [])
          .map((g: any) => {
            try {
              return typeof g.geojson === 'string' ? JSON.parse(g.geojson) : g.geojson;
            } catch (e) {
              return null;
            }
          })
          .filter((f: any) => f !== null);
        
        setFeatures(parsed);
      } else if (selection.type === 'dataset' && selection.datasetId) {
        // Load scores for specific dataset
        const { data: scores } = await supabase
          .from("instance_dataset_scores")
          .select("admin_pcode, score")
          .eq("instance_id", params.id)
          .eq("dataset_id", selection.datasetId);

        if (!scores || scores.length === 0) {
          setFeatures([]);
          return;
        }

        // Get admin boundaries directly from table (RPC function signature may vary)
        const adminPcodes = scores.map((s: any) => s.admin_pcode);
        const { data: boundaries, error: boundariesError } = await supabase
          .from("admin_boundaries")
          .select("admin_pcode, admin_name, geometry")
          .in("admin_pcode", adminPcodes)
          .eq("admin_level", "ADM3");

        if (boundariesError) {
          console.error("Error fetching boundaries:", boundariesError);
          setFeatures([]);
          return;
        }

        if (!boundaries || boundaries.length === 0) {
          setFeatures([]);
          return;
        }

        // Create score map
        const scoreMap = new Map(scores.map((s: any) => [s.admin_pcode, s.score]));

        // Build GeoJSON features manually
        const features = boundaries
          .map((b: any) => {
            const score = scoreMap.get(b.admin_pcode);
            if (score === undefined) return null;

            // Try to parse geometry if it's a string
            let geometry = b.geometry;
            if (typeof geometry === 'string') {
              try {
                geometry = JSON.parse(geometry);
              } catch (e) {
                console.warn("Error parsing geometry:", e);
                return null;
              }
            }

            return {
              type: "Feature",
              properties: {
                admin_pcode: b.admin_pcode,
                admin_name: b.admin_name,
                score: score,
              },
              geometry: geometry,
            };
          })
          .filter((f: any) => f !== null);

        setFeatures(features);
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
    }
  };

  useEffect(() => {
    fetchData();
  }, [params.id]);

  // ✅ Load features when selection changes (but not on initial load)
  useEffect(() => {
    // Only reload if we have initial features loaded and selection changed from 'overall'
    if (!loading && instance && params.id && features.length > 0 && selectedLayer.type !== 'overall') {
      loadFeaturesForSelection(selectedLayer);
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
      const score = feature.properties.score;
      const color = getColor(score);
      layer.setStyle({ 
        color, 
        fillColor: color, 
        fillOpacity: 0.6,
        weight: 2
      });
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
      layer.bindPopup(
        `<strong>${adminName}</strong><br/>${layerName}: ${score.toFixed(2)}`
      );
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
              {instance?.name || `Instance ${params.id}`}
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
      <div className="flex flex-1 gap-2 min-h-0">
        {/* Map */}
        <div className="flex-1 border rounded-lg overflow-hidden bg-white">
          {features.length === 0 && !loading ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="mb-2">No map data available</p>
                <p className="text-sm">Scores may not have been calculated yet.</p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={[12.8797, 121.774]} // Philippines center
              zoom={6}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapBoundsController features={features} />
              {features.map((f, idx) => (
                <GeoJSON key={idx} data={f} onEachFeature={onEachFeature} />
              ))}
            </MapContainer>
          )}
        </div>

        {/* Sidebar */}
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
              instanceId={params.id}
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
