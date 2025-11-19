"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";
import InstanceDatasetConfigModal from "@/components/InstanceDatasetConfigModal";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import("react-leaflet").then(m => m.GeoJSON), { ssr: false });

export default function InstancePage() {
  const { id } = useParams();
  const [instance, setInstance] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<any | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    const loadInstance = async () => {
      const { data, error } = await supabase.from("instances").select("*").eq("id", id).single();
      if (!error && data) setInstance(data);
    };

    const loadFeatures = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("v_instance_affected_adm3")
        .select("geom, admin_pcode, admin_name, score, dataset_id")
        .eq("instance_id", id);
      if (!error && data) {
        setFeatures(data);
        if (data.length && mapRef.current) {
          const geojson = {
            type: "FeatureCollection",
            features: data.map((f: any) => ({
              type: "Feature",
              geometry: f.geom,
              properties: f,
            })),
          } as GeoJSON.FeatureCollection;
          const bounds = L.geoJSON(geojson).getBounds();
          mapRef.current.fitBounds(bounds);
        }
      }
      setLoading(false);
    };

    loadInstance();
    loadFeatures();
  }, [id]);

  const getColor = (score: number) => {
    if (score >= 4.5) return "#006400";
    if (score >= 3.5) return "#66A80F";
    if (score >= 2.5) return "#FFD43B";
    if (score >= 1.5) return "#FF922B";
    return "#C92A2A";
  };

  if (loading) return <div className="p-4 text-sm text-gray-600">Loading instance...</div>;
  if (!instance) return <div className="p-4 text-sm text-gray-600">Instance not found.</div>;

  return (
    <div className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{instance.name}</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Configure Datasets
          </button>
        </div>
      </div>

      <div className="flex space-x-4">
        <div className="flex-1">
          <MapContainer
            center={[12.8797, 121.774]}
            zoom={6}
            style={{ height: "70vh", width: "100%" }}
            whenCreated={(mapInstance: any) => {
              mapRef.current = mapInstance;
            }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {features.length > 0 && (
              <GeoJSON
                data={{
                  type: "FeatureCollection",
                  features: features.map((f) => ({
                    type: "Feature",
                    geometry: f.geom,
                    properties: f,
                  })),
                } as GeoJSON.FeatureCollection}
                style={(feature: any) => ({
                  color: getColor(feature.properties.score),
                  weight: 1,
                  fillOpacity: 0.6,
                })}
              />
            )}
          </MapContainer>
        </div>

        <div className="w-72 border rounded p-2 bg-white shadow-sm text-sm overflow-y-auto max-h-[70vh]">
          <ScoreLayerSelector instanceId={id as string} onSelect={setSelectedDataset} />
        </div>
      </div>

      {showConfigModal && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowConfigModal(false)}
          onSaved={async () => {
            setShowConfigModal(false);
          }}
        />
      )}
    </div>
  );
}
