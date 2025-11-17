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
  const [categories, setCategories] = useState<any[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

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

  // Load scores
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

  // Color scale
  const colorForScore = (score: number | null) => {
    if (score === null || score === undefined) return "#ccc";
    if (score <= 1) return "#00b050";
    if (score <= 2) return "#92d050";
    if (score <= 3) return "#ffff00";
    if (score <= 4) return "#ffc000";
    return "#ff0000";
  };

  // Load geometries
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

  // Recompute scores
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

  // Load summary analytics + category breakdown
  useEffect(() => {
    if (!instance) return;
    const loadSummary = async () => {
      try {
        // 1️⃣ Population data
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

        // 2️⃣ Load all scores
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

        // 3️⃣ Top affected areas with admin names
        const { data: top } = await supabase
          .from("scored_instance_values")
          .select(`
            pcode,
            score,
            admin_boundaries!inner(name, parent_pcode)
          `)
          .eq("instance_id", instance.id)
          .order("score", { ascending: false })
          .limit(5);
        setTopAreas(top || []);

        // 4️⃣ Category breakdown with datasets and metrics
        const { data: datasetScores } = await supabase
          .from("scored_instance_values")
          .select(`
            score,
            dataset_id,
            datasets(id, name, category, type)
          `)
          .eq("instance_id", instance.id);

        if (datasetScores?.length) {
          const grouped = datasetScores.reduce((acc: any, row: any) => {
            const cat = row.datasets?.category || "Uncategorized";
            if (!acc[cat]) acc[cat] = {};
            const ds = row.datasets?.name || "Unnamed Dataset";
            if (!acc[cat][ds]) acc[cat][ds] = [];
            acc[cat][ds].push(row.score || 0);
            return acc;
          }, {});

          const result = Object.keys(grouped).map((cat) => ({
            category: cat,
            datasets: Object.keys(grouped[cat]).map((ds) => {
              const scores = grouped[cat][ds];
              const valid = scores.filter((s: any) => s !== null);
              const avg = valid.length
                ? valid.reduce((a: number, b: number) => a + b, 0) / valid.length
                : null;
              return {
                name: ds,
                avg,
                min: valid.length ? Math.min(...valid) : null,
                max: valid.length ? Math.max(...valid) : null,
                count: valid.length,
              };
            }),
          }));

          // Sort by known SSC order
          const order = [
            "SSC Framework - P1",
            "SSC Framework - P2",
            "SSC Framework - P3",
            "Hazard",
            "Underlying Vulnerability",
            "Uncategorized",
          ];

          result.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
          setCategories(result);
        }
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

          {/* Summary */}
          <div className="bg-white border rounded-lg shadow-sm p-4 mt-6">
            <h2 className="font-semibold mb-2">Summary Analytics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <SummaryCard title="Total Population" value={summary?.population_total} />
              <SummaryCard title="People of Concern" value={summary?.people_concern} color="text-red-600" />
              <SummaryCard title="People in Need" value={summary?.people_need} color="text-orange-600" />
              <SummaryCard title="Average Severity" value={summary?.avg_score?.toFixed(2)} color="text-blue-600" />
            </div>

            {/* Most Affected Areas */}
            <h3 className="font-medium mb-2">Most Affected Areas</h3>
            <table className="w-full text-sm border mb-6">
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
                      <td className="p-2">
                        <span className="font-medium">{a.admin_boundaries?.name}</span>
                        <br />
                        <span className="text-xs text-gray-500">{a.pcode}</span>
                      </td>
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

            {/* Category Breakdown */}
            <h3 className="font-medium mb-2">Category Breakdown</h3>
            <div className="space-y-3">
              {categories.map((cat, i) => (
                <div key={i} className="border rounded-md">
                  <div
                    className="flex justify-between items-center bg-gray-100 px-3 py-2 cursor-pointer hover:bg-gray-200"
                    onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}
                  >
                    <span className="font-semibold">{cat.category}</span>
                    <span className="text-sm text-blue-600">
                      {(
                        cat.datasets.reduce((a, d) => a + (d.avg || 0), 0) /
                        (cat.datasets.length || 1)
                      ).toFixed(2)}
                    </span>
                  </div>
                  {expandedCategory === cat.category && (
                    <table className="w-full text-sm border-t">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left">Dataset</th>
                          <th className="p-2 text-right">Min</th>
                          <th className="p-2 text-right">Avg</th>
                          <th className="p-2 text-right">Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.datasets.map((ds, j) => (
                          <tr key={j} className="border-t hover:bg-gray-50">
                            <td className="p-2">{ds.name}</td>
                            <td className="p-2 text-right">{ds.min?.toFixed(2) ?? "—"}</td>
                            <td className="p-2 text-right text-blue-600">{ds.avg?.toFixed(2) ?? "—"}</td>
                            <td className="p-2 text-right">{ds.max?.toFixed(2) ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

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

// Small reusable summary card
function SummaryCard({ title, value, color }: { title: string; value: any; color?: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded text-center">
      <p className="text-xs text-gray-500 uppercase">{title}</p>
      <p className={`text-lg font-semibold ${color || ""}`}>
        {value ? value.toLocaleString() : "—"}
      </p>
    </div>
  );
}
