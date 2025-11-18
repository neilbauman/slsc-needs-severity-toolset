"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";

const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
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
  const [stats, setStats] = useState({
    affected: 0,
    avg: "-",
    min: "-",
    max: "-"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // --- Load ADM3 data and scores ---
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

      // --- Load stats safely (with explicit aliasing) ---
      const { data: statData, error: statErr } = await supabase
        .from("scored_instance_values_adm3")
        .select(`
          total:count(*),
          min:min(score),
          max:max(score),
          avg:avg(score)
        `)
        .eq("instance_id", instanceId)
        .single();

      if (statErr) {
        console.error("Stat query error:", statErr);
      } else if (statData) {
        setStats({
          affected: statData.total ?? 0,
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Cebu EQ–Typhoon</h1>
        <p className="text-gray-600 mb-8">
          Overview of scoring and affected administrative areas.
        </p>

        {/* --- Stats Summary --- */}
        <div className="grid grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <div className="text-sm text-gray-500">Total Population</div>
            <div className="text-lg font-semibold">–</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <div className="text-sm text-gray-500">People of Concern (≥3)</div>
            <div className="text-lg font-semibold">–</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <div className="text-sm text-gray-500">Poverty-Exposed Population</div>
            <div className="text-lg font-semibold">–</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <div className="text-sm text-gray-500">Affected ADM3 Areas</div>
            <div className="text-lg font-semibold">{stats.affected}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <div className="text-sm text-gray-500">Average Score</div>
            <div className="text-lg font-semibold">{stats.avg}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <div className="text-sm text-gray-500">Highest / Lowest Score</div>
            <div className="text-lg font-semibold">
              {stats.max} / {stats.min}
            </div>
          </div>
        </div>

        {/* --- Map Section --- */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          {loading ? (
            <div className="p-10 text-center text-gray-500">Loading map...</div>
          ) : (
            <MapContainer
              center={[10.3157, 123.8854]}
              zoom={8}
              style={{ height: "600px", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {adm3Data.map((item, idx) => {
                if (!item.geom_json) return null;
                return (
                  <GeoJSON
                    key={idx}
                    data={item.geom_json}
                    style={() => ({
                      color: "black",
                      weight: 0.5,
                      fillColor: getColor(item.score),
                      fillOpacity: 0.7
                    })}
                  />
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* --- Controls --- */}
        <div className="flex justify-end">
          <button
            onClick={recompute}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 shadow-sm"
          >
            Recompute Scores
          </button>
        </div>
      </div>
    </div>
  );
}
