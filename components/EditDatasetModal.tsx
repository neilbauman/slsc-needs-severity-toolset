"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

export default function EditDatasetModal({
  dataset,
  onClose,
  onUpdated,
}: EditDatasetModalProps) {
  const [name, setName] = useState(dataset?.name || "");
  const [description, setDescription] = useState(dataset?.description || "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const { error } = await supabase
      .from("datasets")
      .update({ name, description })
      .eq("id", dataset.id);

    setLoading(false);
    if (error) {
      alert(`Failed to update dataset: ${error.message}`);
    } else {
      await onUpdated(); // ✅ Refresh dataset list
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Edit Dataset</h2>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
