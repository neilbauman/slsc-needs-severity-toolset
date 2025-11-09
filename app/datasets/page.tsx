"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import ViewDatasetModal from "@/components/ViewDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";
import DeleteDatasetModal from "@/components/DeleteDatasetModal";
import UploadDatasetModal from "@/components/UploadDatasetModal";

export default function DatasetsPage() {
  const supabase = createClient();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewDataset, setViewDataset] = useState<any | null>(null);
  const [editDataset, setEditDataset] = useState<any | null>(null);
  const [deleteDataset, setDeleteDataset] = useState<any | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("datasets")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setDatasets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const groups = [
    { key: "Core", label: "Core" },
    { key: "SSC Framework - P1", label: "SSC Framework — Pillar 1 (The Shelter)" },
    { key: "SSC Framework - P2", label: "SSC Framework — Pillar 2 (Living Conditions)" },
    { key: "SSC Framework - P3", label: "SSC Framework — Pillar 3 (The Settlement)" },
    { key: "Hazards", label: "Hazards" },
    { key: "Underlying Vulnerability", label: "Underlying Vulnerabilities" },
  ];

  const renderGroup = (key: string, label: string) => {
    const groupDatasets = datasets.filter((d) => {
      if (key === "Core") return !d.category || d.category === "Core";
      return d.category === key;
    });

    if (groupDatasets.length === 0) return null;

    return (
      <div key={key} className="mb-6">
        <h3 className="font-semibold text-gray-800 text-sm mb-2 mt-4">{label}</h3>
        <div className="overflow-x-auto border rounded-md bg-white">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
              <tr>
                <th className="text-left p-2 border-b w-1/4">Name</th>
                <th className="text-left p-2 border-b w-20">Type</th>
                <th className="text-left p-2 border-b w-24">Admin Level</th>
                <th className="text-left p-2 border-b w-1/6">Source</th>
                <th className="text-left p-2 border-b w-1/6">Collected</th>
                <th className="text-left p-2 border-b text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupDatasets.map((dataset, i) => (
                <tr
                  key={dataset.id}
                  className={`text-gray-700 hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <td className="p-2 border-b font-medium truncate">{dataset.name}</td>
                  <td className="p-2 border-b capitalize">{dataset.type || "—"}</td>
                  <td className="p-2 border-b">{dataset.admin_level || "—"}</td>
                  <td className="p-2 border-b text-gray-500">
                    {dataset.source || dataset.metadata?.source || "—"}
                  </td>
                  <td className="p-2 border-b text-gray-500">
                    {dataset.collected_at || "—"}
                  </td>
                  <td className="p-2 border-b text-center space-x-2">
                    <button
                      onClick={() => setViewDataset(dataset)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setEditDataset(dataset)}
                      className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteDataset(dataset)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Datasets</h1>
          <p className="text-gray-500 text-sm">
            Manage, view, and derive baseline and hazard datasets.
          </p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3 py-2 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            + Upload Dataset
          </button>
          <button
            disabled
            className="px-3 py-2 text-xs rounded-md bg-gray-200 text-gray-600 cursor-not-allowed"
          >
            + Derived Dataset
          </button>
        </div>
      </div>

      {/* Table Groups */}
      {loading ? (
        <p className="text-gray-500 text-sm mt-6">Loading datasets...</p>
      ) : datasets.length === 0 ? (
        <p className="text-gray-500 text-sm mt-6">No datasets available.</p>
      ) : (
        groups.map((g) => renderGroup(g.key, g.label))
      )}

      {/* Modals */}
      {viewDataset && (
        <ViewDatasetModal
          dataset={viewDataset}
          onClose={() => setViewDataset(null)}
        />
      )}
      {editDataset && (
        <EditDatasetModal
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSaved={() => loadDatasets()}
        />
      )}
      {deleteDataset && (
        <DeleteDatasetModal
          dataset={deleteDataset}
          onClose={() => setDeleteDataset(null)}
          onDeleted={() => loadDatasets()}
        />
      )}
      {showUploadModal && (
        <UploadDatasetModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => loadDatasets()}
        />
      )}
    </div>
  );
}
