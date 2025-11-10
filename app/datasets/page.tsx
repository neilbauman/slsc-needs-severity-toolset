"use client";

import { useEffect, useState } from "react";
import UploadDatasetModal from "@/components/UploadDatasetModal";
import DeriveDatasetModal from "@/components/DeriveDatasetModal";
import DatasetTable from "@/components/DatasetTable";
import { supabase } from "@/lib/supabaseClient";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeriveModal, setShowDeriveModal] = useState(false);
  const [viewDataset, setViewDataset] = useState(null);
  const [editDataset, setEditDataset] = useState(null);
  const [deleteDataset, setDeleteDataset] = useState(null);

  useEffect(() => {
    loadDatasets();
  }, []);

  async function loadDatasets() {
    const { data, error } = await supabase
      .from("datasets")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setDatasets(data);
    }
  }

  // Group datasets by category
  const grouped = datasets.reduce((acc, d) => {
    const cat = d.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {});

  // Define preferred category display order
  const categoryOrder = [
    "Core",
    "SSC Framework - P1",
    "SSC Framework - P2",
    "SSC Framework - P3",
    "Underlying Vulnerability",
    "Derived",
    "Uncategorized",
  ];

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = categoryOrder.indexOf(a);
    const bi = categoryOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Datasets</h1>
            <p className="text-sm text-gray-500">
              Manage, view, and derive baseline data.
            </p>
          </div>
          <div className="flex space-x-2 mt-4 sm:mt-0">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition"
            >
              Upload Dataset
            </button>
            <button
              onClick={() => setShowDeriveModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition"
            >
              Derive Dataset
            </button>
          </div>
        </div>

        {/* Dataset Groups */}
        {sortedCategories.map((category) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">
              {category}
            </h2>
            <div className="overflow-x-auto bg-white rounded-md shadow-sm border border-gray-200">
              <DatasetTable
                datasets={grouped[category]}
                onView={setViewDataset}
                onEdit={setEditDataset}
                onDelete={setDeleteDataset}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadDatasetModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={loadDatasets}
        />
      )}

      {/* Derive Modal */}
      {showDeriveModal && (
        <DeriveDatasetModal
          onClose={() => setShowDeriveModal(false)}
          onCreated={loadDatasets}
          datasets={datasets}
        />
      )}
    </div>
  );
}
