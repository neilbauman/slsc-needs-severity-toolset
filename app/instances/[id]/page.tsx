"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";

const supabase = createClient();

export default function InstancePage({ params }: any) {
  const instanceId = params.id;

  const [instance, setInstance] = useState<any>(null);
  const [adm3Data, setAdm3Data] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    affected: 0,
    avg: "-",
    min: "-",
    max: "-",
    total_population: "-",
    people_of_concern: "-",
    poverty_exposed: "-",
  });
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  // Load all instance data
  useEffect(() => {
    loadInstanceData();
  }, [instanceId]);

  const loadInstanceData = async () => {
    setLoading(true);

    // 1️⃣ Load instance info
    const { data: instanceData, error: instErr } = await supabase
      .from("instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (instErr) {
      console.error("Error loading instance:", instErr);
      setLoading(false);
      return;
    }

    setInstance(instanceData);

    // 2️⃣ Load ADM3 scoring data
    const { data: adm3Scores, error: adm3Err } = await supabase
      .from("scored_instance_values_adm3")
      .select("pcode, score")
      .eq("instance_id", instanceId);

    if (adm3Err) {
      console.error("ADM3 score load error:", adm3Err);
      setLoading(false);
      return;
    }

    // 3️⃣ Compute stats (✅ using aliases to fix TS type error)
    const { data: statRows, error: statErr } = await supabase
      .from("scored_instance_values_adm3")
      .select("count:count(*), min:min(score), max:max(score), avg:avg(score)")
      .eq("instance_id", instanceId)
      .maybeSingle();

    if (statErr) console.error("Stat query error:", statErr);

    if (statRows) {
      setStats((prev: any) => ({
        ...prev,
        affected: statRows.count ?? 0,
        avg: statRows.avg ? Number(statRows.avg).toFixed(2) : "-",
        min: statRows.min ? Number(statRows.min).toFixed(2) : "-",
        max: statRows.max ? Number(statRows.max).toFixed(2) : "-",
      }));
    }

    // 4️⃣ Load ADM3 geometries
    const { data: adm3Geo, error: geoErr } = await supabase
      .from("v_instance_affected_adm3")
      .select("name, admin_pcode, geom_json, score")
      .eq("instance_id", instanceId);

    if (geoErr) {
      console.error("ADM3 geo load error:", geoErr);
    } else {
      setAdm3Data(adm3Geo || []);
    }

    // 5️⃣ Load population summary if exists
    const { data: popData, error: popErr } = await supabase
      .from("v_instance_admin_scores_by_dataset")
      .select(
        "total_population, people_of_concern, poverty_exposed, instance_id"
      )
      .eq("instance_id", instanceId)
      .maybeSingle();

    if (!popErr && popData) {
      setStats((prev: any) => ({
        ...prev,
        total_population: popData.total_population ?? "-",
        people_of_concern: popData.people_of_concern ?? "-",
        poverty_exposed: popData.poverty_exposed ?? "-",
      }));
    }

    setLoading(false);
  };

  // ✅ Recompute button
  const handleRecompute = async () => {
    setRecomputing(true);
    const { error } = await supabase.rpc("refresh_all_numeric_scores", {
      in_instance_id: instanceId,
    });

    if (error) {
      console.error("Recompute error:", error);
      alert("Error during recomputation: " + error.message);
    } else {
      await loadInstanceData();
    }

    setRecomputing(false);
  };

  const formatNum = (val: any) =>
    val === null || val === undefined || val === "-"
      ? "-"
      : Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="p-6 space-y-4">
      {loading ? (
        <div className="text-gray-500">Loading instance data...</div>
      ) : (
        <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">
                {instance?.name || "Unnamed Instance"}
              </h1>
              <p className="text-gray-500 text-sm">
                {instance?.description || "No description provided."}
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/instances`}
                className="px-3 py-2 border rounded text-sm hover:bg-gray-100"
              >
                Back
              </Link>
              <button
                onClick={handleRecompute}
                disabled={recomputing}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {recomputing ? "Recomputing..." : "Recompute"}
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
            <div className="p-3 bg-gray-50 rounded shadow-sm">
              <div className="text-xs text-gray-500">Total Population</div>
              <div className="text-lg font-semibold">
                {formatNum(stats.total_population)}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded shadow-sm">
              <div className="text-xs text-gray-500">People of Concern</div>
              <div className="text-lg font-semibold">
                {formatNum(stats.people_of_concern)}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded shadow-sm">
              <div className="text-xs text-gray-500">
                Poverty-Exposed Population
              </div>
              <div className="text-lg font-semibold">
                {formatNum(stats.poverty_exposed)}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded shadow-sm">
              <div className="text-xs text-gray-500">Affected ADM3 Areas</div>
              <div className="text-lg font-semibold">{stats.affected}</div>
            </div>

            <div className="p-3 bg-gray-50 rounded shadow-sm">
              <div className="text-xs text-gray-500">Average Score</div>
              <div className="text-lg font-semibold">{stats.avg}</div>
            </div>

            <div className="p-3 bg-gray-50 rounded shadow-sm">
              <div className="text-xs text-gray-500">
                Highest / Lowest Score
              </div>
              <div className="text-lg font-semibold">
                {stats.max} / {stats.min}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="border rounded mt-4 overflow-hidden">
            <MapContainer
              style={{ height: "500px", width: "100%" }}
              center={[10.3, 123.9]}
              zoom={8}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {adm3Data.length > 0 &&
                adm3Data.map((adm3: any, idx: number) => {
                  try {
                    const geom = JSON.parse(adm3.geom_json);
                    return (
                      <GeoJSON
                        key={idx}
                        data={geom}
                        style={{
                          color: "#4b5563",
                          weight: 0.8,
                          fillColor: "#3b82f6",
                          fillOpacity: 0.5,
                        }}
                      />
                    );
                  } catch {
                    return null;
                  }
                })}
            </MapContainer>
          </div>
        </>
      )}
    </div>
  );
}
