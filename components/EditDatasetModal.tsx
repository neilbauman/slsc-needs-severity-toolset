"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onUpdated?: () => void;
  onSaved?: () => void; // ✅ backward compatibility
}

const CATEGORY_OPTIONS = [
  "Core",
  "SSC Framework - P1",
  "SSC Framework - P2",
  "SSC Framework - P3",
  "Hazards",
  "Underlying Vulnerability",
];

const ADMIN_LEVELS = ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4"];
const DATA_TYPES = ["numeric", "categorical"];

export default function EditDatasetModal({
  dataset,
  onClose,
  onUpdated,
  onSaved,
}: EditDatasetModalProps) {
  const supabase = createClient();

  const [form, setForm] = useState({
    name: "",
    description: "",
    source: "",
    collected_at: "",
    type: "",
    category: "",
    admin_level: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (dataset) {
      setForm({
        name: dataset.name || "",
        description: dataset.description || "",
        source: dataset.source || dataset.metadata?.source || "",
        collected_at: dataset.collected_at || "",
        type: dataset.type || "",
        category: dataset.category || "",
        admin_level: dataset.admin_level || "",
      });
    }
  }, [dataset]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!dataset?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from("datasets")
        .update({
          name: form.name,
          description: form.description,
          source: form.source,
          collected_at: form.collected_at || null,
          type: form.type,
          category: form.category,
          admin_level: form.admin_level,
          metadata: { ...(dataset.metadata || {}), source: form.source },
        })
        .eq("id", dataset.id);

      if (updateError) throw updateError;

      setSuccess(true);
      if (onUpdated) onUpdated();
      if (onSaved) onSaved();

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error saving changes");
    } finally {
      setSaving(false);
    }
  };

  if (!dataset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 my-8 p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
        >
          ×
        </button>

        {/* Header */}
        <h2 className="text-2xl font-bold mb-1">Edit Dataset</h2>
        <p className="text-gray-500 mb-6">{dataset.name}</p>

        {/* Form */}
        <div className="space-y-4 text-sm">
          {/* Name */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
              rows={3}
            />
          </div>

          {/* Source */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Source</label>
            <input
              type="text"
              name="source"
              value={form.source}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* Collected At */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Collected At</label>
            <input
              type="date"
              name="collected_at"
              value={form.collected_at || ""}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Type</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select type</option>
              {DATA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Admin Level */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Admin Level</label>
            <select
              name="admin_level"
              value={form.admin_level}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select level</option>
              {ADMIN_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error / Success / Actions */}
        <div className="mt-6 flex justify-between items-center">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">Saved!</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded-md text-white ${
              saving ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
