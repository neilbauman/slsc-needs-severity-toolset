"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import InstanceDatasetConfigModal from "@/components/InstanceDatasetConfigModal";
import DefineAffectedAreaModal from "@/components/DefineAffectedAreaModal";
import { Lock, Unlock } from "lucide-react";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import("react-leaflet").then(m => m.GeoJSON), { ssr: false });

export default function InstancePage({ params }: { params: { id: string } }) {
  const [instance, setInstance] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [affected, setAffected] = useState<string[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [topAreas, setTopAreas] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [zoomLocked, setZoomLocked] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [showArea, setShowArea] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const colorFor = (s: number | null) =>
    s == null ? "#ccc" : s <= 1 ? "#00b050" : s <= 2 ? "#92d050" : s <= 3 ? "#ffff00" : s <= 4 ? "#ffc000" : "#ff0000";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("instances").select("*").eq("id", params.id).single();
      setInstance(data);
    })();
  }, [params.id]);

  useEffect(() => {
    if (!instance?.admin_scope?.length) return;
    const lowest = instance.admin_scope.at(-1);
    supabase.from("admin_boundaries").select("admin_pcode").eq("parent_pcode", lowest).then(({ data }) =>
      setAffected(data?.map((d: any) => d.admin_pcode) || [])
    );
  }, [instance]);

  useEffect(() => {
    if (!instance || !affected.length) return;
    supabase
      .from("scored_instance_values")
      .select("pcode,score")
      .eq("instance_id", instance.id)
      .in("pcode", affected)
      .then(({ data }) => setScores(data || []));
  }, [instance, affected]);

  useEffect(() => {
    if (!instance?.admin_scope?.length) return;
    const lowest = instance.admin_scope.at(-1);
    supabase
      .rpc("get_admin_geoms", { in_parent_pcode: lowest })
      .then(({ data }) =>
        setFeatures(
          (data || [])
            .filter((d: any) => affected.includes(d.admin_pcode))
            .map((d: any) => ({ ...d, score: scores.find(s => s.pcode === d.admin_pcode)?.score ?? null }))
        )
      );
  }, [instance, scores, affected]);

  useEffect(() => {
    if (!instance || !affected.length) return;
    (async () => {
      const { data: pop } = await supabase.from("datasets").select("id").ilike("name", "%population%").limit(1).maybeSingle();
      let total = 0;
      if (pop?.id) {
        const { data } = await supabase.from("dataset_values_numeric").select("value").eq("dataset_id", pop.id).in("admin_pcode", affected);
        total = data?.reduce((a, b) => a + (b.value || 0), 0) || 0;
      }
      const { data: scored } = await supabase
        .from("scored_instance_values")
        .select("pcode,score")
        .eq("instance_id", instance.id)
        .in("pcode", affected);
      const avg = scored?.reduce((a, b) => a + (b.score || 0), 0) / (scored?.length || 1);
      setSummary({
        population: total,
        concern: Math.round(total * (avg / 5) * 0.5),
        need: Math.round(total * (avg / 5)),
        avg,
      });

      const { data: top } = await supabase
        .from("scored_instance_values")
        .select("pcode,score")
        .eq("instance_id", instance.id)
        .in("pcode", affected)
        .order("score", { ascending: false });
      const { data: bounds } = await supabase
        .from("admin_boundaries")
        .select("admin_pcode,name,parent_pcode,admin_level");

      const map = new Map(bounds.map((b: any) => [b.admin_pcode, b]));
      const resolve = (c: string) => {
        const a3 = map.get(c);
        if (!a3 || a3.admin_level === "ADM0") return { adm1: "—", adm2: "—", adm3: c };
        const a2 = map.get(a3.parent_pcode);
        const a1 = map.get(a2?.parent_pcode);
        if (a1?.admin_level === "ADM0") return { adm1: "—", adm2: a2?.name || "—", adm3: a3?.name || c };
        return { adm1: a1?.name || "—", adm2: a2?.name || "—", adm3: a3?.name || c };
      };
      setTopAreas(top.map((r: any) => ({ ...r, ...resolve(r.pcode) })));
    })();
  }, [instance, scores, affected]);

  useEffect(() => {
    if (!instance || !affected.length) return;
    supabase
      .from("scored_instance_values")
      .select("score,pcode,dataset_id,datasets(id,name,category)")
      .eq("instance_id", instance.id)
      .in("pcode", affected)
      .then(({ data }) => {
        if (!data) return;
        const grouped: any = {};
        for (const r of data) {
          const cat = r.datasets?.category || "Uncategorized";
          const ds = r.datasets?.name || "Unnamed";
          grouped[cat] ??= {};
          grouped[cat][ds] ??= [];
          grouped[cat][ds].push(r.score || 0);
        }
        const order = [
          "SSC Framework - P1",
          "SSC Framework - P2",
          "SSC Framework - P3",
          "Hazard",
          "Underlying Vulnerability",
          "Uncategorized",
        ];
        const result = Object.entries(grouped).map(([cat, d]: any) => ({
          category: cat,
          datasets: Object.entries(d).map(([n, s]: any) => ({
            name: n,
            avg: s.reduce((a: any, b: any) => a + b, 0) / s.length,
            min: Math.min(...s),
            max: Math.max(...s),
          })),
        }));
        result.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
        setCategories(result);
      });
  }, [instance, scores, affected]);

  const recompute = async () => {
    await supabase.rpc("score_instance_overall", { in_instance: instance.id });
    const { data } = await supabase
      .from("scored_instance_values")
      .select("pcode,score")
      .eq("instance_id", instance.id)
      .in("pcode", affected);
    setScores(data || []);
  };

  return (
    <div className="p-4 text-sm space-y-3">
      {instance && (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-semibold">{instance.name}</h1>
              <p className="text-gray-500 text-xs">{instance.description || "description"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowArea(true)} className="px-2 py-1 border rounded bg-gray-100 text-xs">Define Area</button>
              <button onClick={() => setShowConfig(true)} className="px-2 py-1 border rounded bg-gray-100 text-xs">Datasets</button>
              <button onClick={recompute} className="px-2 py-1 border rounded bg-blue-600 text-white text-xs">Recompute</button>
            </div>
          </div>

          {/* Summary above map */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Summary title="Population" val={summary?.population} />
            <Summary title="Concern" val={summary?.concern} color="text-red-600" />
            <Summary title="Need" val={summary?.need} color="text-orange-600" />
            <Summary title="Severity" val={summary?.avg?.toFixed(2)} color="text-blue-600" />
          </div>

          {/* Map */}
          <div className="bg-white border rounded shadow-sm p-2">
            <div className="flex justify-between items-center mb-1">
              <h2 className="font-medium">Map Overview</h2>
              <button onClick={() => setZoomLocked(!zoomLocked)} className="text-xs flex items-center gap-1 text-gray-500">
                {zoomLocked ? <Lock size={12} /> : <Unlock size={12} />} {zoomLocked ? "Locked" : "Unlocked"}
              </button>
            </div>
            <MapContainer
              center={[10.3, 123.9]}
              zoom={8}
              scrollWheelZoom={!zoomLocked}
              dragging={!zoomLocked}
              style={{ height: "400px", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {features.map((f, i) => (
                <GeoJSON
                  key={i}
                  data={f.geom_json}
                  style={{ color: "#333", weight: 0.4, fillOpacity: 0.8, fillColor: colorFor(f.score) }}
                />
              ))}
            </MapContainer>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white border rounded shadow-sm p-2">
            <h3 className="font-medium mb-1">Category Breakdown</h3>
            {categories.map((c, i) => (
              <div key={i} className="border rounded mb-1">
                <div
                  onClick={() => setExpanded(expanded === c.category ? null : c.category)}
                  className="flex justify-between bg-gray-100 px-2 py-1 cursor-pointer hover:bg-gray-200"
                >
                  <span>{c.category}</span>
                  <span className="text-blue-600 text-xs">
                    {(c.datasets.reduce((a, d) => a + d.avg, 0) / c.datasets.length).toFixed(2)}
                  </span>
                </div>
                {expanded === c.category && (
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-1 text-left">Dataset</th>
                        <th className="p-1 text-right">Min</th>
                        <th className="p-1 text-right">Avg</th>
                        <th className="p-1 text-right">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.datasets.map((d, j) => (
                        <tr key={j} className="border-t hover:bg-gray-50">
                          <td className="p-1">{d.name}</td>
                          <td className="p-1 text-right">{d.min.toFixed(2)}</td>
                          <td className="p-1 text-right text-blue-600">{d.avg.toFixed(2)}</td>
                          <td className="p-1 text-right">{d.max.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>

          {/* Most Affected Areas */}
          <div className="bg-white border rounded shadow-sm p-2">
            <h3 className="font-medium mb-1">Most Affected Areas</h3>
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-1">ADM1</th>
                  <th className="p-1">ADM2</th>
                  <th className="p-1">ADM3</th>
                  <th className="p-1 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? topAreas : topAreas.slice(0, 5)).map((a, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-1">{a.adm1}</td>
                    <td className="p-1">{a.adm2}</td>
                    <td className="p-1">{a.adm3}</td>
                    <td className="p-1 text-right text-red-600">{a.score.toFixed(2)}</td>
                  </tr>
                ))}
                {topAreas.length > 5 && (
                  <tr>
                    <td colSpan={4} className="text-center py-1">
                      <button className="text-blue-600 text-xs hover:underline" onClick={() => setShowAll(!showAll)}>
                        {showAll ? "Show Less" : "Show More"}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {showConfig && <InstanceDatasetConfigModal instance={instance} onClose={() => setShowConfig(false)} onSaved={recompute} />}
      {showArea && <DefineAffectedAreaModal instance={instance} onClose={() => setShowArea(false)} onSaved={recompute} />}
    </div>
  );
}

function Summary({ title, val, color }: { title: string; val: any; color?: string }) {
  return (
    <div className="p-2 bg-gray-50 rounded text-center">
      <p className="text-xs text-gray-500">{title}</p>
      <p className={`font-semibold ${color || ""}`}>{val ? val.toLocaleString() : "—"}</p>
    </div>
  );
}
