"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import UploadDatasetModal from "@/components/UploadDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";
import DeleteDatasetModal from "@/components/DeleteDatasetModal";
import ViewDatasetModal from "@/components/ViewDatasetModal";
import DeriveDatasetModal from "@/components/DeriveDatasetModal";

export default function DatasetsPage() {
  const supabase = createClient();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeriveModal, setShowDeriveModal] = useState(false);

  const [editDataset, setEditDataset] = useState<any | null>(null);
  const [viewDataset, setViewDataset] = useState<any | null>(null);
  const [deleteDataset, setDeleteDataset] = useState<any | null>(null);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("datasets")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setDatasets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const categories = [
    { label: "Core Datasets", match: (d: any) => d.category === "Core" },
    { label: "SSC Framework — Pillar 1 (The Shelter)", match: (d: any) => d.category === "SSC Framework - P1" },
    { label: "SSC Framework — Pillar 2 (Living Conditions)", match: (d: any) => d.category === "SSC Framework - P2" },
    { label: "SSC Framework — Pillar 3 (The Settlement)", match: (d: any) => d.category === "SSC Framework - P3" },
    { label: "Hazard Datasets", match: (d: any) => d.category === "Hazard" },
    { label: "Underlying Vulnerabilities", match: (d: any) => d.category === "Underlying Vulnerability" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Datasets</h1>
          <p className="text-sm text-gray-500">
            Manage baseline and derived datasets across the SSC framework.
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex space-x-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded text-sm"
          >
            + Add Dataset
          </button>
          <button
            onClick={() => setShowDeriveModal(true)}
            className="border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium px-4 py-2 rounded text-sm"
          >
            + Derive Dataset
          </button>
        </div>
      </div>

      {/* Datasets Table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading datasets...</p>
      ) : (
        <div className="space-y-8">
          {categories.map((group) => {
            const groupDatasets = datasets.filter(group.match);
            if (groupDatasets.length === 0) return null;

            return (
              <div key={group.label}>
                <h2 className="text-base font-semibold text-gray-700 mb-2">{group.label}</h2>
                <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm">
                  <table className="min-w-full text-sm text-gray-700">
                    <thead className="bg-gray-100 border-b text-xs uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="px-4 py-2 text-left w-[25%]">Name</th>
                        <th className="px-3 py-2 text-left w-[12%]">Type</th>
                        <th className="px-3 py-2 text-left w-[10%]">Admin Level</th>
                        <th className="px-3 py-2 text-left w-[16%]">Source</th>
                        <th className="px-3 py-2 text-left w-[15%]">Collected</th>
                        <th className="px-3 py-2 text-left w-[22%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupDatasets.map((dataset) => (
                        <tr
                          key={dataset.id}
                          className="border-b last:border-0 hover:bg-gray-50 transition"
                        >
                          <td className="px-4 py-2 font-medium text-gray-900 truncate">
                            {dataset.name}
                          </td>
                          <td className="px-3 py-2">{dataset.type || "—"}</td>
                          <td className="px-3 py-2">{dataset.admin_level || "—"}</td>
                          <td className="px-3 py-2 truncate max-w-[150px]">
                            {dataset.source || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {dataset.collected_at
                              ? new Date(dataset.collected_at).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => setViewDataset(dataset)}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                View
                              </button>
                              <button
                                onClick={() => setEditDataset(dataset)}
                                className="text-amber-600 hover:text-amber-800 font-medium text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteDataset(dataset)}
                                className="text-red-600 hover:text-red-800 font-medium text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showUploadModal && (
        <UploadDatasetModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={loadDatasets}
        />
      )}
      {showDeriveModal && (
        <DeriveDatasetModal
          onClose={() => setShowDeriveModal(false)}
          onDerived={loadDatasets}
        />
      )}
      {editDataset && (
        <EditDatasetModal
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSaved={loadDatasets}
        />
      )}
      {viewDataset && (
        <ViewDatasetModal
          dataset={viewDataset}
          onClose={() => setViewDataset(null)}
        />
      )}
      {deleteDataset && (
        <DeleteDatasetModal
          dataset={deleteDataset}
          onClose={() => setDeleteDataset(null)}
          onDeleted={loadDatasets}
        />
      )}
    </div>
  );
}
