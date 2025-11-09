"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseClient";

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditDatasetModal({ dataset, onClose, onSaved }: EditDatasetModalProps) {
  const supabase = createClient();
  const [name, setName] = useState(dataset?.name || "");
  const [description, setDescription] = useState(dataset?.description || "");
  const [source, setSource] = useState(dataset?.source || "");
  const [collectedAt, setCollectedAt] = useState(dataset?.collected_at || "");
  const [type, setType] = useState(dataset?.type || "");
  const [category, setCategory] = useState(dataset?.category || "");
  const [adminLevel, setAdminLevel] = useState(dataset?.admin_level || "");
  const [format, setFormat] = useState(dataset?.metadata?.format || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dataset) {
      setName(dataset.name || "");
      setDescription(dataset.description || "");
      setSource(dataset.source || "");
      setCollectedAt(dataset.collected_at || "");
      setType(dataset.type || "");
      setCategory(dataset.category || "");
      setAdminLevel(dataset.admin_level || "");
      setFormat(dataset.metadata?.format || "");
    }
  }, [dataset]);

  const handleSave = async () => {
    if (!name || !type || !category || !adminLevel) {
      setError("Please complete all required fields.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { error: updateError } = await supabase
        .from("datasets")
        .update({
          name,
          description,
          source,
          collected_at: collectedAt || null,
          type,
          category,
          admin_level: adminLevel,
          metadata: { format },
          updated_at: new Date().toISOString(),
        })
        .eq("id", dataset.id);

      if (updateError) throw updateError;

      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save dataset");
    } finally {
      setSaving(false);
    }
  };

  if (!dataset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl relative max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start p-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Edit Dataset</h2>
            <p className="text-xs text-gray-500">Modify dataset metadata and settings.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-3 text-sm text-gray-700">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Source</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium mb-1">Collected At</label>
              <input
                type="date"
                value={collectedAt}
                onChange={(e) => setCollectedAt(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="">Select type</option>
                <option value="numeric">Numeric</option>
                <option value="categorical">Categorical</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="">Select category</option>
                <option value="Core">Core</option>
                <option value="SSC Framework - P1">SSC Framework - P1</option>
                <option value="SSC Framework - P2">SSC Framework - P2</option>
                <option value="SSC Framework - P3">SSC Framework - P3</option>
                <option value="Underlying Vulnerability">Underlying Vulnerability</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Admin Level *</label>
              <select
                value={adminLevel}
                onChange={(e) => setAdminLevel(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="">Select admin level</option>
                <option value="ADM0">ADM0</option>
                <option value="ADM1">ADM1</option>
                <option value="ADM2">ADM2</option>
                <option value="ADM3">ADM3</option>
                <option value="ADM4">ADM4</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Format</label>
              <input
                type="text"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex justify-end mt-4 space-x-2">
            <button
              onClick={onClose}
              className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium px-3 py-1.5 rounded text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded text-sm"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
