"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ScoreLayerSelector = ({ instanceId, onSelect }: any) => {
  const [layers, setLayers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const fetchLayers = async () => {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const headers = { apikey: key, Authorization: `Bearer ${key}` };
      const res = await fetch(`${base}/rest/v1/instance_datasets?instance_id=eq.${instanceId}&select=*`, { headers });
      const data = await res.json();
      setLayers(data);
    };
    fetchLayers();
  }, [instanceId]);

  const grouped = {
    "SSC Framework - P1": layers.filter((l) => l.category === "P1"),
    "SSC Framework - P2": layers.filter((l) => l.category === "P2"),
    "SSC Framework - P3": layers.filter((l) => l.category === "P3"),
    "Hazards": layers.filter((l) => l.category === "Hazard"),
    "Underlying Vulnerability": layers.filter((l) => l.category === "Underlying Vulnerability"),
  };

  return (
    <div className="text-sm">
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} className="mb-2">
          <h4 className="font-semibold text-gray-700 mb-1">{cat}</h4>
          <div className="space-y-1">
            {list.map((d) => (
              <button
                key={d.dataset_id}
                onClick={() => {
                  setSelected(d.dataset_id);
                  onSelect(d);
                }}
                className={`block w-full text-left px-2 py-1 rounded ${
                  selected === d.dataset_id ? "bg-blue-600 text-white" : "hover:bg-gray-100"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function InstancePage() {
  const params = useParams();
  const mapRef = useRef<L.Map | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<any>(null);

  const getColor = (score: number) => {
    if (score >= 4.5) return "#D32F2F";
    if (score >= 4.0) return "#FF8C00";
    if (score >= 3.0) return "#FFD700";
    if (score >= 2.0) return "#9ACD32";
    return "#00A65A";
  };

  useEffect(() => {
    const fetchData = async () => {
      const id = params?.id;
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const headers = { apikey: key, Authorization: `Bearer ${key}` };

      const summaryRes = await fetch(
        `${base}/rest/v1/v_instance_affected_summary?select=*&instance_id=eq.${id}`,
        { headers }
      );
      const summaryJson = await summaryRes.json();
      setSummary(summaryJson[0] || null);

      const geoRes = await fetch(
        `${base}/rest/v1/v_instance_admin_scores_geojson?select=*&instance_id=eq.${id}`,
        { headers }
      );
      const geoJson = await geoRes.json();
      setFeatures(geoJson || []);

      setLoading(false);
    };
    fetchData();
  }, [params?.id]);

  useEffect(() => {
    if (loading || !mapRef.current) return;
    const map = mapRef.current;

    map.eachLayer((layer: any) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    if (features.length > 0) {
      const geoLayer = L.geoJSON(features.map((f) => f.geojson), {
        style: (feature: any) => ({
          color: "#444",
          weight: 0.5,
          fillColor: getColor(feature?.properties?.score),
          fillOpacity: 0.65,
        }),
        onEachFeature: (feature: any, layer: any) => {
          const name = feature.properties.admin_name || "Unknown";
          const score = Number(feature.properties.score).toFixed(1);
          layer.bindTooltip(`<strong>${name}</strong><br>Score: ${score}`);
        },
      }).addTo(map);

      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [features, loading, selectedLayer]);

  const MapContainer = dynamic(
    async () => {
      const { MapContainer, TileLayer } = await import("react-leaflet");
      return ({ children }: any) => (
        <MapContainer
          center={[11, 122]}
          zoom={6}
          style={{ height: "70vh", width: "100%" }}
          whenReady={() => {}}
          ref={(map: any) => {
            if (map && !mapRef.current) mapRef.current = map;
          }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {children}
        </MapContainer>
      );
    },
    { ssr: false }
  );

  if (loading) return <div className="p-2 text-sm">Loading...</div>;

  return (
    <div className="p-2 space-y-2 text-sm">
      <h2 className="font-semibold text-base">Cebu EQ–Typhoon</h2>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="p-2 border rounded bg-white shadow-sm">
          <p className="text-gray-500 text-xs">Total Areas</p>
          <p className="text-lg font-semibold">{summary ? summary.total_areas : "-"}</p>
        </div>
        <div className="p-2 border rounded bg-white shadow-sm">
          <p className="text-gray-500 text-xs">Min Score</p>
          <p className="text-lg font-semibold">
            {summary ? Number(summary.min_score).toFixed(1) : "-"}
          </p>
        </div>
        <div className="p-2 border rounded bg-white shadow-sm">
          <p className="text-gray-500 text-xs">Max Score</p>
          <p className="text-lg font-semibold">
            {summary ? Number(summary.max_score).toFixed(1) : "-"}
          </p>
        </div>
        <div className="p-2 border rounded bg-white shadow-sm">
          <p className="text-gray-500 text-xs">Average Score</p>
          <p className="text-lg font-semibold">
            {summary ? Number(summary.avg_score).toFixed(1) : "-"}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col w-64 gap-1">
          <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            Define Affected Area
          </button>
          <button className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
            Configure Datasets
          </button>
          <button className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm">
            Calibrate Scores
          </button>
          <button className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-900 text-sm">
            Recompute Scores
          </button>

          <div className="mt-3 border-t pt-2">
            <h4 className="font-semibold mb-1">Score Layers</h4>
            <ScoreLayerSelector instanceId={params?.id} onSelect={setSelectedLayer} />
          </div>
        </div>

        <div className="flex-1 border rounded overflow-hidden shadow-sm">
          <MapContainer />
        </div>
      </div>
    </div>
  );
}
