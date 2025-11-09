"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";

interface DeleteDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteDatasetModal({ dataset, onClose, onDeleted }: DeleteDatasetModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!dataset) return;
    setError(null);
    setLoading(true);

    try {
      // Delete associated values first
      const valueTable =
        dataset.type === "numeric"
          ? "dataset_values_numeric"
          : "dataset_values_categorical";

      const { error: valuesError } = await supabase
        .from(valueTable)
        .delete()
        .eq("dataset_id", dataset.id);

      if (valuesError) throw valuesError;

      // Delete dataset record
      const { error: datasetError } = await supabase
        .from("datasets")
        .delete()
        .eq("id", dataset.id);

      if (datasetError) throw datasetError;

      onDeleted();
      onClose();
    } catch (err: any) {
      console.error("Delete error:", err);
      setError(err.message || "Failed to delete dataset");
    } finally {
      setLoading(false);
    }
  };

  if (!dataset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md relative">
        {/* Header */}
        <div className="flex justify-between items-start p-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Delete Dataset</h2>
            <p className="text-xs text-gray-500">This action cannot be undone.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 text-sm text-gray-700">
          <p>
            Are you sure you want to permanently delete the dataset{" "}
            <span className="font-semibold text-gray-900">"{dataset.name}"</span>?
          </p>
          <p className="text-xs text-gray-500">
            All associated data records will be deleted. This operation cannot be undone.
          </p>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end mt-4 space-x-2">
            <button
              onClick={onClose}
              className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium px-3 py-1.5 rounded text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-1.5 rounded text-sm"
            >
              {loading ? "Deleting..." : "Delete Dataset"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
