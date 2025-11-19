"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";
import InstanceDatasetConfigModal from "@/components/InstanceDatasetConfigModal";

// ✅ Dynamic imports for react-leaflet
const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import("react-leaflet").then(m => m.GeoJSON), { ssr: false });

export default function InstancePage({ params }: { params: { id: string } }) {
  const instanceId = params.id;
  const [instance, setInstance] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<any | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<any>(null);

  // Load instance
  useEffect(() => {
    const loadInstance = async () => {
      const { data } = await supabase.from("instances").select("*").eq("id", instanceId).single();
      if (data) setInstance(data);
    };
    loadInstance();
  }, [instanceId]);

  // Load affected area geometries
  useEffect(() => {
    const loadAffected = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("v_instance_affected_areas")
        .select("geojson")
        .eq("instance_id", instanceId);
      if (error) {
        console.error("Error loading affected areas:", error);
        setLoading(false);
        return;
      }
      if (data) {
        const feats = data.map((r: any) => JSON.parse(r.geojson));
        setFeatures(feats);
      }
      setLoading(false);
    };
    loadAffected();
  }, [instanceId]);

  // Auto-zoom map to affected area
  useEffect(() => {
    if (mapRef.current && features.length > 0) {
      const L = require("leaflet");
      const group = L.featureGroup(features.map((f: any) => L.geoJSON(f)));
      mapRef.current.fitBounds(group.getBounds());
    }
  }, [features]);

  // Load dataset list for ScoreLayerSelector
  useEffect(() => {
    const loadDatasets = async () => {
      const { data, error } = await supabase
        .from("v_dataset_scores")
        .select("dataset_id, dataset_name, category")
        .eq("instance_id", instanceId)
        .order("category, dataset_name");
      if (!error && data) setDatasets(data);
    };
    loadDatasets();
  }, [instanceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh] text-gray-500 text-sm">
        Loading map and data...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex justify-between items-center p-2 border-b text-sm">
        <h1 className="font-semibold text-gray-800">
          {instance?.name || "Instance"} Overview
        </h1>
        <button
          onClick={() => setShowConfigModal(true)}
          className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-100"
        >
          Configure Datasets
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={[12.8797, 121.7740]}
            zoom={6}
            style={{ height: "100%", width: "100%" }}
            whenReady={(event) => {
              mapRef.current = event.target;
            }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {features.map((f: any, idx: number) => (
              <GeoJSON
                key={idx}
                data={f}
                style={(feature: any) => ({
                  color: "black",
                  weight: 0.5,
                  fillOpacity: 0.8,
                  fillColor: feature?.properties?.score
                    ? getColor(feature.properties.score)
                    : "#cccccc",
                })}
              />
            ))}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div className="w-64 border-l p-2 text-xs bg-white overflow-y-auto">
          <h3 className="font-semibold mb-2 text-gray-700">Score Layers</h3>
          <ScoreLayerSelector
            instanceId={instanceId}
            onSelect={(dataset) => setSelectedDataset(dataset)}
          />
        </div>
      </div>

      {/* Dataset Config Modal */}
      {showConfigModal && instance && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowConfigModal(false)}
          onSaved={async () => {
            setShowConfigModal(false);
            const { data } = await supabase
              .from("v_dataset_scores")
              .select("dataset_id, dataset_name, category")
              .eq("instance_id", instanceId)
              .order("category, dataset_name");
            if (data) setDatasets(data);
          }}
        />
      )}
    </div>
  );
}

// Color scale 1–5
function getColor(score: number) {
  if (score <= 1) return "#2ECC71";
  if (score <= 2) return "#A3E048";
  if (score <= 3) return "#FFD93B";
  if (score <= 4) return "#FF9F43";
  return "#E74C3C";
}
