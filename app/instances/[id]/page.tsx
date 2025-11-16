"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import InstanceDatasetConfigModal from "@/components/InstanceDatasetConfigModal";
import DefineAffectedAreaModal from "@/components/DefineAffectedAreaModal";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import("react-leaflet").then(m => m.GeoJSON), { ssr: false });

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);

  // Load instance metadata
  useEffect(() => {
    const loadInstance = async () => {
      const { data, error } = await supabase
        .from("instances")
        .select("*")
        .eq("id", params.id)
        .single();
      if (error) console.error("Error loading instance:", error);
      setInstance(data);
    };
    loadInstance();
  }, [params.id]);

  // Load scored data
  useEffect(() => {
    if (!instance) return;
    const loadScores = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("scored_instance_values")
        .select("pcode, score")
        .eq("instance_id", instance.id);
      if (error) {
        console.error("Error loading scores:", error);
        setLoading(false);
        return;
      }
      setScores(data || []);
      setLoading(false);
    };
    loadScores();
  }, [instance]);

  const colorForScore = (score: number) => {
    if (score === null || score === undefined) return "#ccc";
    if (score <= 1) return "#00b050";
    if (score <= 2) return "#92d050";
    if (score <= 3) return "#ffff00";
    if (score <= 4) return "#ffc000";
    return "#ff0000";
  };

  // Render polygons
  const [features, setFeatures] = useState<any[]>([]);

  useEffect(() => {
    const loadGeoms = async () => {
      if (!instance?.admin_scope) return;

      const adm2Or3 = instance.admin_scope[instance.admin_scope.length - 1];
      const { data, error } = await supabase
        .from("admin_boundaries")
        .select("admin_pcode, name, geom_json")
        .eq("parent_pcode", adm2Or3);

      if (error) {
        console.error("Error loading geoms:", error);
        return;
      }

      const joined = data.map((d: any) => ({
        ...d,
        score: scores.find((s) => s.pcode === d.admin_pcode)?.score ?? null,
      }));

      setFeatures(joined);
    };
    loadGeoms();
  }, [instance, scores]);

  return (
    <div className="p-6 space-y-4">
      {instance && (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold">{instance.name}</h1>
              <p className="text-gray-600 text-sm">{instance.description || "description"}</p>
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 border rounded bg-gray-100 hover:bg-gray-200"
                onClick={() => setShowAreaModal(true)}
              >
                Define Affected Area
              </button>
              <button
                className="px-4 py-2 border rounded bg-gray-100 hover:bg-gray-200"
                onClick={() => setShowConfig(true)}
              >
                Configure Datasets
              </button>
              <button
                className="px-4 py-2 border rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={async () => {
                  await supabase.rpc("score_instance_overall", { in_instance: instance.id });
                  const { data, error } = await supabase
                    .from("scored_instance_values")
                    .select("pcode, score")
                    .eq("instance_id", instance.id);
                  if (!error) setScores(data || []);
                }}
              >
                Recompute Scores
              </button>
              <button
                className="px-4 py-2 border rounded bg-gray-100 hover:bg-gray-200"
                onClick={() => history.back()}
              >
                Back
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-lg shadow-sm p-4">
            <h2 className="font-semibold mb-2">Geographic Overview</h2>
            {loading ? (
              <p>Loading map data...</p>
            ) : (
              <MapContainer
                center={[10.3, 123.9]}
                zoom={8}
                style={{ height: "600px", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {features.map((f, i) => {
                  let geom;
                  try {
                    geom = JSON.parse(f.geom_json);
                  } catch {
                    return null;
                  }
                  return (
                    <GeoJSON
                      key={i}
                      data={geom}
                      style={{
                        color: "#333",
                        weight: 0.5,
                        fillOpacity: 0.8,
                        fillColor: colorForScore(f.score),
                      }}
                    />
                  );
                })}
              </MapContainer>
            )}
          </div>
        </>
      )}

      {showConfig && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowConfig(false)}
          onSaved={async () => {
            const { data, error } = await supabase
              .from("scored_instance_values")
              .select("pcode, score")
              .eq("instance_id", instance.id);
            if (!error) setScores(data || []);
          }}
        />
      )}

      {showAreaModal && (
        <DefineAffectedAreaModal
          instance={instance}
          onClose={() => setShowAreaModal(false)}
          onSaved={async () => {
            // reload geometry and scores after area change
            const { data, error } = await supabase
              .from("scored_instance_values")
              .select("pcode, score")
              .eq("instance_id", instance.id);
            if (!error) setScores(data || []);
          }}
        />
      )}
    </div>
  );
}
