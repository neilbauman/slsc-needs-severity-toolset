"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function EditDatasetModal({ dataset, onClose, onSaved }: EditDatasetModalProps) {
  const [name, setName] = useState(dataset?.name || "");
  const [description, setDescription] = useState(dataset?.description || "");
  const [type, setType] = useState(dataset?.type || "numeric");
  const [adminLevel, setAdminLevel] = useState(dataset?.admin_level || "");
  const [valueType, setValueType] = useState(dataset?.value_type || "absolute");
  const [category, setCategory] = useState(dataset?.category || "");

  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    // Load distinct categories already used — optional but convenient
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("datasets")
        .select("category")
        .not("category", "is", null);
      if (!error && data) {
        const distinct = Array.from(new Set(data.map((d) => d.category).filter(Boolean)));
        setCategories(distinct);
      }
    };
    loadCategories();
  }, []);

  const handleSave = async () => {
    const { error } = await supabase
      .from("datasets")
      .update({
        name,
        description,
        type,
        admin_level: adminLevel,
        value_type: valueType,
        category,
      })
      .eq("id", dataset.id);

    if (error) {
      console.error("Error updating dataset:", error);
      alert("Failed to save dataset changes.");
    } else {
      if (onSaved) onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5">
        <h2 className="text-lg font-semibold mb-4">Edit Dataset</h2>

        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded p-2 mb-3 text-sm"
        />

        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border rounded p-2 mb-3 text-sm"
          rows={2}
        />

        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full border rounded p-2 mb-3 text-sm"
        >
          <option value="numeric">Numeric</option>
          <option value="categorical">Categorical</option>
          <option value="derived">Derived</option>
        </select>

        <label className="block text-sm font-medium mb-1">Admin Level</label>
        <select
          value={adminLevel}
          onChange={(e) => setAdminLevel(e.target.value)}
          className="w-full border rounded p-2 mb-3 text-sm"
        >
          <option value="">Select Level</option>
          <option value="ADM1">ADM1</option>
          <option value="ADM2">ADM2</option>
          <option value="ADM3">ADM3</option>
          <option value="ADM4">ADM4</option>
        </select>

        <label className="block text-sm font-medium mb-1">Value Type</label>
        <select
          value={valueType}
          onChange={(e) => setValueType(e.target.value)}
          className="w-full border rounded p-2 mb-3 text-sm"
        >
          <option value="absolute">Absolute</option>
          <option value="relative">Relative</option>
        </select>

        {/* 🧩 New Category Field */}
        <label className="block text-sm font-medium mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border rounded p-2 mb-3 text-sm"
        >
          <option value="">— Select or Add Category —</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
          <option value="__custom__">+ Add new...</option>
        </select>

        {/* If user wants a custom category */}
        {category === "__custom__" && (
          <input
            type="text"
            placeholder="Enter new category"
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded p-2 mb-3 text-sm"
          />
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
