"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import UploadDatasetModal from "@/components/UploadDatasetModal";
import ViewDatasetModal from "@/components/ViewDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [selectedView, setSelectedView] = useState<any | null>(null);
  const [selectedEdit, setSelectedEdit] = useState<any | null>(null);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDatasets(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this dataset? This action cannot be undone.")) return;
    try {
      const { error } = await supabase.from("datasets").delete().eq("id", id);
      if (error) throw error;
      await fetchDatasets();
    } catch (err: any) {
      alert("Error deleting: " + err.message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-serif">Datasets</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Upload Dataset
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading datasets...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && datasets.length === 0 && (
        <p className="text-sm text-gray-600">No datasets available yet.</p>
      )}

      {!loading && datasets.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2 text-left">Name</th>
                <th className="border p-2 text-left">Description</th>
                <th className="border p-2 text-left">Type</th>
                <th className="border p-2 text-left">Admin Level</th>
                <th className="border p-2 text-left">Created</th>
                <th className="border p-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id} className="odd:bg-gray-50">
                  <td className="border p-2">{d.name}</td>
                  <td className="border p-2 text-gray-600">
                    {d.description || "-"}
                  </td>
                  <td className="border p-2">{d.type}</td>
                  <td className="border p-2 text-center">{d.admin_level}</td>
                  <td className="border p-2 text-gray-500">
                    {d.created_at
                      ? new Date(d.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="border p-2 text-center space-x-2">
                    <button
                      onClick={() => setSelectedView(d)}
                      className="px-2 py-1 border rounded hover:bg-gray-100"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setSelectedEdit(d)}
                      className="px-2 py-1 border rounded hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="px-2 py-1 border rounded text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showUpload && (
        <UploadDatasetModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            fetchDatasets();
          }}
        />
      )}

      {selectedView && (
        <ViewDatasetModal
          dataset={selectedView}
          onClose={() => setSelectedView(null)}
        />
      )}

      {selectedEdit && (
        <EditDatasetModal
          dataset={selectedEdit}
          onClose={() => setSelectedEdit(null)}
          onUpdated={() => fetchDatasets()}
        />
      )}
    </div>
  );
}
