"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import("react-leaflet").then((mod) => mod.GeoJSON),
  { ssr: false }
);

interface Dataset {
  dataset_id: string;
  name: string;
  category: string;
}

export default function InstancePage() {
  const params = useParams();
  const instanceId = params?.id as string;

  const mapRef = useRef<any>(null);
  const [geojsonLayers, setGeojsonLayers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Fetch GeoJSON for a given dataset
  const fetchGeoJSON = async (dataset: Dataset) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc(
        "get_instance_admin_scores_geojson",
        {
          in_instance_id: instanceId,
          in_dataset_id: dataset.dataset_id,
        }
      );

      if (error) throw error;
      if (!data) {
        setError(`No data for dataset: ${dataset.name}`);
        return null;
      }
      return data;
    } catch (err: any) {
      console.error("Error loading GeoJSON:", err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ✅ Toggle layer visibility
  const handleToggleLayer = async (dataset: Dataset, visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;

    if (visible) {
      // Fetch new GeoJSON for this dataset
      const geojsonData = await fetchGeoJSON(dataset);
      if (!geojsonData) return;

      const layer = new (await import("leaflet")).GeoJSON(geojsonData, {
        style: (feature) => ({
          color: "#333",
          weight: 1,
          fillColor: getColor(feature?.properties?.score ?? 0),
          fillOpacity: 0.6,
        }),
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.adm3_name || "Unknown area";
          const score = feature.properties?.score?.toFixed(2) ?? "–";
          layer.bindPopup(`<strong>${name}</strong><br/>Score: ${score}`);
        },
      });

      layer.addTo(map);
      setGeojsonLayers((prev) => ({ ...prev, [dataset.dataset_id]: layer }));
    } else {
      // Remove from map
      const layer = geojsonLayers[dataset.dataset_id];
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
        setGeojsonLayers((prev) => {
          const updated = { ...prev };
          delete updated[dataset.dataset_id];
          return updated;
        });
      }
    }
  };

  // ✅ Color scale helper
  const getColor = (score: number) => {
    return score >= 4.5
      ? "#800026"
      : score >= 3.5
      ? "#BD0026"
      : score >= 2.5
      ? "#E31A1C"
      : score >= 1.5
      ? "#FC4E2A"
      : "#FFEDA0";
  };

  // ✅ Map initialization (build-safe)
  const handleMapReady = async () => {
    try {
      const L = await import("leaflet");
      const mapEl = document.querySelector(".leaflet-container") as HTMLElement;
      if (mapEl) {
        const map = L.map(mapEl);
        if (map) mapRef.current = map;
      }
    } catch (err) {
      console.error("Error initializing map:", err);
    }
  };

  return (
    <div className="flex flex-row gap-4 p-4">
      {/* Sidebar */}
      <div className="w-[300px] flex-shrink-0">
        <ScoreLayerSelector
          instanceId={instanceId}
          onToggleLayer={handleToggleLayer}
        />
      </div>

      {/* Map View */}
      <div className="flex-grow relative">
        <MapContainer
          center={[10.3, 123.9]}
          zoom={8}
          style={{ height: "75vh", width: "100%" }}
          whenReady={handleMapReady}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </MapContainer>

        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center text-gray-700 text-sm">
            Loading map data...
          </div>
        )}

        {error && (
          <div className="absolute bottom-2 left-2 bg-red-100 text-red-700 px-3 py-2 rounded text-xs shadow">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
