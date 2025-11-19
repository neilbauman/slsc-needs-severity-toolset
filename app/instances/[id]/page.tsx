"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function InstancePage() {
  const params = useParams();
  const mapRef = useRef<L.Map | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- SCORE COLOR RAMP ---
  const getColor = (score: number) => {
    if (score >= 4.5) return "#D32F2F"; // red
    if (score >= 4.0) return "#FF8C00"; // orange
    if (score >= 3.0) return "#FFD700"; // yellow
    if (score >= 2.0) return "#9ACD32"; // yellow-green
    return "#00A65A"; // green
  };

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const id = params?.id;
        const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        const headers = { apikey: key, Authorization: `Bearer ${key}` };

        // Summary stats
        const summaryRes = await fetch(
          `${base}/rest/v1/v_instance_affected_summary?select=*&instance_id=eq.${id}`,
          { headers }
        );
        const summaryJson = await summaryRes.json();
        setSummary(summaryJson[0] || null);

        // GeoJSON features (limited to affected area)
        const geoRes = await fetch(
          `${base}/rest/v1/v_instance_admin_scores_geojson?select=*&instance_id=eq.${id}`,
          { headers }
        );
        const geoJson = await geoRes.json();
        setFeatures(geoJson || []);
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params?.id]);

  // --- RENDER FEATURES ON MAP ---
  useEffect(() => {
    if (loading || !mapRef.current || features.length === 0) return;

    const map = mapRef.current;

    // Clear existing non-tile layers
    map.eachLayer((layer: any) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    const geoLayer = L.geoJSON(features.map((f) => f.geojson), {
      style: (feature: any) => ({
        color: "#555",
        weight: 1,
        fillColor: getColor(feature?.properties?.score),
        fillOpacity: 0.65,
      }),
      onEachFeature: (feature: any, layer: any) => {
        const name = feature.properties.admin_name || "Unknown";
        const score = Number(feature.properties.score).toFixed(1);
        layer.bindTooltip(
          `<strong>${name}</strong><br>Score: ${score}`,
          { direction: "top" }
        );
      },
    }).addTo(map);

    // Fit map to affected bounds
    const bounds = geoLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }, [features, loading]);

  // --- DYNAMIC MAP ---
  const MapContainer = dynamic(
    async () => {
      const { MapContainer, TileLayer } = await import("react-leaflet");
      return ({ children }: any) => (
        <MapContainer
          center={[11, 122]}
          zoom={6}
          style={{ height: "70vh", width: "100%" }}
          whenReady={(e: any) => {
            mapRef.current = e.target;
          }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {children}
        </MapContainer>
      );
    },
    { ssr: false }
  );

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cebu EQ–Typhoon</h2>
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 border rounded shadow-sm text-center bg-white">
          <p className="text-gray-500 text-sm">Total Areas</p>
          <p className="text-2xl font-semibold">
            {summary ? summary.total_areas.toLocaleString() : "-"}
          </p>
        </div>
        <div className="p-4 border rounded shadow-sm text-center bg-white">
          <p className="text-gray-500 text-sm">Min Score</p>
          <p className="text-2xl font-semibold">
            {summary ? Number(summary.min_score).toFixed(1) : "-"}
          </p>
        </div>
        <div className="p-4 border rounded shadow-sm text-center bg-white">
          <p className="text-gray-500 text-sm">Max Score</p>
          <p className="text-2xl font-semibold">
            {summary ? Number(summary.max_score).toFixed(1) : "-"}
          </p>
        </div>
        <div className="p-4 border rounded shadow-sm text-center bg-white">
          <p className="text-gray-500 text-sm">Average Score</p>
          <p className="text-2xl font-semibold">
            {summary ? Number(summary.avg_score).toFixed(1) : "-"}
          </p>
        </div>
      </div>

      {/* ACTIONS + MAP */}
      <div className="flex gap-4">
        <div className="flex flex-col gap-2 w-56">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Define Affected Area
          </button>
          <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Configure Datasets
          </button>
          <button className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
            Calibrate Scores
          </button>
          <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900">
            Recompute Scores
          </button>
        </div>

        <div className="flex-1 border rounded shadow-sm overflow-hidden">
          <MapContainer />
        </div>
      </div>
    </div>
  );
}
