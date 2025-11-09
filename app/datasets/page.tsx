"use client";

import React, { useEffect, useState } from "react";
import Header from "@/components/Header";
import DerivedDatasetModal from "@/components/DerivedDatasetModal"; // safe placeholder (renders null if stubbed)
import ViewDatasetModal from "@/components/ViewDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";
import DeleteDatasetModal from "@/components/DeleteDatasetModal";
import UploadDatasetModal from "@/components/UploadDatasetModal";
import { createClient } from "@/lib/supabaseClient";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  const [modalType, setModalType] = useState<
    "view" | "edit" | "delete" | "upload" | "derived" | null
  >(null);

  const supabase = createClient();

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const { data, error } = await supabase.from("datasets").select("*");
        if (error) throw error;
        setDatasets(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDatasets();
  }, [supabase]);

  const grouped = {
    Core: datasets.filter((d) => d.category?.toLowerCase() === "core"),
    "SSC Framework - P1": datasets.filter((d) =>
      d.category?.toLowerCase().includes("p1")
    ),
    "SSC Framework - P2": datasets.filter((d) =>
      d.category?.toLowerCase().includes("p2")
    ),
    "SSC Framework - P3": datasets.filter((d) =>
      d.category?.toLowerCase().includes("p3")
    ),
    Hazards: datasets.filter((d) =>
      d.category?.toLowerCase().includes("hazard")
    ),
    "Underlying Vulnerabilities": datasets.filter((d) =>
      d.category?.toLowerCase().includes("vulnerability")
    ),
    Uncategorized: datasets.filter((d) => !d.category),
  };

  const handleAction = (type: "view" | "edit" | "delete", dataset: any) => {
    setSelectedDataset(dataset);
    setModalType(type);
  };

  if (loading)
    return (
      <div className="p-6 text-gray-600 animate-pulse">
        Loading datasets...
      </div>
    );

  if (error)
    return (
      <div className="p-6 text-red-600">
        Error loading datasets: {error}
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Datasets</h1>
          <div className="flex space-x-3">
            <button
              onClick={() => setModalType("upload")}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
            >
              Upload Dataset
            </button>
            <button
              onClick={() => setModalType("derived")}
              className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1"
            >
              Create Derived Dataset
            </button>
          </div>
        </div>

        {Object.entries(grouped).map(([group, groupDatasets]) => (
          <div key={group} className="mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">
              {group}
            </h2>

            {groupDatasets.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No datasets available in this category.
              </p>
            ) : (
              <table className="min-w-full border border-gray-200 bg-white rounded shadow-sm">
                <thead className="bg-gray-100 text-gray-700 text-sm uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Admin Level</th>
                    <th className="px-4 py-2 text-left">Source</th>
                    <th className="px-4 py-2 text-left">Collected</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupDatasets.map((dataset) => (
                    <tr
                      key={dataset.id}
                      className="border-t hover:bg-gray-50 text-sm"
                    >
                      <td className="px-4 py-2">{dataset.name}</td>
                      <td className="px-4 py-2">{dataset.type}</td>
                      <td className="px-4 py-2">{dataset.admin_level}</td>
                      <td className="px-4 py-2">{dataset.source}</td>
                      <td className="px-4 py-2">
                        {dataset.collected_at
                          ? new Date(dataset.collected_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right space-x-2">
                        <button
                          onClick={() => handleAction("view", dataset)}
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleAction("edit", dataset)}
                          className="text-gray-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleAction("delete", dataset)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {modalType === "view" && selectedDataset && (
        <ViewDatasetModal
          dataset={selectedDataset}
          onClose={() => setModalType(null)}
        />
      )}
      {modalType === "edit" && selectedDataset && (
        <EditDatasetModal
          dataset={selectedDataset}
          onClose={() => setModalType(null)}
        />
      )}
      {modalType === "delete" && selectedDataset && (
        <DeleteDatasetModal
          dataset={selectedDataset}
          onClose={() => setModalType(null)}
        />
      )}
      {modalType === "upload" && (
        <UploadDatasetModal onClose={() => setModalType(null)} />
      )}
      {modalType === "derived" && (
        <DerivedDatasetModal onClose={() => setModalType(null)} />
      )}
    </div>
  );
}
