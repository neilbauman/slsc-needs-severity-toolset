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
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [topAreas, setTopAreas] = useState<any[]>([]);

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

  // Load instance scores
  useEffect(() => {
    if (!instance) return;
    const loadScores = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("scored_instance_values")
        .select("pcode, score")
        .eq("instance_id", instance.id);
      if (error) console.error("Error loading scores:", error);
      setScores(data || []);
      setLoading(false);
    };
    loadScores();
  }, [instance]);

  // Map color scale
  const colorForScore = (score: number | null) => {
    if (score === null || score === undefined) return "#ccc";
    if (score <= 1) return "#00b050";
    if (score <= 2) return "#92d050";
    if (score <= 3) return "#ffff00";
    if (score <= 4) return "#ffc000";
    return "#ff0000";
  };

  // Load geometry for affected admin units
  useEffect(() => {
    const loadGeoms = async () => {
      if (!instance?.admin_scope?.length) return;
      const admScope = instance.admin_scope[instance.admin_scope.length - 1];

      const { data, error } = await supabase.rpc("get_admin_geoms", {
        in_parent_pcode: admScope,
      });

      if (error) {
        console.error("Error loading geoms:", error);
        return;
      }

      const joined = (data || []).map((d: any) => ({
        ...d,
        score: scores.find((s) => s.pcode === d.admin_pcode)?.score ?? null,
      }));

      setFeatures(joined);
    };
    loadGeoms();
  }, [instance, scores]);

  // Recompute scores (aggregate)
  const recomputeScores = async () => {
    const { error } = await supabase.rpc("score_instance_overall", { in_instance: instance.id });
    if (error) console.error("Error recomputing scores:", error);
    else {
      const { data } = await supabase
        .from("scored_instance_values")
        .select("pcode, score")
        .eq("instance_id", instance.id);
      setScores(data || []);
    }
  };

  // Load summary analytics
  useEffect(() => {
    if (!instance) return;
    const loadSummary = async () => {
      try {
        // Find population dataset dynamically
        const { data: popDataset } = await supabase
          .from("datasets")
          .select("id")
          .ilike("name", "%population%")
          .limit(1)
          .maybeSingle();

        let population_total = 0;
        if (popDataset?.id) {
          const { data: popVals } = await supabase
            .from("dataset_values_numeric")
            .select("value")
            .eq("dataset_id", popDataset.id);
          population_total = popVals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
        }

        // Load all scored values for the instance
        const { data: scored } = await supabase
          .from("scored_instance_values")
          .select("pcode, score")
          .eq("instance_id", instance.id);

        const avg_score =
          scored && scored.length
            ? scored.reduce((a, b) => a + (b.score || 0), 0) / scored.length
            : 0;

        const people_concern = Math.round(population_total * (avg_score / 5) * 0.5);
        const people_need = Math.round(population_total * (avg_score / 5));

        setSummary({
          population_total,
          avg_score,
          people_concern,
          people_need,
        });

        const { data: top } = await supabase
          .from("scored_instance_values")
          .select("pcode, score")
          .eq("instance_id", instance.id)
          .order("score", { ascending: false })
          .limit(5);
        setTopAreas(top || []);
      } catch (err) {
        console.error("Error loading summary:", err);
      }
    };
    loadSummary();
  }, [instance, scores]);

  return (
    <div className="p-6 space-y-4">
      {instance && (
        <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold">{instance.name}</h1>
              <p className="text-gray-600 text-sm">
                {instance.description || "description"}
              </p>
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
                onClick={recomputeScores}
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

          {/* Map */}
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
                    geom = f.geom_json;
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

          {/* Summary Section */}
          <div className="bg-white border rounded-lg shadow-sm p-4 mt-6">
            <h2 className="font-semibold mb-2">Summary Analytics</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 bg-gray-50 rounded text-center">
                <p className="text-xs text-gray-500 uppercase">Total Population</p>
                <p className="text-lg font-semibold">
                  {summary?.population_total?.toLocaleString() ?? "—"}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded text-center">
                <p className="text-xs text-gray-500 uppercase">People of Concern</p>
                <p className="text-lg font-semibold text-red-600">
                  {summary?.people_concern?.toLocaleString() ?? "—"}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded text-center">
                <p className="text-xs text-gray-500 uppercase">People in Need</p>
                <p className="text-lg font-semibold text-orange-600">
                  {summary?.people_need?.toLocaleString() ?? "—"}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded text-center">
                <p className="text-xs text-gray-500 uppercase">Average Severity</p>
                <p className="text-lg font-semibold text-blue-600">
                  {summary?.avg_score?.toFixed(2) ?? "—"}
                </p>
              </div>
            </div>

            <h3 className="font-medium mb-2">Most Affected Areas</h3>
            <table className="w-full text-sm border">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-2">Area</th>
                  <th className="p-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {topAreas?.length ? (
                  topAreas.map((a, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="p-2">{a.pcode}</td>
                      <td className="p-2 text-right font-medium text-red-600">
                        {a.score?.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="p-2 text-center text-gray-500">
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modals */}
      {showConfig && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowConfig(false)}
          onSaved={recomputeScores}
        />
      )}

      {showAreaModal && (
        <DefineAffectedAreaModal
          instance={instance}
          onClose={() => setShowAreaModal(false)}
          onSaved={recomputeScores}
        />
      )}
    </div>
  );
}
