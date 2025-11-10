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
  const [form, setForm] = useState({
    name: dataset?.name || "",
    description: dataset?.description || "",
    source: dataset?.source || "",
    collected_at: dataset?.collected_at || "",
    type: dataset?.type || "",
    category: dataset?.category || "",
    admin_level: dataset?.admin_level || "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  async function handleSave() {
    setLoading(true);

    const { error } = await supabase
      .from("datasets")
      .update({
        name: form.name,
        description: form.description,
        source: form.source,
        collected_at: form.collected_at || null,
        type: form.type,
        category: form.category,
        admin_level: form.admin_level,
      })
      .eq("id", dataset.id);

    setLoading(false);
    if (error) {
      alert(`Failed to update dataset: ${error.message}`);
    } else {
      await onUpdated();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Edit Dataset
        </h2>

        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Name *
            </label>
            <input
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Source
            </label>
            <input
              name="source"
              type="text"
              value={form.source}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Collected At
            </label>
            <input
              name="collected_at"
              type="date"
              value={form.collected_at?.split("T")[0] || ""}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Type *
            </label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select type</option>
              <option value="numeric">Numeric</option>
              <option value="categorical">Categorical</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Category *
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select category</option>
              <option value="Core">Core</option>
              <option value="SSC Framework - P1">SSC Framework - P1</option>
              <option value="SSC Framework - P2">SSC Framework - P2</option>
              <option value="SSC Framework - P3">SSC Framework - P3</option>
              <option value="Underlying Vulnerability">Underlying Vulnerability</option>
              <option value="Derived">Derived</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Admin Level *
            </label>
            <select
              name="admin_level"
              value={form.admin_level}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select admin level</option>
              <option value="ADM0">ADM0</option>
              <option value="ADM1">ADM1</option>
              <option value="ADM2">ADM2</option>
              <option value="ADM3">ADM3</option>
              <option value="ADM4">ADM4</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
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
