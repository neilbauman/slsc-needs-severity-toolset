"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseClient";

interface DeriveDatasetModalProps {
  onClose: () => void;
  onDerived: () => void;
}

export default function DeriveDatasetModal({ onClose, onDerived }: DeriveDatasetModalProps) {
  const supabase = createClient();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [scalar, setScalar] = useState<number>(1);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Core");
  const [targetLevel, setTargetLevel] = useState("ADM3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDatasets = async () => {
      const { data, error } = await supabase
        .from("datasets")
        .select("id, name, admin_level, type")
        .eq("type", "numeric");
      if (!error) setDatasets(data);
    };
    loadDatasets();
  }, []);

  const handleDerive = async () => {
    if (!sourceId || !newName) {
      setError("Please select a source dataset and provide a name.");
      return;
    }
    setError(null);
    setLoading(true);

    const res = await fetch("/api/deriveDataset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: sourceId,
        scalar,
        new_name: newName,
        new_category: newCategory,
        target_admin_level: targetLevel,
      }),
    });

    const result = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(result.error || "Failed to derive dataset.");
      return;
    }

    onDerived();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex justify-between items-start border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Derive New Dataset</h2>
            <p className="text-xs text-gray-500">Create a dataset derived from an existing one.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 text-sm">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Source Dataset</label>
            <select
              className="w-full border border-gray-300 rounded p-2 text-sm"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Select source dataset</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.admin_level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">Scalar Value</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded p-2 text-sm"
              value={scalar}
              step="0.0001"
              onChange={(e) => setScalar(parseFloat(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1">Example: 0.2083 for population-to-household conversion.</p>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">New Dataset Name</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded p-2 text-sm"
              placeholder="e.g., Estimated Households 2020"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">Category</label>
            <select
              className="w-full border border-gray-300 rounded p-2 text-sm"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              <option>Core</option>
              <option>SSC Framework - P1</option>
              <option>SSC Framework - P2</option>
              <option>SSC Framework - P3</option>
              <option>Underlying Vulnerability</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">Target Admin Level</label>
            <select
              className="w-full border border-gray-300 rounded p-2 text-sm"
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value)}
            >
              <option>ADM0</option>
              <option>ADM1</option>
              <option>ADM2</option>
              <option>ADM3</option>
              <option>ADM4</option>
            </select>
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium px-3 py-1.5 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleDerive}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded text-sm"
          >
            {loading ? "Deriving..." : "Create Derived Dataset"}
          </button>
        </div>
      </div>
    </div>
  );
}
