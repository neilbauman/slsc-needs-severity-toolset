"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import ViewDatasetModal from "@/components/ViewDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";
import DeleteDatasetModal from "@/components/DeleteDatasetModal";

export default function DatasetsPage() {
  const supabase = createClient();

  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<any | null>(null);
  const [editDataset, setEditDataset] = useState<any | null>(null);
  const [deleteDataset, setDeleteDataset] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDatasets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching datasets:", error);
        setDatasets([]);
      } else {
        const parsed = (data || []).map((d) => ({
          ...d,
          metadata:
            typeof d.metadata === "string"
              ? safeParseJSON(d.metadata)
              : d.metadata || {},
        }));
        setDatasets(parsed);
      }
      setLoading(false);
    };

    fetchDatasets();
  }, []);

  const safeParseJSON = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  };

  // Helper to group datasets
  const groupDatasets = (datasets: any[]) => {
    const groups: Record<string, any[]> = {
      Core: [],
      "SSC Framework - P1": [],
      "SSC Framework - P2": [],
      "SSC Framework - P3": [],
      Hazard: [],
      "Underlying Vulnerability": [],
      Other: [],
    };

    datasets.forEach((d) => {
      const cat = d.category || "Other";
      if (groups[cat]) groups[cat].push(d);
      else groups["Other"].push(d);
    });

    return groups;
  };

  const groups = groupDatasets(datasets);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading datasets...</div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-800">Datasets</h1>
        <p className="text-gray-500">
          Manage, view, and derive baseline data
        </p>
      </header>

      {Object.entries(groups).map(([groupName, items]) =>
        items.length > 0 ? (
          <section key={groupName}>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              {groupName === "Underlying Vulnerability"
                ? "Underlying Vulnerabilities"
                : groupName === "Hazard"
                ? "Hazards / Risks"
                : groupName === "SSC Framework - P1"
                ? "SSC Framework — Pillar 1 (The Shelter)"
                : groupName === "SSC Framework - P2"
                ? "SSC Framework — Pillar 2 (Living Conditions)"
                : groupName === "SSC Framework - P3"
                ? "SSC Framework — Pillar 3 (The Settlement)"
                : groupName}
            </h2>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm text-gray-700">
                <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Admin Level</th>
                    <th className="px-4 py-2 text-left">Source</th>
                    <th className="px-4 py-2 text-left">Collected</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((dataset) => (
                    <tr
                      key={dataset.id}
                      className="border-t hover:bg-gray-50 transition"
                    >
                      <td className="px-4 py-2 font-medium text-gray-800">
                        {dataset.name}
                      </td>
                      <td className="px-4 py-2">{dataset.type || "—"}</td>
                      <td className="px-4 py-2">{dataset.admin_level || "—"}</td>
                      <td className="px-4 py-2">
                        {dataset.metadata?.source || "—"}
                      </td>
                      <td className="px-4 py-2">
                        {dataset.collected_at
                          ? new Date(dataset.collected_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-2 space-x-3">
                        <button
                          onClick={() => setSelectedDataset(dataset)}
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setEditDataset(dataset)}
                          className="text-yellow-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteDataset(dataset)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null
      )}

      {selectedDataset && (
        <ViewDatasetModal
          dataset={selectedDataset}
          onClose={() => setSelectedDataset(null)}
        />
      )}

      {editDataset && (
        <EditDatasetModal
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSaved={() => window.location.reload()}
        />
      )}

      {deleteDataset && (
        <DeleteDatasetModal
          dataset={deleteDataset}
          onClose={() => {
            setDeleteDataset(null);
            window.location.reload(); // ✅ moved here to avoid onDeleted prop mismatch
          }}
        />
      )}
    </div>
  );
}
