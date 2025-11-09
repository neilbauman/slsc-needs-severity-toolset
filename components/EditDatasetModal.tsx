"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function EditDatasetModal({ dataset, onClose, onUpdated }: any) {
  const [form, setForm] = useState({
    name: dataset?.name || "",
    description: dataset?.description || "",
    admin_level: dataset?.admin_level || "ADM2",
    type: dataset?.type || "numeric",
    category: dataset?.category || "",
    is_baseline: dataset?.is_baseline || false,
    is_derived: dataset?.is_derived || false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
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
          category: form.category,
          is_baseline: form.is_baseline,
          is_derived: form.is_derived,
        })
        .eq("id", dataset.id);

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        onUpdated?.();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-serif mb-4">Edit Dataset Metadata</h2>

        <div className="space-y-3">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border p-2 w-full rounded"
            placeholder="Dataset name"
          />
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="border p-2 w-full rounded"
            placeholder="Description"
          />

          {/* Admin Level */}
          <label className="block text-sm font-medium">Admin Level</label>
          <select
            value={form.admin_level}
            onChange={(e) => setForm({ ...form, admin_level: e.target.value })}
            className="border p-2 rounded w-full"
          >
            <option value="ADM0">Admin Level 0 (National)</option>
            <option value="ADM1">Admin Level 1 (Region)</option>
            <option value="ADM2">Admin Level 2 (Province)</option>
            <option value="ADM3">Admin Level 3 (Municipality)</option>
            <option value="ADM4">Admin Level 4 (Barangay)</option>
            <option value="ADM5">Admin Level 5 (Sitio / Locality)</option>
          </select>

          {/* Dataset Type */}
          <label className="block text-sm font-medium">Dataset Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="border p-2 rounded w-full"
          >
            <option value="numeric">Numeric</option>
            <option value="categorical">Categorical</option>
          </select>

          {/* Category */}
          <label className="block text-sm font-medium">Dataset Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="border p-2 rounded w-full"
          >
            <option value="">Select category</option>
            <option value="SSC Framework - P1">SSC Framework – P1</option>
            <option value="SSC Framework - P2">SSC Framework – P2</option>
            <option value="SSC Framework - P3">SSC Framework – P3</option>
            <option value="Hazard">Hazard</option>
            <option value="Underlying Vulnerability">Underlying Vulnerability</option>
          </select>

          {/* Baseline / Derived Flags */}
          <div className="space-y-1 mt-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={form.is_baseline}
                onChange={(e) => setForm({ ...form, is_baseline: e.target.checked })}
              />
              <span>Baseline dataset</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={form.is_derived}
                onChange={(e) => setForm({ ...form, is_derived: e.target.checked })}
              />
              <span>Derived dataset</span>
            </label>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        {success && <p className="text-green-600 text-sm mt-2">Saved successfully!</p>}

        <div className="flex justify-end mt-5 space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1 border rounded hover:bg-gray-100"
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
