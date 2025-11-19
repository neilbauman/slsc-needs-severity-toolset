'use client';

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<L.Map | null>(null);

  const categories = [
    "SSC Framework P1",
    "SSC Framework P2",
    "SSC Framework P3",
    "Hazards",
    "Underlying Vulnerability",
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch instance summary
        const { data: instanceData, error: instanceError } = await supabase
          .from("v_instance_affected_summary")
          .select("*")
          .eq("instance_id", params.id)
          .single();

        if (instanceError) throw instanceError;
        setInstance(instanceData);

        // Fetch datasets from new view
        const { data: dsData, error: dsError } = await supabase
          .from("v_instance_datasets_view")
          .select("*")
          .eq("instance_id", params.id);

        if (dsError) throw dsError;
        setDatasets(dsData || []);

        // Fetch affected area geojson
        const { data: geoData, error: geoError } = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("geojson")
          .eq("instance_id", params.id);

        if (geoError) throw geoError;

        const parsed = geoData.map((g: any) => JSON.parse(g.geojson));
        setFeatures(parsed);

        // Zoom map to affected area
        if (mapRef.current && parsed.length > 0) {
          const bounds = L.geoJSON(parsed).getBounds();
          mapRef.current.fitBounds(bounds);
        }
      } catch (err) {
        console.error("Error loading instance page:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  const getColor = (score: number) => {
    if (score <= 1) return "#00FF00"; // green
    if (score <= 2) return "#CCFF00"; // yellow-green
    if (score <= 3) return "#FFCC00"; // yellow
    if (score <= 4) return "#FF6600"; // orange
    return "#FF0000"; // red
  };

  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties && feature.properties.score !== undefined) {
      const color = getColor(Math.round(feature.properties.score));
      layer.setStyle({ color, fillColor: color, fillOpacity: 0.6 });
      layer.bindPopup(
        `${feature.properties.admin_name}: ${feature.properties.score.toFixed(2)}`
      );
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="flex p-2 space-x-2 text-sm">
      <div className="flex-1 border rounded-lg overflow-hidden">
        <MapContainer
          center={[12.8797, 121.774]} // Philippines center
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

      <div className="w-72 space-y-2">
        <div className="space-y-1">
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-sm">
            Adjust Scoring
          </button>
          <button className="w-full bg-green-600 hover:bg-green-700 text-white py-1 rounded text-sm">
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
                      Dataset {d.dataset_id}
                    </div>
                  ))
              ) : (
                <div className="text-gray-400 italic text-xs ml-2">No datasets</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
