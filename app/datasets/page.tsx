"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import DatasetTable from "@/components/DatasetTable";
import UploadDatasetModal from "@/components/UploadDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";
import ViewDatasetModal from "@/components/ViewDatasetModal";
import DeleteDatasetModal from "@/components/DeleteDatasetModal";
import DeriveDatasetModal from "@/components/DeriveDatasetModal";

export default function DatasetsPage() {
  const supabase = createClient();

  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeriveModal, setShowDeriveModal] = useState(false);
  const [editDataset, setEditDataset] = useState<any | null>(null);
  const [viewDataset, setViewDataset] = useState<any | null>(null);
  const [deleteDataset, setDeleteDataset] = useState<any | null>(null);

  // Load datasets
  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("datasets")
      .select("*")
      .order("category", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading datasets:", error);
      setError(error.message);
    } else {
      setDatasets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  // Group datasets by category
  const grouped = datasets.reduce((acc: any, ds: any) => {
    const cat = ds.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ds);
    return acc;
  }, {});

  // ✅ This array must be properly closed before returning JSX
  const categoryOrder = [
    "Core",
    "SSC Framework - P1",
    "SSC Framework - P2",
    "SSC Framework - P3",
    "Hazard",
    "Underlying Vulnerability",
    "Derived",
    "Uncategorized",
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Datasets</h1>
            <p className="text-sm text-gray-500">
              Manage, upload, and derive datasets for Smart Safe Communities.
            </p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Upload
            </button>
            <button
              onClick={() => setShowDeriveModal(true)}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              + Derive
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm mb-4">Error: {error}</p>
        )}
        {loading && <p className="text-gray-500 text-sm">Loading datasets...</p>}

        {!loading &&
          categoryOrder.map((cat) =>
            grouped[cat] ? (
              <div key={cat} className="mb-8">
                <h2 className="text-md font-semibold text-gray-700 mb-3 border-b pb-1">
                  {cat}
                </h2>
                <DatasetTable
                  datasets={grouped[cat]}
                  onEdit={setEditDataset}
                  onView={setViewDataset}
                  onDelete={setDeleteDataset}
                />
              </div>
            ) : null
          )}
      </main>

      {/* Modals */}
      {showUploadModal && (
        <UploadDatasetModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={loadDatasets}
        />
      )}

      {showDeriveModal && (
        <DeriveDatasetModal
          datasets={datasets}
          onClose={() => setShowDeriveModal(false)}
          onCreated={loadDatasets} // ✅ fixed prop name
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
