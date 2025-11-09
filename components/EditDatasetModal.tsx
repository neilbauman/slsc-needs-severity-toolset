"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export default function EditDatasetModal({
  dataset,
  onClose,
  onSaved,
}: {
  dataset: any;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: dataset?.name || "",
    description: dataset?.description || "",
    category: dataset?.category || "",
    admin_level: dataset?.admin_level || "",
    source: dataset?.source || dataset?.metadata?.source || "",
    format: dataset?.metadata?.format || "",
    collected_at: dataset?.collected_at
      ? dataset.collected_at.slice(0, 10)
      : "",
  });

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Clean up payload
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      category: formData.category || null,
      admin_level: formData.admin_level || null,
      collected_at: formData.collected_at || null,
      metadata: {
        ...(dataset.metadata || {}),
        source: formData.source || null,
        format: formData.format || null,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("datasets")
      .update(payload)
      .eq("id", dataset.id);

    setSaving(false);

    if (error) {
      console.error("Supabase update failed:", error);
      setError(error.message);
    } else {
      if (onSaved) onSaved();
      onClose();
    }
  };

  const categoryOptions = [
    "Core",
    "SSC Framework - P1",
    "SSC Framework - P2",
    "SSC Framework - P3",
    "Hazard",
    "Underlying Vulnerability",
  ];

  const adminLevelOptions = ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4", "ADM5"];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Edit Dataset
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full border rounded p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full border rounded p-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full border rounded p-2 text-sm"
              >
                <option value="">Select</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Level
              </label>
              <select
                name="admin_level"
                value={formData.admin_level}
                onChange={handleChange}
                className="w-full border rounded p-2 text-sm"
              >
                <option value="">Select</option>
                {adminLevelOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleChange}
                className="w-full border rounded p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Format
              </label>
              <input
                type="text"
                name="format"
                value={formData.format}
                onChange={handleChange}
                className="w-full border rounded p-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Collected At
            </label>
            <input
              type="date"
              name="collected_at"
              value={formData.collected_at}
              onChange={handleChange}
              className="w-full border rounded p-2 text-sm"
            />
          </div>

          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>

        <div className="flex justify-end mt-6 space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded text-white ${
              saving
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
