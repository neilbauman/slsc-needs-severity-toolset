"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import InstanceDatasetConfigModal from "@/components/InstanceDatasetConfigModal";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";

export default function InstancePage() {
  const { id } = useParams();
  const instanceId = id as string;

  const [instance, setInstance] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const mapRef = useRef<any>(null);

  // ✅ Load instance metadata
  useEffect(() => {
    const loadInstance = async () => {
      const { data, error } = await supabase
        .from("instances")
        .select("*")
        .eq("id", instanceId)
        .single();
      if (error) console.error("Error loading instance:", error);
      setInstance(data);
    };
    loadInstance();
  }, [instanceId]);

  // ✅ Load affected areas using confirmed schema
  useEffect(() => {
    const loadAffectedAreas = async () => {
      const { data, error } = await supabase
        .from("v_instance_affected_adm3")
        .select(
          "instance_id, dataset_id, admin_pcode, admin_name, geom, score"
        )
        .eq("instance_id", instanceId);

      if (error) {
        console.error("Error loading affected areas:", error);
        return;
      }

      const feats = (data || [])
        .map((r: any) => {
          try {
            const geom =
              typeof r.geom === "string" ? JSON.parse(r.geom) : r.geom;
            return {
              type: "Feature",
              geometry: geom,
              properties: {
                admin_pcode: r.admin_pcode,
                admin_name: r.admin_name,
                dataset_id: r.dataset_id,
                score: r.score,
              },
            };
          } catch (e) {
            console.error("Invalid geom:", e);
            return null;
          }
        })
        .filter(Boolean);

      setFeatures(feats);

      // ✅ Zoom to affected area
      if (feats.length && mapRef.current) {
        const bounds = L.geoJSON(feats).getBounds();
        mapRef.current.fitBounds(bounds);
      }
    };

    loadAffectedAreas();
  }, [instanceId]);

  const getColor = (score: number) => {
    if (score > 4) return "#d73027";
    if (score > 3) return "#fc8d59";
    if (score > 2) return "#fee08b";
    if (score > 1) return "#d9ef8b";
    return "#91cf60";
  };

  if (!instance) return <p className="p-6 text-gray-500">Loading...</p>;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">
          {instance.name}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Configure Datasets
          </button>
          <button
            onClick={() => location.reload()}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          >
            Refresh Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 rounded-lg overflow-hidden border border-gray-200">
          <MapContainer
            center={[12.8797, 121.774]} // Philippines center
            zoom={6}
            style={{ height: "70vh", width: "100%" }}
            whenReady={(e) => (mapRef.current = e.target)}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {features.map((f: any, idx: number) => (
              <GeoJSON
                key={idx}
                data={f}
                style={{
                  color: "black",
                  weight: 0.5,
                  fillOpacity: 0.7,
                  fillColor: getColor(f.properties.score || 0),
                }}
              />
            ))}
          </MapContainer>
        </div>

        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <h3 className="text-md font-semibold text-gray-700 mb-2">
            Score Layers
          </h3>
          <ScoreLayerSelector instanceId={instanceId} />
        </div>
      </div>

      {showConfigModal && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowConfigModal(false)}
          onSaved={async () => {
            setShowConfigModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
