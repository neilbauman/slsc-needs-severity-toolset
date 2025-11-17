"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import InstanceDatasetConfigModal from "@/components/InstanceDatasetConfigModal";
import DefineAffectedAreaModal from "@/components/DefineAffectedAreaModal";
import InstanceScoringModal from "@/components/InstanceScoringModal";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import("react-leaflet").then(m => m.GeoJSON), { ssr: false });

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [geoData, setGeoData] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [showArea, setShowArea] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [zoomLocked, setZoomLocked] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInstance = async () => {
      const { data, error } = await supabase
        .from("instances")
        .select("*")
        .eq("id", params.id)
        .single();
      if (!error) setInstance(data);
    };
    loadInstance();
  }, [params.id]);

  useEffect(() => {
    if (!instance) return;
    const loadGeo = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("v_instance_admin_scores_geojson")
        .select("*")
        .eq("instance_id", instance.id);
      if (!error) setGeoData(data || []);
      setLoading(false);
    };
    loadGeo();
  }, [instance]);

  useEffect(() => {
    if (!instance) return;
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("v_category_scores")
        .select("*")
        .eq("instance_id", instance.id);
      if (!error) setCategories(data || []);
    };
    loadCategories();
  }, [instance]);

  const recomputeScores = async () => {
    if (!instance) return;
    await supabase.rpc("score_instance_overall", { in_instance_id: instance.id });
    const { data } = await supabase
      .from("v_instance_admin_scores_geojson")
      .select("*")
      .eq("instance_id", instance.id);
    setGeoData(data || []);
  };

  const orderedCats = ["SSC Framework - P1", "SSC Framework - P2", "SSC Framework - P3", "Hazard", "Underlying Vulnerability"];

  return (
    <div className="p-4 space-y-4 text-sm">
      {instance && (
        <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-semibold">{instance.name}</h1>
              <p className="text-gray-600">{instance.description || "No description available."}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowArea(true)} className="px-3 py-1.5 border rounded bg-gray-100 hover:bg-gray-200">
                Define Affected Area
              </button>
              <button onClick={() => setShowConfig(true)} className="px-3 py-1.5 border rounded bg-gray-100 hover:bg-gray-200">
                Configure Datasets
              </button>
              <button onClick={() => setShowCalibration(true)} className="px-3 py-1.5 border rounded bg-gray-100 hover:bg-gray-200">
                Calibration
              </button>
              <button onClick={recomputeScores} className="px-3 py-1.5 border rounded bg-blue-600 text-white hover:bg-blue-700">
                Recompute Scores
              </button>
              <button onClick={() => history.back()} className="px-3 py-1.5 border rounded bg-gray-100 hover:bg-gray-200">
                Back
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 text-center bg-white border rounded p-3 shadow-sm">
            <div>
              <p className="text-gray-500 text-xs">Average Score</p>
              <p className="text-lg font-bold text-blue-700">
                {geoData.length ? (geoData.reduce((a, b) => a + (b.avg_score || 0), 0) / geoData.length).toFixed(2) : "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Areas Evaluated</p>
              <p className="text-lg font-bold text-blue-700">{geoData.length}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Top Score</p>
              <p className="text-lg font-bold text-blue-700">
                {geoData.length ? Math.max(...geoData.map(d => d.avg_score)).toFixed(2) : "—"}
              </p>
            </div>
          </div>

          {/* Map */}
          <div className="bg-white border rounded shadow-sm p-3 relative">
            <div className="flex justify-between items-center mb-1">
              <h2 className="font-semibold text-sm">Geographic Overview</h2>
              <button
                onClick={() => setZoomLocked(z => !z)}
                className="text-xs text-blue-600 hover:underline"
              >
                {zoomLocked ? "Unlock Zoom" : "Lock Zoom"}
              </button>
            </div>
            {loading ? (
              <p>Loading map…</p>
            ) : (
              <MapContainer
                center={[12.8797, 121.774]}
                zoom={6}
                style={{ height: "500px", width: "100%" }}
                scrollWheelZoom={!zoomLocked}
                doubleClickZoom={!zoomLocked}
                dragging={!zoomLocked}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {geoData.map((f, i) => (
                  <GeoJSON
                    key={i}
                    data={f.geometry}
                    style={{
                      color: "#333",
                      weight: 0.4,
                      fillOpacity: 0.7,
                      fillColor: f.color_hex || "#ccc",
                    }}
                  />
                ))}
              </MapContainer>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="bg-white border rounded shadow-sm p-3">
            <h2 className="font-semibold mb-2 text-sm">Category Breakdown</h2>
            <div className="grid grid-cols-2 gap-2">
              {orderedCats.map(cat => {
                const catData = categories.filter(c => c.pillar_name === cat);
                if (!catData.length) return null;
                const avg = catData.reduce((a, b) => a + (b.pillar_score || 0), 0) / catData.length;
                return (
                  <div key={cat} className="border rounded p-2">
                    <p className="font-medium text-xs mb-1">{cat}</p>
                    <p className="text-sm text-blue-700 font-semibold">{avg.toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Most Affected Areas */}
          <div className="bg-white border rounded shadow-sm p-3">
            <h2 className="font-semibold mb-2 text-sm">Most Affected Areas</h2>
            {geoData
              .sort((a, b) => b.avg_score - a.avg_score)
              .slice(0, 5)
              .map((d, i) => (
                <div key={i} className="flex justify-between text-xs border-b py-1">
                  <span>{d.name}</span>
                  <span className="font-semibold text-blue-700">{d.avg_score?.toFixed(2)}</span>
                </div>
              ))}
            {geoData.length > 5 && (
              <button
                onClick={() =>
                  alert("Future: show full list or modal with all affected areas")
                }
                className="text-xs text-blue-600 mt-2 hover:underline"
              >
                Show more
              </button>
            )}
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
      {showArea && (
        <DefineAffectedAreaModal
          instance={instance}
          onClose={() => setShowArea(false)}
          onSaved={recomputeScores}
        />
      )}
      {showCalibration && (
        <InstanceScoringModal
          instance={instance}
          onClose={() => setShowCalibration(false)}
          onSaved={recomputeScores}
        />
      )}
    </div>
  );
}
