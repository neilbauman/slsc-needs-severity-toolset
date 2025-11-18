"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import("react-leaflet").then(mod => mod.GeoJSON), { ssr: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function InstancePage() {
  const { id } = useParams();
  const instanceId = id as string;
  const [adm3Data, setAdm3Data] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    affected: 0,
    avg: "-",
    min: "-",
    max: "-"
  });
  const [loading, setLoading] = useState(true);

  // Fetch ADM3 boundaries and scores
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // --- Load ADM3 data with score and geometry ---
      const { data: adm3, error: adm3Err } = await supabase
        .from("v_instance_affected_adm3")
        .select("admin_pcode, name, geom_json, score")
        .eq("instance_id", instanceId);

      if (adm3Err) {
        console.error("ADM3 query error:", adm3Err);
        setAdm3Data([]);
      } else {
        setAdm3Data(adm3 || []);
      }

      // --- Load instance stats ---
      const { data: statData, error: statErr } = await supabase
        .from("scored_instance_values_adm3")
        .select("count(*), min(score), max(score), avg(score)")
        .eq("instance_id", instanceId)
        .maybeSingle();

      if (statErr) {
        console.error("Stat query error:", statErr);
      } else if (statData) {
        setStats({
          affected: statData.count ?? 0,
          avg: statData.avg ? Number(statData.avg).toFixed(2) : "-",
          min: statData.min ? Number(statData.min).toFixed(2) : "-",
          max: statData.max ? Number(statData.max).toFixed(2) : "-"
        });
      }

      setLoading(false);
    };

    loadData();
  }, [instanceId]);

  const recompute = async () => {
    try {
      await supabase.rpc("refresh_all_numeric_scores", { in_instance_id: instanceId });
      // Refresh after recompute
      const { data: adm3 } = await supabase
        .from("v_instance_affected_adm3")
        .select("admin_pcode, name, geom_json, score")
        .eq("instance_id", instanceId);
      setAdm3Data(adm3 || []);
    } catch (err) {
      console.error("Recompute failed:", err);
    }
  };

  const getColor = (score: number) => {
    if (score >= 4) return "#d73027";
    if (score >= 3) return "#fc8d59";
    if (score >= 2) return "#fee08b";
    if (score >= 1) return "#d9ef8b";
    return "#91cf60";
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Cebu EQ–Typhoon</h1>
      <p className="text-gray-500 mb-6">description</p>

      {/* Stats Section */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-sm text-gray-500">Total Population</div>
          <div className="text-lg font-semibold">–</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-sm text-gray-500">People of Concern (≥3)</div>
          <div className="text-lg font-semibold">–</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-sm text-gray-500">Poverty-Exposed Population</div>
          <div className="text-lg font-semibold">–</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-sm text-gray-500">Affected ADM3 Areas</div>
          <div className="text-lg font-semibold">{stats.affected}</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-sm text-gray-500">Average Score</div>
          <div className="text-lg font-semibold">{stats.avg}</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-sm text-gray-500">Highest / Lowest Score</div>
          <div className="text-lg font-semibold">
            {stats.max} / {stats.min}
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="relative rounded-lg overflow-hidden shadow bg-white">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading map...</div>
        ) : (
          <Map
            center={[10.3157, 123.8854]}
            zoom={8}
            style={{ height: "600px", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {adm3Data.map((item, idx) => {
              const geom = item.geom_json;
              if (!geom) return null;
              return (
                <GeoJSON
                  key={idx}
                  data={geom}
                  style={() => ({
                    color: "black",
                    weight: 0.6,
                    fillColor: getColor(item.score),
                    fillOpacity: 0.7,
                  })}
                />
              );
            })}
          </Map>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-end mt-4">
        <button
          onClick={recompute}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Recompute
        </button>
      </div>
    </div>
  );
}
