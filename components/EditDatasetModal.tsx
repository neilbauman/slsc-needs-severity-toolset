"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function EditDatasetModal({
  dataset,
  onClose,
  onUpdated,
}: EditDatasetModalProps) {
  const [form, setForm] = useState({
    name: dataset?.name || "",
    description: dataset?.description || "",
    admin_level: dataset?.admin_level ?? 2,
    type: dataset?.type || "numeric",
    indicator_id: dataset?.indicator_id || null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    if (!form.name.trim()) {
      setError("Dataset name is required.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("datasets")
        .update({
          name: form.name.trim(),
          description: form.description.trim(),
          admin_level: form.admin_level,
          type: form.type,
          indicator_id: form.indicator_id,
        })
        .eq("id", dataset.id);

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onUpdated?.(); // refresh list in parent
        onClose();
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-serif mb-4">Edit Dataset Metadata</h2>

        {/* Form Fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border p-2 w-full rounded"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="border p-2 w-full rounded"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Admin Level</label>
            <select
              value={form.admin_level}
              onChange={(e) =>
                setForm({ ...form, admin_level: Number(e.target.value) })
              }
              className="border p-2 rounded w-full"
            >
              <option value={0}>Admin Level 0 (National)</option>
              <option value={1}>Admin Level 1 (Region)</option>
              <option value={2}>Admin Level 2 (Province)</option>
              <option value={3}>Admin Level 3 (Municipality)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Dataset Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="border p-2 rounded w-full"
            >
              <option value="numeric">Numeric</option>
              <option value="categorical">Categorical</option>
            </select>
          </div>
        </div>

        {/* Status + Buttons */}
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        {success && <p className="text-green-600 text-sm mt-2">Saved successfully!</p>}

        <div className="flex justify-end mt-5 space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1 border rounded hover:bg-gray-100"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
