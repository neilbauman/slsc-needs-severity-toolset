"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import DatasetTable from "@/components/DatasetTable";
import ViewDatasetModal from "@/components/ViewDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";
import DeleteDatasetModal from "@/components/DeleteDatasetModal";
import DeriveDatasetModal from "@/components/DeriveDatasetModal";
import TransformDatasetModal from "@/components/TransformDatasetModal";
import Header from "@/components/Header";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewDataset, setViewDataset] = useState(null);
  const [editDataset, setEditDataset] = useState(null);
  const [deleteDataset, setDeleteDataset] = useState(null);
  const [deriveDataset, setDeriveDataset] = useState(false);
  const [transformDataset, setTransformDataset] = useState(null);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("datasets")
      .select("*, category")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading datasets:", error);
    } else {
      setDatasets(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  // Group by category
  const grouped = datasets.reduce((acc, d) => {
    const cat = d.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">Datasets</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setDeriveDataset(true)}
              className="bg-blue-600 text-white text-sm px-3 py-1 rounded hover:bg-blue-700"
            >
              Create Derived
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading datasets...</p>
        ) : (
          Object.keys(grouped).map((cat) => (
            <div key={cat} className="mb-6">
              <h2 className="text-md font-medium mb-2 border-b border-gray-200 pb-1">
                {cat}
              </h2>
              <div className="overflow-x-auto bg-white border border-gray-200 rounded-md shadow-sm">
                <DatasetTable
                  datasets={grouped[cat]}
                  onView={setViewDataset}
                  onEdit={setEditDataset}
                  onDelete={setDeleteDataset}
                  onTransform={setTransformDataset}
                />
              </div>
            </div>
          ))
        )}

        {/* --- Modals --- */}
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
            onUpdated={loadDatasets}
          />
        )}

        {deleteDataset && (
          <DeleteDatasetModal
            dataset={deleteDataset}
            onClose={() => setDeleteDataset(null)}
            onDeleted={loadDatasets}
          />
        )}

        {deriveDataset && (
          <DeriveDatasetModal
            onClose={() => setDeriveDataset(false)}
            onDerived={loadDatasets}
          />
        )}

        {transformDataset && (
          <TransformDatasetModal
            dataset={transformDataset}
            onClose={() => setTransformDataset(null)}
            onTransformed={loadDatasets}
          />
        )}
      </main>
    </div>
  );
}
