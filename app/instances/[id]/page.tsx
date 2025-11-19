"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const Page = () => {
  const params = useParams();
  const mapRef = useRef<L.Map | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Utility: score → color
  const getColor = (score: number) => {
    if (score >= 4.5) return "#D32F2F"; // red
    if (score >= 4.0) return "#FF8C00"; // orange
    if (score >= 3.0) return "#FFD700"; // yellow
    if (score >= 2.0) return "#9ACD32"; // yellow-green
    return "#00A65A"; // green
  };

  // Fetch summary and map data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const id = params?.id;

        // Summary
        const summaryRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/v_instance_affected_summary?select=*&instance_id=eq.${id}`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
          }
        );
        const summaryJson = await summaryRes.json();
        setSummary(summaryJson[0] || null);

        // GeoJSON data
        const geoRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/v_instance_admin_scores_geojson?select=*&instance_id=eq.${id}`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
          }
        );
        const geoJson = await geoRes.json();
        setFeatures(geoJson || []);
      } catch (e) {
        console.error("Error loading data:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params?.id]);

  // Initialize map and draw polygons
  useEffect(() => {
    if (loading || !mapRef.current) return;

    const map = mapRef.current;
    map.eachLayer((layer: any) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    const layerGroup = L.geoJSON(
      features.map((f) => f.geojson),
      {
        style: (feature: any) => ({
          color: "#555",
          weight: 1,
          fillColor: getColor(feature?.properties?.score),
          fillOpacity: 0.6,
        }),
        onEachFeature: (feature: any, layer: any) => {
          layer.bindTooltip(
            `${feature.properties.admin_name}<br><strong>Score:</strong> ${Number(feature.properties.score).toFixed(2)}`,
            { direction: "top" }
          );
        },
      }
    ).addTo(map);

    // Fit map to bounds of affected features
    const bounds = layerGroup.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [features, loading]);

  // Create map
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

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cebu EQ–Typhoon</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-gray-500">Total Areas</p>
          <p className="text-2xl font-semibold">
            {summary ? summary.total_areas.toLocaleString() : "-"}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-gray-500">Min Score</p>
          <p className="text-2xl font-semibold">
            {summary ? Number(summary.min_score).toFixed(2) : "-"}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-gray-500">Max Score</p>
          <p className="text-2xl font-semibold">
            {summary ? Number(summary.max_score).toFixed(2) : "-"}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-gray-500">Average Score</p>
          <p className="text-2xl font-semibold">
            {summary ? Number(summary.avg_score).toFixed(2) : "-"}
          </p>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-2">
          <Button className="bg-blue-600 hover:bg-blue-700">Define Affected Area</Button>
          <Button className="bg-green-600 hover:bg-green-700">Configure Datasets</Button>
          <Button className="bg-orange-600 hover:bg-orange-700">Calibrate Scores</Button>
          <Button className="bg-gray-800 hover:bg-gray-900">Recompute Scores</Button>
        </div>

        <div className="flex-1">
          <MapContainer />
        </div>
      </div>
    </div>
  );
};

export default Page;
