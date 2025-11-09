"use client";

import { createClient } from "@/lib/supabaseClient";
import { useState } from "react";

interface DeleteDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteDatasetModal({
  dataset,
  onClose,
  onDeleted,
}: DeleteDatasetModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("datasets")
        .delete()
        .eq("id", dataset.id);

      if (error) throw error;

      // After delete, call onDeleted (to reload datasets)
      onDeleted();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to delete dataset");
    } finally {
      setLoading(false);
    }
  };

  if (!dataset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-2xl font-light"
        >
          ×
        </button>

        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Delete Dataset
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete{" "}
          <strong>{dataset.name}</strong>? This action cannot be undone.
        </p>

        {error && (
          <p className="text-red-600 text-sm mb-3">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className={`px-3 py-2 text-sm rounded-md text-white ${
              loading ? "bg-red-400" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
