"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import DefineAffectedAreaModal from "@/components/DefineAffectedAreaModal";
import InstanceDatasetConfigModal from "@/components/InstanceDatasetConfigModal";
import InstanceScoringModal from "@/components/InstanceScoringModal";
import FrameworkScoringModal from "@/components/FrameworkScoringModal";

// ------------------------------------------
// Interfaces
// ------------------------------------------
interface Adm3Row {
  admin_pcode: string;
  name: string;
  score: number;
  geom_json: any;
}

interface InstanceRow {
  id: string;
  name: string;
  admin_scope: string[] | string;
  population_dataset_id: string | null;
  poverty_dataset_id: string | null;
}

// ------------------------------------------
// Main Component
// ------------------------------------------
export default function InstancePage() {
  const { id } = useParams();
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [adm3, setAdm3] = useState<Adm3Row[]>([]);
  const [stats, setStats] = useState({
    totalPopulation: "-",
    peopleConcern: "-",
    peopleNeed: "-",
  });
  const [loading, setLoading] = useState(true);

  const [showDefineArea, setShowDefineArea] = useState(false);
  const [showDatasetConfig, setShowDatasetConfig] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [showFrameworkScoring, setShowFrameworkScoring] = useState(false);

  // ------------------------------------------------------------
  // Fetch instance info (admin_scope, dataset refs, etc.)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("instances")
        .select("id,name,admin_scope,population_dataset_id,poverty_dataset_id")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Failed to load instance:", error);
        return;
      }
      setInstance(data);
    })();
  }, [id]);

  // ------------------------------------------------------------
  // Fetch ADM3 scores filtered to affected area
  // ------------------------------------------------------------
  useEffect(() => {
    if (!instance?.admin_scope) return;
    (async () => {
      setLoading(true);

      // Normalize admin_scope from string or array
      const scopeArray =
        typeof instance.admin_scope === "string"
          ? JSON.parse(instance.admin_scope)
          : instance.admin_scope;
      const validParents = new Set(scopeArray);

      // Fetch all ADM3 scores
      const { data: allScores, error: errScores } = await supabase
        .from("v_instance_admin_scores_geojson")
        .select("admin_pcode,name,score,geom_json")
        .eq("instance_id", instance.id);

      if (errScores) {
        console.error("ADM3 fetch error:", errScores);
        setLoading(false);
        return;
      }

      // Fetch all ADM3 boundaries
      const { data: boundaries, error: errBound } = await supabase
        .from("admin_boundaries")
        .select("admin_pcode,parent_pcode,admin_level")
        .eq("admin_level", "ADM3");

      if (errBound) {
        console.error("Boundary fetch error:", errBound);
        setLoading(false);
        return;
      }

      // Filter to affected ADM3s
      const filtered = allScores.filter((row) =>
        boundaries.some(
          (b) =>
            b.admin_pcode === row.admin_pcode &&
            validParents.has(b.parent_pcode)
        )
      );

      setAdm3(filtered);
      setLoading(false);
    })();
  }, [instance]);

  // ------------------------------------------------------------
  // Compute basic stats
  // ------------------------------------------------------------
  useEffect(() => {
    if (!adm3.length) return;
    const scores = adm3.map((a) => a.score || 0);
    const concern = scores.filter((s) => s >= 3).length;
    setStats({
      totalPopulation: "–",
      peopleConcern: concern.toString(),
      peopleNeed: "–",
    });
  }, [adm3]);

  // ------------------------------------------------------------
  // Normalize GeoJSON (Polygon, MultiPolygon, etc.)
  // ------------------------------------------------------------
  const normalizeGeometry = (geom: any) => {
    if (!geom) return null;
    if (geom.type === "FeatureCollection") return geom;
    if (geom.type === "Feature") return geom;
    if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
      return {
        type: "Feature",
        properties: {},
        geometry: geom,
      };
    }
    return null;
  };

  // ------------------------------------------------------------
  // Color scale
  // ------------------------------------------------------------
  const getColor = (score: number) => {
    if (!score) return "#d3d3d3";
    if (score >= 5) return "#E31A1C";
    if (score >= 4) return "#FD8D3C";
    if (score >= 3) return "#FEB24C";
    if (score >= 2) return "#FED976";
    return "#FFEDA0";
  };

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <div className="p-4 flex flex-col gap-3 text-sm">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">{instance?.name || "Loading..."}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDefineArea(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Define Affected Area
          </button>
          <button
            onClick={() => setShowDatasetConfig(true)}
            className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800"
          >
            Configure Datasets
          </button>
          <button
            onClick={() => setShowScoring(true)}
            className="px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            Calibrate Scores
          </button>
          <button
            onClick={() => setShowFrameworkScoring(true)}
            className="px-3 py-1 bg-green-700 text-white rounded hover:bg-green-800"
          >
            Recompute All Scores
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Total Population" value={stats.totalPopulation} />
        <StatCard title="People of Concern (≥3)" value={stats.peopleConcern} />
        <StatCard title="People in Need" value={stats.peopleNeed} />
      </div>

      {/* Map + Sidebar */}
      <div className="flex gap-4">
        <div className="flex-1 rounded border overflow-hidden">
          {loading ? (
            <div className="p-4 text-gray-500">Loading map...</div>
          ) : (
            <MapContainer
              center={[10.3, 123.9]}
              zoom={8}
              scrollWheelZoom={false}
              style={{ height: "600px", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {adm3.map((area, i) => {
                const feature = normalizeGeometry(area.geom_json);
                if (!feature) return null;
                return (
                  <GeoJSON
                    key={i}
                    data={feature}
                    style={() => ({
                      color: "#555",
                      weight: 0.6,
                      fillColor: getColor(area.score),
                      fillOpacity: 0.8,
                    })}
                  >
                    <Tooltip sticky>
                      <div>
                        <strong>{area.name}</strong>
                        <br />
                        Score: {Number(area.score).toFixed(2)}
                      </div>
                    </Tooltip>
                  </GeoJSON>
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 bg-white rounded border p-3 flex flex-col gap-2 h-[600px] overflow-y-auto">
          <h3 className="text-sm font-semibold mb-1">Map Layers</h3>
          <p className="text-xs text-gray-600">
            Select dataset layers or switch to overall score.
          </p>
          <div className="p-2 text-xs text-gray-500 border-t mt-2">
            (Layer selector coming soon)
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDefineArea && (
        <DefineAffectedAreaModal
          instance={instance}
          onClose={() => setShowDefineArea(false)}
          onSaved={async () => window.location.reload()}
        />
      )}
      {showDatasetConfig && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowDatasetConfig(false)}
          onSaved={async () => window.location.reload()}
        />
      )}
      {showScoring && (
        <InstanceScoringModal
          instance={instance}
          onClose={() => setShowScoring(false)}
          onSaved={async () => window.location.reload()}
        />
      )}
      {showFrameworkScoring && (
        <FrameworkScoringModal
          instance={instance}
          onClose={() => setShowFrameworkScoring(false)}
          onSaved={async () => window.location.reload()}
        />
      )}
    </div>
  );
}

// ------------------------------------------
// Stat Card
// ------------------------------------------
function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded border p-3 shadow-sm text-center">
      <div className="text-gray-500 text-xs">{title}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
