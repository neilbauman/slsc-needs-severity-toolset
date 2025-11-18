"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type AreaRow = {
  admin_pcode: string;
  name: string;
  score: number;
  geom_json: any;
};

export default function InstancePage() {
  const { id } = useParams();
  const [adm3, setAdm3] = useState<AreaRow[]>([]);
  const [stats, setStats] = useState({
    affected: 0,
    avg: "-",
    min: "-",
    max: "-",
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("v_instance_admin_scores_geojson")
        .select("admin_pcode,name,score,geom_json")
        .eq("instance_id", id);

      if (error) {
        console.error("Error loading adm3:", error);
        return;
      }

      setAdm3(data || []);
      if (data && data.length > 0) {
        const scores = data.map((d) => Number(d.score)).filter(Boolean);
        const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
        setStats({
          affected: data.length,
          avg,
          min: Math.min(...scores).toFixed(2),
          max: Math.max(...scores).toFixed(2),
        });
      }
    })();
  }, [id]);

  const getColor = (score: number) => {
    if (score >= 4.5) return "#800026";
    if (score >= 3.5) return "#BD0026";
    if (score >= 2.5) return "#E31A1C";
    if (score >= 1.5) return "#FC4E2A";
    return "#FFEDA0";
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Cebu EQ–Typhoon</h1>
      <p className="text-gray-600">
        Overview of scoring and affected administrative areas.
      </p>

      <div className="grid grid-cols-5 gap-3">
        <StatCard title="Total Population" value="–" />
        <StatCard title="People of Concern (≥3)" value="–" />
        <StatCard title="Poverty-Exposed Population" value="–" />
        <StatCard title="Affected ADM3 Areas" value={stats.affected.toString()} />
        <StatCard title="Average Score" value={stats.avg.toString()} />
        <StatCard
          title="Highest / Lowest Score"
          value={`${stats.max} / ${stats.min}`}
        />
      </div>

      <MapContainer
        style={{ height: "600px", width: "100%" }}
        center={[10.3, 123.9]}
        zoom={8}
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
              fillColor: getColor(area.score),
              fillOpacity: 0.7,
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
        ))}
      </MapContainer>

      <div className="text-right">
        <button className="bg-blue-600 text-white px-4 py-2 rounded shadow">
          Recompute Scores
        </button>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="p-3 rounded-lg shadow bg-white text-center">
      <h4 className="text-gray-500 text-sm">{title}</h4>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
