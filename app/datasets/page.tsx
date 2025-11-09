"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import DashboardHeader from "@/components/DashboardHeader";
import EditDatasetModal from "@/components/EditDatasetModal";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Normalize pcode helper
const normalizePcode = (p: string | null) => {
  if (!p) return null;
  let code = p.trim().toUpperCase();
  if (!code.startsWith("PH")) code = "PH" + code;
  if (code.length < 13) {
    const prefix = code.slice(0, 2);
    const body = code.slice(2);
    code = prefix + body.padStart(11, "0");
  }
  return code.slice(0, 13);
};

export default function DatasetsPage() {
  const router = useRouter();
  const [adminStats, setAdminStats] = useState<any[]>([]);
  const [gisLayers, setGisLayers] = useState<any[]>([]);
  const [population, setPopulation] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const [
        { data: adminsData },
        { data: gis },
        { data: pop },
        { data: dsets },
      ] = await Promise.all([
        supabase.from("admin_boundaries").select("admin_level"),
        supabase.from("gis_layers").select("*").order("created_at", { ascending: false }),
        supabase.from("population_data").select("admin_level, source").limit(1),
        supabase.from("datasets").select("*").order("created_at", { ascending: false }),
      ]);

      // group admin levels manually
      const groupedAdmins = (adminsData || []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.admin_level] = (acc[row.admin_level] || 0) + 1;
        return acc;
      }, {});
      const adminStatsArr = Object.entries(groupedAdmins).map(([level, count]) => ({
        admin_level: level,
        count,
      }));

      setAdminStats(adminStatsArr);
      setGisLayers(gis || []);
      setPopulation(pop || []);
      setDatasets(dsets || []);
      setLoading(false);
    };

    fetchAll();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this dataset?")) return;
    const { error } = await supabase.from("datasets").delete().eq("id", id);
    if (error) alert("Delete failed: " + error.message);
    else setDatasets(datasets.filter((d) => d.id !== id));
  };

  const openEditModal = (dataset: any) => {
    setSelectedDataset(dataset);
    setEditModalOpen(true);
  };

  if (loading)
    return <div className="p-10 text-center text-gray-500">Loading datasets...</div>;

  const categories = [
    "SSC Framework - P1",
    "SSC Framework - P2",
    "SSC Framework - P3",
    "Hazard",
    "Underlying Vulnerability",
  ];
  const grouped = categories.map((cat) => ({
    name: cat,
    items: datasets.filter((d) => d.category === cat),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader title="Datasets" subtitle="Manage, view, and derive baseline data" />

      <div className="p-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-600 mb-6">
          <Link href="/" className="hover:underline">
            Home
          </Link>{" "}
          / <span className="text-gray-800 font-semibold">Datasets</span>
        </nav>

        {/* Header Bar */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">All Datasets</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/datasets/upload")}
              className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm"
            >
              Upload Dataset
            </button>
            <button
              onClick={() => router.push("/datasets/derive")}
              className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 text-sm"
            >
              Derive New Dataset
            </button>
          </div>
        </div>

        {/* Core Data Section */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 border-b pb-1">Core Data</h2>

          {/* Admin Boundaries */}
          <div className="border rounded p-4 mb-4 bg-white">
            <h3 className="font-semibold mb-2">Administrative Boundaries</h3>
            <table className="w-full text-sm border-collapse mb-2">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-1 text-left">Admin Level</th>
                  <th className="border p-1 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {adminStats.map((row) => (
                  <tr key={row.admin_level}>
                    <td className="border p-1">{row.admin_level}</td>
                    <td className="border p-1 text-right">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="text-blue-600 hover:underline text-sm">View Map</button>
          </div>

          {/* Population */}
          <div className="border rounded p-4 mb-4 bg-white">
            <h3 className="font-semibold mb-1">Population</h3>
            {population.length > 0 ? (
              <p className="text-sm text-gray-700">
                Available at <strong>{population[0].admin_level}</strong> level
                <br />
                Source: {population[0].source || "Unknown"}
              </p>
            ) : (
              <p className="text-sm text-gray-500">No population data found.</p>
            )}
          </div>

          {/* GIS Layers */}
          <div className="border rounded p-4 bg-white">
            <h3 className="font-semibold mb-2">GIS Layers</h3>
            {gisLayers.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-1 text-left">Name</th>
                    <th className="border p-1 text-left">Type</th>
                    <th className="border p-1 text-left">Source</th>
                    <th className="border p-1 text-left">Join Level</th>
                    <th className="border p-1 text-left">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {gisLayers.map((l) => (
                    <tr key={l.id}>
                      <td className="border p-1">{l.name}</td>
                      <td className="border p-1">{l.layer_type}</td>
                      <td className="border p-1">{l.source || "-"}</td>
                      <td className="border p-1">
                        {l.layer_type === "vector" ? "ADM3/ADM4 (via pcode)" : "Spatial overlay"}
                      </td>
                      <td className="border p-1">
                        {l.data_url ? (
                          <a
                            href={l.data_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No GIS layers registered.</p>
            )}
          </div>
        </section>

        {/* Baseline Datasets */}
        <section>
          <h2 className="text-xl font-semibold mb-3 border-b pb-1">Baseline Datasets</h2>
          {grouped.map((group) => (
            <div key={group.name} className="border rounded p-4 mb-4 bg-white">
              <h3 className="font-semibold mb-2">{group.name}</h3>
              {group.items.length > 0 ? (
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-1 text-left">Name</th>
                      <th className="border p-1 text-left">Admin Level</th>
                      <th className="border p-1 text-left">Type</th>
                      <th className="border p-1 text-left">Join Confidence</th>
                      <th className="border p-1 text-left">Created</th>
                      <th className="border p-1 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((d) => {
                      const normalized = normalizePcode(d.admin_pcode || "");
                      const joinType =
                        normalized && normalized.length === 13
                          ? "Direct (normalized)"
                          : "Adjusted (zero-padded)";
                      return (
                        <tr key={d.id}>
                          <td className="border p-1">{d.name}</td>
                          <td className="border p-1">{d.admin_level}</td>
                          <td className="border p-1">{d.type}</td>
                          <td className="border p-1">{joinType}</td>
                          <td className="border p-1">
                            {new Date(d.created_at).toLocaleDateString()}
                          </td>
                          <td className="border p-1">
                            <div className="flex gap-2">
                              <button
                                onClick={() => router.push(`/datasets/${d.id}`)}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                View
                              </button>
                              <button
                                onClick={() => openEditModal(d)}
                                className="text-amber-600 hover:underline text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(d.id)}
                                className="text-red-600 hover:underline text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-500">
                  No datasets found under {group.name}.
                </p>
              )}
            </div>
          ))}
        </section>
      </div>

      {/* Edit Dataset Modal */}
      {editModalOpen && (
        <EditDatasetModal
          dataset={selectedDataset}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
}
