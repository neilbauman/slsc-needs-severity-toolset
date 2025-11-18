"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";

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
  const [layerType, setLayerType] = useState<"overall" | "category" | "dataset">("overall");
  const [selectedLayer, setSelectedLayer] = useState<string>("overall");
  const [adm3, setAdm3] = useState<AreaRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    affected: 0,
    avg: "-",
    min: "-",
    max: "-",
  });
  const [loading, setLoading] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // Color scale (1–5)
  // ─────────────────────────────────────────────────────────────
  const getColor = (score: number | null | undefined) => {
    if (score == null || isNaN(score)) return "#cccccc"; // grey fallback
    if (score >= 4.5) return "#800026";
    if (score >= 3.5) return "#BD0026";
    if (score >= 2.5) return "#E31A1C";
    if (score >= 1.5) return "#FC4E2A";
    return "#FFEDA0";
  };

  // ─────────────────────────────────────────────────────────────
  // Fetch and prepare data
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);

      let data: any[] | null = null;
      let error: any = null;

      // ───── 1️⃣ OVERALL ─────
      if (layerType === "overall") {
        const res = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode,name,score,geom_json")
          .eq("instance_id", id);
        data = res.data;
        error = res.error;
      }

      // ───── 2️⃣ DATASET ─────
      else if (layerType === "dataset") {
        const datasetRes = await supabase
          .from("datasets")
          .select("id")
          .ilike("name", selectedLayer)
          .limit(1);
        const datasetId = datasetRes.data?.[0]?.id;

        if (datasetId) {
          const res = await supabase
            .from("dataset_values_numeric_normalized")
            .select("admin_pcode,value as score,admin_name")
            .eq("dataset_id", datasetId);
          data = res.data;
          error = res.error;
        }
      }

      // ───── 3️⃣ CATEGORY (placeholder for later) ─────
      else if (layerType === "category") {
        const res = await supabase
          .from("v_instance_admin_scores_geojson")
          .select("admin_pcode,name,score,geom_json")
          .eq("instance_id", id);
        data = res.data;
        error = res.error;
      }

      if (error) {
        console.error("Error loading data:", error);
        setAdm3([]);
        setLoading(false);
        return;
      }

      // ───── 4️⃣ Fallback if no data ─────
      if (!data || data.length === 0) {
        console.warn("No rows found — rendering grey boundaries.");
        const { data: geo, error: geoErr } = await supabase
          .from("admin_boundaries_geojson")
          .select("admin_pcode,name,geom")
          .eq("admin_level", "ADM3");
        if (!geoErr && geo) {
          setAdm3(
            geo.map((g: any) => ({
              admin_pcode: g.admin_pcode,
              name: g.name,
              geom_json:
                typeof g.geom === "string" ? JSON.parse(g.geom) : g.geom,
              score: null,
            }))
          );
        }
        setStats({ affected: geo?.length || 0, avg: "-", min: "-", max: "-" });
        setLoading(false);
        return;
      }

      // ───── 5️⃣ Parse JSON safely ─────
      const parsed = data.map((d: any) => {
        let geomObj = null;
        try {
          geomObj =
            typeof d.geom_json === "string"
              ? JSON.parse(d.geom_json)
              : d.geom_json;
        } catch (e) {
          console.warn("Invalid GeoJSON skipped:", d.admin_pcode);
        }
        return {
          admin_pcode: d.admin_pcode,
          name: d.name ?? d.admin_name ?? "",
          score: d.score ? Number(d.score) : null,
          geom_json: geomObj,
        };
      });

      const filtered = parsed.filter((d) => d.geom_json);
      setAdm3(filtered);

      // ───── 6️⃣ Compute stats ─────
      const validScores = filtered
        .map((d) => d.score)
        .filter((s): s is number => s !== null && !isNaN(s));
      if (validScores.length > 0) {
        const avg = (
          validScores.reduce((a, b) => a + b, 0) / validScores.length
        ).toFixed(2);
        const min = Math.min(...validScores).toFixed(2);
        const max = Math.max(...validScores).toFixed(2);
        setStats({ affected: filtered.length, avg, min, max });
      } else {
        setStats({ affected: filtered.length, avg: "-", min: "-", max: "-" });
      }

      setLoading(false);
    };

    fetchData();
  }, [id, selectedLayer, layerType]);

  // ─────────────────────────────────────────────────────────────
  // Handler for layer selector
  // ─────────────────────────────────────────────────────────────
  const handleSelect = (value: string, type: string) => {
    setSelectedLayer(value);
    setLayerType(type as any);
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex">
      <div className="flex-1 p-6 space-y-4">
        <h1 className="text-xl font-semibold">Instance: Cebu EQ–Typhoon</h1>
        <p className="text-gray-600">
          Map visualization of the selected scoring layer.
        </p>

        <div className="grid grid-cols-5 gap-3">
          <StatCard title="Affected ADM3 Areas" value={stats.affected.toString()} />
          <StatCard title="Average Score" value={stats.avg.toString()} />
          <StatCard title="Highest / Lowest Score" value={`${stats.max} / ${stats.min}`} />
        </div>

        <div className="border rounded-lg overflow-hidden shadow">
          <MapContainer
            style={{ height: "600px", width: "100%" }}
            center={[10.3, 123.9]}
            zoom={8}
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

      <ScoreLayerSelector
        instanceId={id}
        selected={selectedLayer}
        onSelect={handleSelect}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helper component
// ─────────────────────────────────────────────────────────────
function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="p-3 rounded-lg shadow bg-white text-center">
      <h4 className="text-gray-500 text-sm">{title}</h4>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
