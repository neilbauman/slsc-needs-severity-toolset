"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";

// Modal imports
import DefineAffectedAreaModal from "@/components/DefineAffectedAreaModal";
import InstanceDatasetConfigModal from "@/components/InstanceDatasetConfigModal";
import InstanceScoringModal from "@/components/InstanceScoringModal";
import FrameworkScoringModal from "@/components/FrameworkScoringModal";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface AreaRow {
  admin_pcode: string;
  name: string;
  score?: number | null;
  geom_json: any;
}

interface Stats {
  affected: number;
  avg: string | number;
  min: string | number;
  max: string | number;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function InstancePage() {
  const { id } = useParams();
  const [adm3, setAdm3] = useState<AreaRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    affected: 0,
    avg: "-",
    min: "-",
    max: "-",
  });
  const [layerType, setLayerType] = useState<"overall" | "dataset" | "category">("overall");
  const [selectedLayer, setSelectedLayer] = useState<string>("overall");
  const [loading, setLoading] = useState(false);

  // Modal controls (local fallback)
  const [showDefineArea, setShowDefineArea] = useState(false);
  const [showDatasetConfig, setShowDatasetConfig] = useState(false);
  const [showCalibrate, setShowCalibrate] = useState(false);
  const [showRecompute, setShowRecompute] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // Color scale 1–5
  // ─────────────────────────────────────────────────────────────
  const getColor = (score: number | null | undefined) => {
    if (score == null || isNaN(score)) return "#cccccc";
    if (score >= 4.5) return "#800026";
    if (score >= 3.5) return "#BD0026";
    if (score >= 2.5) return "#E31A1C";
    if (score >= 1.5) return "#FC4E2A";
    return "#FFEDA0";
  };

  // ─────────────────────────────────────────────────────────────
  // Fetch data (affected ADM3 only)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);

      const { data: affected } = await supabase
        .from("v_instance_affected_adm3")
        .select("admin_pcode")
        .eq("instance_id", id);

      const affectedCodes = affected?.map((a) => a.admin_pcode) ?? [];
      if (affectedCodes.length === 0) {
        console.warn("No affected ADM3 found.");
        setAdm3([]);
        setStats({ affected: 0, avg: "-", min: "-", max: "-" });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("v_instance_admin_scores_geojson")
        .select("admin_pcode,name,score,geom_json")
        .eq("instance_id", id)
        .in("admin_pcode", affectedCodes);

      if (error) {
        console.error("Error loading data:", error);
        setLoading(false);
        return;
      }

      const parsed = (data || []).map((d: any) => {
        let geomObj = null;
        try {
          const raw =
            typeof d.geom_json === "string" ? JSON.parse(d.geom_json) : d.geom_json;
          if (raw?.type === "Polygon" || raw?.type === "MultiPolygon") geomObj = raw;
          else if (raw?.geometry?.type) geomObj = raw.geometry;
        } catch {
          console.warn("Invalid geometry skipped:", d.admin_pcode);
        }
        return {
          admin_pcode: d.admin_pcode,
          name: d.name ?? "",
          score: d.score ? Number(d.score) : null,
          geom_json: geomObj,
        };
      });

      const filtered = parsed.filter((f) => f.geom_json);
      setAdm3(filtered);

      const validScores = filtered
        .map((d) => d.score)
        .filter((s): s is number => s !== null && !isNaN(s));
      if (validScores.length > 0) {
        const avg = (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2);
        const min = Math.min(...validScores).toFixed(2);
        const max = Math.max(...validScores).toFixed(2);
        setStats({ affected: filtered.length, avg, min, max });
      } else {
        setStats({ affected: filtered.length, avg: "-", min: "-", max: "-" });
      }

      setLoading(false);
    };

    fetchData();
  }, [id, layerType, selectedLayer]);

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────
  const handleSelect = (value: string, type: string) => {
    setSelectedLayer(value);
    setLayerType(type as any);
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-row h-[calc(100vh-4rem)]">
      {/* Left Section: Map + Stats */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Instance: Cebu EQ–Typhoon</h1>
          <p className="text-gray-600">
            Visualization of scoring and affected administrative areas.
          </p>
        </div>

        <div className="grid grid-cols-5 gap-3">
          <StatCard title="Affected ADM3 Areas" value={stats.affected.toString()} />
          <StatCard title="Average Score" value={stats.avg.toString()} />
          <StatCard title="Highest / Lowest Score" value={`${stats.max} / ${stats.min}`} />
        </div>

        <div className="flex-1 border rounded-lg overflow-hidden shadow">
          <MapContainer
            style={{ height: "100%", width: "100%" }}
            center={[10.3, 123.9]}
            zoom={8}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            dragging={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {!loading &&
              adm3.map((area, i) => (
                <GeoJSON
                  key={i}
                  data={area.geom_json}
                  style={() => ({
                    color: "#333",
                    weight: 0.5,
                    fillColor: getColor(area.score),
                    fillOpacity: 0.75,
                  })}
                >
                  <Tooltip sticky>
                    <div>
                      <strong>{area.name}</strong>
                      <br />
                      Score: {area.score ?? "—"}
                    </div>
                  </Tooltip>
                </GeoJSON>
              ))}
          </MapContainer>
        </div>
      </div>

      {/* Right Section: Sidebar Controls */}
      <div className="w-80 border-l bg-gray-50 p-4 flex flex-col space-y-4">
        <h2 className="text-lg font-semibold mb-2">Map Layers & Actions</h2>

        <div className="flex-1 overflow-y-auto">
          <ScoreLayerSelector
            instanceId={id}
            selected={selectedLayer}
            onSelect={handleSelect}
          />
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setShowDefineArea(true)}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            🗺 Define Affected Area
          </button>
          <button
            onClick={() => setShowDatasetConfig(true)}
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
          >
            🧩 Configure Datasets
          </button>
          <button
            onClick={() => setShowCalibrate(true)}
            className="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700"
          >
            🎚 Calibrate Scores
          </button>
          <button
            onClick={() => setShowRecompute(true)}
            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
          >
            🔁 Recompute Framework Scores
          </button>
        </div>
      </div>

      {/* Modals */}
      {showDefineArea && (
        <DefineAffectedAreaModal open={true} onClose={() => setShowDefineArea(false)} />
      )}
      {showDatasetConfig && (
        <InstanceDatasetConfigModal open={true} onClose={() => setShowDatasetConfig(false)} />
      )}
      {showCalibrate && (
        <InstanceScoringModal open={true} onClose={() => setShowCalibrate(false)} />
      )}
      {showRecompute && (
        <FrameworkScoringModal open={true} onClose={() => setShowRecompute(false)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helper Component
// ─────────────────────────────────────────────────────────────
function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="p-3 rounded-lg shadow bg-white text-center">
      <h4 className="text-gray-500 text-sm">{title}</h4>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
