"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import("react-leaflet").then((m) => m.GeoJSON), { ssr: false });

export default function InstancePage({ params }: { params: { id: string } }) {
  const instanceId = params.id;
  const [instance, setInstance] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [layers, setLayers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<any>(null);

  // 🧩 Load instance info
  useEffect(() => {
    const loadInstance = async () => {
      const { data, error } = await supabase
        .from("instances")
        .select("*")
        .eq("id", instanceId)
        .single();
      if (!error && data) setInstance(data);
    };
    loadInstance();
  }, [instanceId]);

  // 🧮 Load summary (population, concern, need)
  useEffect(() => {
    const loadSummary = async () => {
      const { data, error } = await supabase.rpc("get_instance_summary", {
        in_instance_id: instanceId,
      });
      if (error) {
        console.error("Summary load error:", error);
      } else {
        setSummary(data?.[0] || null);
      }
      setLoading(false);
    };
    loadSummary();
  }, [instanceId]);

  // 🧭 Add/remove map layers
  const handleToggleLayer = async (dataset: any, visible: boolean) => {
    if (!mapRef.current) return;

    // Remove layer if turning off
    if (!visible) {
      if (layers[dataset.dataset_id]) {
        mapRef.current.removeLayer(layers[dataset.dataset_id]);
        setLayers((prev) => {
          const newLayers = { ...prev };
          delete newLayers[dataset.dataset_id];
          return newLayers;
        });
      }
      return;
    }

    // Load GeoJSON for this dataset
    const { data, error } = await supabase
      .from("v_instance_admin_scores_geojson")
      .select("geojson")
      .eq("instance_id", instanceId)
      .eq("dataset_id", dataset.dataset_id)
      .single();

    if (error) {
      console.error("GeoJSON load error:", error);
      return;
    }

    if (data?.geojson) {
      const geojson = JSON.parse(data.geojson);
      const L = (await import("leaflet")).default;
      const layer = L.geoJSON(geojson, {
        style: (f) => {
          const score = f.properties?.score || 0;
          const colorScale = ["#fef0d9", "#fdcc8a", "#fc8d59", "#e34a33", "#b30000"];
          const idx = Math.min(4, Math.max(0, Math.floor(score - 1)));
          return {
            color: "#555",
            weight: 0.8,
            fillColor: colorScale[idx],
            fillOpacity: 0.7,
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          layer.bindPopup(
            `<strong>${props.adm3_name}</strong><br>
             Score: ${props.score ?? "-"}<br>
             Pop: ${props.pop?.toLocaleString() ?? "-"}`
          );
        },
      });
      layer.addTo(mapRef.current);

      setLayers((prev) => ({ ...prev, [dataset.dataset_id]: layer }));
    }
  };

  if (loading || !instance) {
    return (
      <div className="flex items-center justify-center h-[80vh] text-gray-500">
        Loading instance...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">
          {instance.name || "Unnamed Instance"}
        </h1>
        <p className="text-gray-500 text-sm">
          Overview of scoring and affected administrative areas.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">Total Population</div>
          <div className="text-xl font-semibold">
            {summary?.total_population
              ? summary.total_population.toLocaleString()
              : "-"}
          </div>
        </div>
        <div className="bg-white border rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">
            People of Concern (Score ≥ 3)
          </div>
          <div className="text-xl font-semibold">
            {summary?.people_concern
              ? summary.people_concern.toLocaleString()
              : "-"}
          </div>
        </div>
        <div className="bg-white border rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">People in Need</div>
          <div className="text-xl font-semibold">
            {summary?.people_need
              ? summary.people_need.toLocaleString()
              : "-"}
          </div>
        </div>
      </div>

      {/* Map & Layers */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3 border rounded-lg overflow-hidden">
          <MapContainer
            center={[10.3, 123.9]}
            zoom={8}
            style={{ height: "75vh", width: "100%" }}
            whenCreated={(mapInstance) => {
              mapRef.current = mapInstance;
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </MapContainer>
        </div>

        <div>
          <ScoreLayerSelector
            instanceId={instanceId}
            onToggleLayer={handleToggleLayer}
          />
        </div>
      </div>
    </div>
  );
}
