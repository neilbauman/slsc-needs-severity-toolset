'use client';

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import Link from "next/link";

// Dynamically import modal to avoid SSR issues
const InstanceScoringModal = dynamic(
  () => import("@/components/InstanceScoringModal"),
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

  const categories = [
    "SSC Framework P1",
    "SSC Framework P2",
    "SSC Framework P3",
    "Hazards",
    "Underlying Vulnerability",
  ];

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
        }
      } catch (e) {
        // View might not exist, try direct table
        const { data, error: directError } = await supabase
          .from("instances")
          .select("*")
          .eq("id", params.id)
          .single();
        
        if (!directError) {
          instanceData = data;
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
              ),
              instance_dataset_config (
                score_config
              )
            `)
            .eq("instance_id", params.id);

          if (!fallbackError && fallbackData) {
            dsData = fallbackData.map((d: any) => ({
              id: d.id,
              dataset_id: d.dataset_id,
              dataset_name: d.datasets?.name || `Dataset ${d.dataset_id}`,
              score_config: d.instance_dataset_config?.[0]?.score_config || null,
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
      
      setFeatures(parsed);
    } catch (err: any) {
      console.error("Error loading instance page:", err);
      setError(err?.message || "Failed to load instance data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [params.id]);

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
      layer.bindPopup(
        `<strong>${adminName}</strong><br/>Score: ${score.toFixed(2)}`
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
            {datasets.length === 0 ? (
              <p className="text-gray-400 italic text-xs">No datasets configured for this instance.</p>
            ) : (
              <div className="space-y-3">
                {categories.map((cat) => {
                  const categoryDatasets = datasets.filter((d) => {
                    const category = d.score_config?.category || d.category;
                    return category === cat || category === `SSC Framework - ${cat.split(' ')[2]}`;
                  });

                  return (
                    <div key={cat} className="border-b pb-2 last:border-b-0">
                      <div className="font-medium text-gray-700 mb-1">{cat}</div>
                      {categoryDatasets.length > 0 ? (
                        <div className="space-y-1 ml-2">
                          {categoryDatasets.map((d) => (
                            <div
                              key={d.id || d.dataset_id}
                              className="text-sm text-gray-600 truncate"
                              title={getDatasetName(d)}
                            >
                              {getDatasetName(d)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400 italic text-xs ml-2">No datasets</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
    </div>
  );
}
