'use client';

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";
import InstanceDatasetConfigModal from "./InstanceDatasetConfigModal";

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const categories = [
    "SSC Framework P1",
    "SSC Framework P2",
    "SSC Framework P3",
    "Hazards",
    "Underlying Vulnerability",
  ];

  // ✅ Load instance, datasets, and geojson
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Instance info
        const { data: instanceData, error: instErr } = await supabase
          .from("instances")
          .select("*")
          .eq("id", params.id)
          .single();
        if (instErr) throw instErr;
        setInstance(instanceData);

        // Dataset configs
        const { data: dsData, error: dsErr } = await supabase
          .from("v_instance_datasets_view")
          .select("*")
          .eq("instance_id", params.id);
        if (dsErr) throw dsErr;
        setDatasets(dsData || []);

        // GeoJSONs
        const { data: geoData, error: geoErr } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("geojson")
          .eq("instance_id", params.id);
        if (geoErr) throw geoErr;

        // ✅ Defensive parsing
        const parsed = (geoData || [])
          .map((g: any) => {
            try {
              if (!g.geojson) return null;
              if (typeof g.geojson === "string") return JSON.parse(g.geojson);
              if (typeof g.geojson === "object") return g.geojson;
              return null;
            } catch (err) {
              console.warn("Invalid geojson record:", g, err);
              return null;
            }
          })
          .filter(Boolean);

        setFeatures(parsed);

        // ✅ Zoom map to affected area (delay ensures render)
        setTimeout(() => {
          if (mapRef.current && parsed.length > 0) {
            const bounds = L.geoJSON(parsed).getBounds();
            if (bounds.isValid()) {
              mapRef.current.fitBounds(bounds, { padding: [20, 20] });
            }
          }
        }, 400);
      } catch (err) {
        console.error("Error loading instance page:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  const getColor = (score: number) => {
    if (score <= 1) return "#00FF00";
    if (score <= 2) return "#CCFF00";
    if (score <= 3) return "#FFCC00";
    if (score <= 4) return "#FF6600";
    return "#FF0000";
  };

  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties?.score !== undefined) {
      const score = Math.round(feature.properties.score);
      const color = getColor(score);
      layer.setStyle({
        color,
        fillColor: color,
        fillOpacity: 0.6,
        weight: 1,
      });
      layer.bindPopup(
        `${feature.properties.admin_name}: ${feature.properties.score.toFixed(2)}`
      );
    }
  };

  const handleConfigSaved = async () => {
    setShowConfig(false);
    const { data: dsData } = await supabase
      .from("v_instance_datasets_view")
      .select("*")
      .eq("instance_id", params.id);
    setDatasets(dsData || []);
  };

  if (loading) return <div className="p-4 text-sm">Loading instance data…</div>;

  return (
    <div className="flex p-2 space-x-2 text-sm">
      {/* Map Section */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        <MapContainer
          center={[12.8797, 121.774]}
          zoom={6}
          style={{ height: "80vh", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {features.map((f, idx) => (
            <GeoJSON key={idx} data={f} onEachFeature={onEachFeature} />
          ))}
        </MapContainer>
      </div>

      {/* Right Panel */}
      <div className="w-72 space-y-2">
        <div className="space-y-1">
          <button
            onClick={() => setShowConfig(true)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-1 rounded text-sm"
          >
            Configure Datasets
          </button>
          <button className="w-full bg-blue-700 hover:bg-blue-800 text-white py-1 rounded text-sm">
            Adjust Scoring
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-1 rounded text-sm"
          >
            Refresh Data
          </button>
        </div>

        <div className="mt-2 border-t pt-2">
          <h3 className="font-semibold mb-1">Score Layers</h3>
          {categories.map((cat) => (
            <div key={cat} className="mb-2">
              <div className="font-medium">{cat}</div>
              {datasets.filter((d) => d.score_config?.category === cat).length > 0 ? (
                datasets
                  .filter((d) => d.score_config?.category === cat)
                  .map((d) => (
                    <div key={d.id} className="text-gray-700 ml-2">
                      {d.name}
                    </div>
                  ))
              ) : (
                <div className="text-gray-400 italic text-xs ml-2">
                  No datasets
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dataset Config Modal */}
      {showConfig && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowConfig(false)}
          onSaved={handleConfigSaved}
        />
      )}
    </div>
  );
}
