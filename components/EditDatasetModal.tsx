"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export default function EditDatasetModal({
  dataset,
  onClose,
}: {
  dataset: any;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: dataset?.name || "",
    description: dataset?.description || "",
    category: dataset?.category || "",
    admin_level: dataset?.admin_level || "",
    source: dataset?.source || "",
    format: dataset?.format || "",
    collected_at: dataset?.collected_at || "",
  });

  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("datasets")
      .update(formData)
      .eq("id", dataset.id);
    setSaving(false);
    if (!error) onClose();
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
              <option value="">Select category</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
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
              <option value="">Select level</option>
              {adminLevelOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Collected At
            </label>
            <input
              type="date"
              name="collected_at"
              value={
                formData.collected_at
                  ? formData.collected_at.slice(0, 10)
                  : ""
              }
              onChange={handleChange}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
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
