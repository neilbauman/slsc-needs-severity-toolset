"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";
import L from "leaflet";

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), {
  ssr: false,
});
const GeoJSON = dynamic(() => import("react-leaflet").then((mod) => mod.GeoJSON), {
  ssr: false,
});

export default function InstancePage() {
  const params = useParams();
  const instanceId = params?.id as string;

  const mapRef = useRef<L.Map | null>(null);

  const [geojson, setGeojson] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  const [stats, setStats] = useState({ pop: "-", concern: "-", need: "-", avg: "-" });
  const [loading, setLoading] = useState(true);

  // ✅ Load overall summary stats
  useEffect(() => {
    const loadSummary = async () => {
      const { data, error } = await supabase
        .from("v_instance_affected_summary")
        .select("total_population, people_concern, people_need, avg_score")
        .eq("instance_id", instanceId)
        .single();

      if (!error && data) {
        setStats({
          pop: Number(data.total_population).toLocaleString(),
          concern: Number(data.people_concern).toLocaleString(),
          need: Number(data.people_need).toLocaleString(),
          avg: Number(data.avg_score).toFixed(2),
        });
      }
    };
    if (instanceId) loadSummary();
  }, [instanceId]);

  // ✅ Load map data
  useEffect(() => {
    const loadMap = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("v_instance_admin_scores_geojson")
        .select("admin_pcode, adm3_name, geojson, score, dataset_id")
        .eq("instance_id", instanceId);

      if (!error && data) setGeojson(data);
      setLoading(false);
    };
    if (instanceId) loadMap();
  }, [instanceId]);

  // ✅ Auto-fit bounds when geojson loads
  useEffect(() => {
    if (mapRef.current && geojson.length > 0) {
      const bounds = L.geoJSON(geojson.map((g) => g.geojson)).getBounds();
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [geojson]);

  // ✅ Color scale 1 → 5
  const getColor = (score: number) => {
    if (score <= 1) return "#00b050";
    if (score <= 2) return "#92d050";
    if (score <= 3) return "#ffff00";
    if (score <= 4) return "#ff9900";
    return "#ff0000";
  };

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-2">Cebu EQ–Typhoon</h1>
      <p className="text-sm text-gray-600 mb-4">
        Overview of scoring and affected administrative areas.
      </p>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white border rounded p-3 text-center">
          <p className="text-xs text-gray-500">Total Population</p>
          <p className="text-lg font-semibold">{stats.pop}</p>
        </div>
        <div className="bg-white border rounded p-3 text-center">
          <p className="text-xs text-gray-500">People Concerned</p>
          <p className="text-lg font-semibold">{stats.concern}</p>
        </div>
        <div className="bg-white border rounded p-3 text-center">
          <p className="text-xs text-gray-500">People in Need</p>
          <p className="text-lg font-semibold">{stats.need}</p>
        </div>
        <div className="bg-white border rounded p-3 text-center">
          <p className="text-xs text-gray-500">Average Score</p>
          <p className="text-lg font-semibold">{stats.avg}</p>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Map container */}
        <div className="flex-1 border rounded overflow-hidden">
          <MapContainer
            center={[10.3, 123.9]}
            zoom={7}
            style={{ height: "70vh", width: "100%" }}
            ref={(mapInstance) => {
              if (mapInstance && !mapRef.current) mapRef.current = mapInstance;
            }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {!loading &&
              geojson
                .filter((g) =>
                  selectedDataset ? g.dataset_id === selectedDataset.dataset_id : true
                )
                .map((g, i) => (
                  <GeoJSON
                    key={i}
                    data={g.geojson}
                    style={{
                      color: getColor(g.score),
                      weight: 1,
                      fillOpacity: 0.6,
                    }}
                    eventHandlers={{
                      mouseover: (e) => {
                        const layer = e.target;
                        layer.bindTooltip(
                          `<strong>${g.adm3_name}</strong><br>Score: ${g.score}`
                        );
                      },
                    }}
                  />
                ))}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div className="w-72">
          <div className="bg-white border rounded p-3 mb-3">
            <div className="space-y-2">
              <button className="bg-blue-600 text-white text-sm rounded px-3 py-1 w-full hover:bg-blue-700">
                Define Affected Area
              </button>
              <button className="bg-green-600 text-white text-sm rounded px-3 py-1 w-full hover:bg-green-700">
                Configure Datasets
              </button>
              <button className="bg-orange-600 text-white text-sm rounded px-3 py-1 w-full hover:bg-orange-700">
                Calibrate Scores
              </button>
              <button className="bg-gray-700 text-white text-sm rounded px-3 py-1 w-full hover:bg-gray-800">
                Recompute Scores
              </button>
            </div>
          </div>

          <div className="bg-white border rounded p-3">
            <h3 className="font-semibold mb-2">Score Layers</h3>
            <ScoreLayerSelector
              instanceId={instanceId}
              onSelect={setSelectedDataset}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
