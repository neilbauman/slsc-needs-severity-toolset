"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditDatasetModal({
  dataset,
  onClose,
  onUpdated,
}: EditDatasetModalProps) {
  const [form, setForm] = useState({
    name: dataset.name || "",
    category: dataset.category || "",
    admin_level: dataset.admin_level || "ADM3",
    type: dataset.type || "numeric",
    description: dataset.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("datasets")
      .update({
        name: form.name,
        category: form.category,
        admin_level: form.admin_level,
        type: form.type,
        description: form.description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dataset.id);

    if (error) {
      console.error("Error updating dataset:", error);
      setMessage("⚠️ Failed to save changes: " + error.message);
    } else {
      setMessage("✅ Dataset updated successfully!");
      await onUpdated();
      setTimeout(onClose, 1000);
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-[480px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            Edit Dataset
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Form Fields */}
        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm space-y-3">
          <div>
            <label className="block text-gray-700 font-medium">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full border rounded p-2 mt-1"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Category</label>
            <select
              value={form.category}
              onChange={(e) => handleChange("category", e.target.value)}
              className="w-full border rounded p-2 mt-1"
            >
              <option value="">Uncategorized</option>
              <option value="SSC Framework - P1">SSC Framework - P1</option>
              <option value="SSC Framework - P2">SSC Framework - P2</option>
              <option value="SSC Framework - P3">SSC Framework - P3</option>
              <option value="Hazard">Hazard</option>
              <option value="Exposure">Exposure</option>
              <option value="Vulnerability">Vulnerability</option>
              <option value="Underlying">Underlying</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-medium">
                Admin Level
              </label>
              <select
                value={form.admin_level}
                onChange={(e) => handleChange("admin_level", e.target.value)}
                className="w-full border rounded p-2 mt-1"
              >
                <option value="ADM1">ADM1</option>
                <option value="ADM2">ADM2</option>
                <option value="ADM3">ADM3</option>
                <option value="ADM4">ADM4</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium">Type</label>
              <select
                value={form.type}
                onChange={(e) => handleChange("type", e.target.value)}
                className="w-full border rounded p-2 mt-1"
              >
                <option value="numeric">Numeric</option>
                <option value="categorical">Categorical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="w-full border rounded p-2 mt-1 resize-none h-20"
              placeholder="Brief description of the dataset"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">
              Derived Dataset
            </label>
            <p className="text-sm text-gray-600 mt-1">
              {dataset.is_derived
                ? "Yes (Derived dataset – cannot change)"
                : "No (Raw dataset)"}
            </p>
          </div>

          {message && (
            <div
              className={`text-sm text-center mt-2 ${
                message.startsWith("✅") ? "text-green-600" : "text-red-600"
              }`}
            >
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-3 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
