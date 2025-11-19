"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature } from "geojson";

import DefineAffectedAreaModal from "@/components/DefineAffectedAreaModal";
import InstanceDatasetConfigModal from "@/components/InstanceDatasetConfigModal";
import InstanceScoringModal from "@/components/InstanceScoringModal";

// ======================================================
// Interfaces
// ======================================================
interface SummaryRow {
  adm3_pcode: string;
  adm3_name: string;
  pop: number;
  score: number;
  pov_rate: number;
  pop_concern: number;
  pop_need: number;
  geom: any;
}

// ======================================================
// Main Component
// ======================================================
export default function InstancePage() {
  const { id } = useParams();
  const supabase = createClient();

  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [stats, setStats] = useState({
    totalPop: "-",
    peopleConcern: "-",
    peopleNeed: "-",
  });
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showDefineArea, setShowDefineArea] = useState(false);
  const [showDatasetConfig, setShowDatasetConfig] = useState(false);
  const [showScoringConfig, setShowScoringConfig] = useState(false);

  // ======================================================
  // Fetch summary data with geometry
  // ======================================================
  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase.rpc("get_instance_summary_map", {
        in_instance_id: id,
      });

      if (error) {
        console.error("Error loading summary map data:", error);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        console.warn("No affected data found for this instance");
        setSummary([]);
        setLoading(false);
        return;
      }

      setSummary(data);

      // Aggregate stats
      const totalPop = data.reduce((a, b) => a + Number(b.pop || 0), 0);
      const peopleConcern = data.reduce((a, b) => a + Number(b.pop_concern || 0), 0);
      const peopleNeed = data.reduce((a, b) => a + Number(b.pop_need || 0), 0);

      setStats({
        totalPop: totalPop.toLocaleString(),
        peopleConcern: peopleConcern.toLocaleString(),
        peopleNeed: Math.round(peopleNeed).toLocaleString(),
      });

      setLoading(false);
    })();
  }, [id]);

  // ======================================================
  // Color scale for vulnerability
  // ======================================================
  const getColor = (score: number) => {
    if (!score) return "#d3d3d3";
    if (score >= 4.5) return "#800026";
    if (score >= 3.5) return "#BD0026";
    if (score >= 2.5) return "#E31A1C";
    if (score >= 1.5) return "#FC4E2A";
    return "#FFEDA0";
  };

  // ======================================================
  // Render
  // ======================================================
  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Cebu EQ–Typhoon</h1>
          <p className="text-gray-600 text-sm">
            Overview of scoring and affected administrative areas.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDefineArea(true)}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Define Affected Area
          </button>
          <button
            onClick={() => setShowDatasetConfig(true)}
            className="px-3 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700"
          >
            Configure Datasets
          </button>
          <button
            onClick={() => setShowScoringConfig(true)}
            className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
          >
            Calibrate Scores
          </button>
          <button
            onClick={() => alert("Recomputing all scores...")}
            className="px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-900"
          >
            Recompute Scores
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Total Population" value={stats.totalPop} />
        <StatCard title="People of Concern (Score ≥ 3)" value={stats.peopleConcern} />
        <StatCard title="People in Need" value={stats.peopleNeed} />
      </div>

      {/* Map + Layer Panel */}
      <div className="flex flex-row gap-4 mt-6">
        <div className="flex-1 border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 text-gray-500 text-sm">Loading map data...</div>
          ) : (
            <MapContainer
              style={{ height: "650px", width: "100%" }}
              center={[10.3, 123.9]}
              zoom={8}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              boxZoom={false}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {summary.map((area, i) => {
                const feature: Feature = {
                  type: "Feature",
                  geometry: area.geom as any,
                  properties: { name: area.adm3_name },
                };

                return (
                  <GeoJSON
                    key={i}
                    data={feature}
                    style={() => ({
                      color: "#333",
                      weight: 0.4,
                      fillColor: getColor(area.score),
                      fillOpacity: 0.75,
                    })}
                  >
                    <Tooltip sticky>
                      <div>
                        <strong>{area.adm3_name}</strong>
                        <br />
                        Score: {Number(area.score).toFixed(2)}
                        <br />
                        Pop: {Number(area.pop).toLocaleString()}
                        <br />
                        Pov: {Number(area.pov_rate).toFixed(1)}%
                      </div>
                    </Tooltip>
                  </GeoJSON>
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* Layer Panel */}
        <div className="w-64 bg-white shadow rounded-lg p-3 text-sm space-y-2">
          <h3 className="font-semibold text-gray-700 mb-2">Map Layers</h3>
          <div className="flex flex-col gap-1">
            <button className="border rounded px-2 py-1 hover:bg-gray-50">
              Overall Score
            </button>
            <button className="border rounded px-2 py-1 hover:bg-gray-50">
              Poverty Rate
            </button>
            <button className="border rounded px-2 py-1 hover:bg-gray-50">
              Population Density
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDefineArea && (
        <DefineAffectedAreaModal
          instance={{ id }}
          onClose={() => setShowDefineArea(false)}
          onSaved={async () => {
            window.location.reload();
          }}
        />
      )}
      {showDatasetConfig && (
        <InstanceDatasetConfigModal
          instance={{ id }}
          onClose={() => setShowDatasetConfig(false)}
          onSaved={async () => {
            window.location.reload();
          }}
        />
      )}
      {showScoringConfig && (
        <InstanceScoringModal
          instance={{ id }}
          onClose={() => setShowScoringConfig(false)}
          onSaved={async () => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// ======================================================
// StatCard Component
// ======================================================
function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="p-3 bg-white rounded-lg shadow text-center">
      <div className="text-gray-500 text-sm">{title}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
