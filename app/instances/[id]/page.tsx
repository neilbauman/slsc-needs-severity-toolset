"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface AreaRow {
  admin_pcode: string;
  name: string;
  score: number | null;
  geom_json: any;
}

export default function InstancePage() {
  const supabase = createClient();
  const { id } = useParams();
  const [adm3, setAdm3] = useState<AreaRow[]>([]);
  const [stats, setStats] = useState({
    affected: 0,
    avg: "-",
    min: "-",
    max: "-",
  });
  const [summary, setSummary] = useState({
    totalPopulation: "-",
    peopleConcern: "-",
    peopleNeed: "-",
  });

  const [showDefine, setShowDefine] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showCalibrate, setShowCalibrate] = useState(false);

  // ---------------------------------------------
  // Load ADM3 GeoJSON & Scores (affected only)
  // ---------------------------------------------
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("v_instance_affected_adm3")
        .select("admin_pcode,name,score,geom_json")
        .eq("instance_id", id);

      if (error) {
        console.error("Error loading adm3:", error);
        return;
      }

      if (!data || data.length === 0) return;

      setAdm3(data);

      const scores = data.map((d) => Number(d.score)).filter((s) => !isNaN(s));
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
      const min = Math.min(...scores).toFixed(2);
      const max = Math.max(...scores).toFixed(2);

      setStats({
        affected: data.length,
        avg,
        min,
        max,
      });
    })();
  }, [id]);

  // ---------------------------------------------
  // Load population & need summary
  // (once we add v_instance_affected_summary)
  // ---------------------------------------------
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.rpc("get_instance_summary", {
        in_instance_id: id,
      });
      if (data && data.length > 0) {
        setSummary({
          totalPopulation: data[0].total_population ?? "-",
          peopleConcern: data[0].people_concern ?? "-",
          peopleNeed: data[0].people_need ?? "-",
        });
      }
    })();
  }, [id]);

  // ---------------------------------------------
  // Map Color Scale
  // ---------------------------------------------
  const getColor = (score: number) => {
    if (!score) return "#d3d3d3";
    if (score >= 4.5) return "#800026";
    if (score >= 3.5) return "#BD0026";
    if (score >= 2.5) return "#E31A1C";
    if (score >= 1.5) return "#FC4E2A";
    return "#FFEDA0";
  };

  // ---------------------------------------------
  // UI
  // ---------------------------------------------
  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Cebu EQ–Typhoon</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setShowDefine(true)}
          >
            Define Affected Area
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
            onClick={() => setShowConfig(true)}
          >
            Configure Datasets
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
            onClick={() => setShowCalibrate(true)}
          >
            Calibrate Scores
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            onClick={async () => {
              await supabase.rpc("score_framework_aggregate", {
                in_instance_id: id,
              });
              location.reload();
            }}
          >
            Recompute All Scores
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard title="Total Population" value={summary.totalPopulation} />
        <SummaryCard
          title="People of Concern (≥3)"
          value={summary.peopleConcern}
        />
        <SummaryCard title="People in Need" value={summary.peopleNeed} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Map */}
        <div className="col-span-3 bg-white shadow rounded overflow-hidden">
          <div className="p-3 grid grid-cols-3 text-center text-sm font-medium border-b bg-gray-50">
            <div>Affected ADM3 Areas<br /><span className="text-lg font-bold">{stats.affected}</span></div>
            <div>Average Score<br /><span className="text-lg font-bold">{stats.avg}</span></div>
            <div>Highest / Lowest<br /><span className="text-lg font-bold">{stats.max} / {stats.min}</span></div>
          </div>

          <MapContainer
            style={{ height: "600px", width: "100%" }}
            center={[10.3, 123.9]}
            zoom={8}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {adm3.map((area, i) => (
              <GeoJSON
                key={i}
                data={area.geom_json}
                style={() => ({
                  color: "#333",
                  weight: 0.5,
                  fillColor: getColor(area.score ?? 0),
                  fillOpacity: 0.75,
                })}
              >
                <Tooltip sticky>
                  <div>
                    <strong>{area.name}</strong>
                    <br />
                    Score: {area.score ? area.score.toFixed(2) : "–"}
                  </div>
                </Tooltip>
              </GeoJSON>
            ))}
          </MapContainer>
        </div>

        {/* Layer Sidebar */}
        <div className="col-span-1 bg-white rounded shadow p-3 text-sm">
          <h3 className="font-semibold border-b pb-1 mb-2">Map Layers</h3>
          <p className="text-gray-500 mb-2">
            Select dataset layers or switch to overall score.
          </p>
          <ul className="space-y-1 text-sm">
            <li className="px-2 py-1 rounded bg-blue-100 font-medium">Overall Score</li>
            <li className="px-2 py-1 hover:bg-gray-100 cursor-pointer">SSC Framework – P1</li>
            <li className="px-2 py-1 hover:bg-gray-100 cursor-pointer">SSC Framework – P3</li>
            <li className="px-2 py-1 hover:bg-gray-100 cursor-pointer">Hazard</li>
            <li className="px-2 py-1 hover:bg-gray-100 cursor-pointer">Underlying Vulnerability</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------
// Components
// ---------------------------------------------
function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="p-3 bg-white rounded shadow text-center">
      <h4 className="text-gray-500 text-sm">{title}</h4>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
