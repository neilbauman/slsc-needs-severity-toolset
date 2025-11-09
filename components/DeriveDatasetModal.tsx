"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabaseClient";

interface DeriveDatasetModalProps {
  datasets: any[];
  onClose: () => void;
  onCreated: () => void;
}

export default function DeriveDatasetModal({
  datasets,
  onClose,
  onCreated,
}: DeriveDatasetModalProps) {
  const supabase = createClient();

  const [mode, setMode] = useState<"scalar" | "join">("scalar");
  const [sourceA, setSourceA] = useState("");
  const [sourceB, setSourceB] = useState("");
  const [scalar, setScalar] = useState<number | null>(null);
  const [joinType, setJoinType] = useState("multiply");
  const [newName, setNewName] = useState("");
  const [category, setCategory] = useState("Derived");
  const [targetLevel, setTargetLevel] = useState("ADM3");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!sourceA) {
      setMessage("Please select at least one dataset.");
      return;
    }
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.rpc("derive_dataset_unified", {
      source_a: sourceA,
      source_b: mode === "join" ? sourceB : null,
      scalar: mode === "scalar" ? scalar : null,
      join_type: joinType,
      new_name: newName || "Derived Dataset",
      new_category: category || "Derived",
      target_admin_level: targetLevel,
    });

    setLoading(false);

    if (error) {
      console.error("Derivation error:", error);
      setMessage(`❌ Error: ${error.message}`);
      return;
    }

    setMessage("✅ Derived dataset created successfully!");
    onCreated();
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 relative">
        <h2 className="text-lg font-semibold mb-4">Create Derived Dataset</h2>

        {/* Mode Selection */}
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "scalar"}
              onChange={() => setMode("scalar")}
            />
            Scalar Mode
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "join"}
              onChange={() => setMode("join")}
            />
            Join Mode
          </label>
        </div>

        {/* Source Dataset(s) */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Primary Dataset</label>
            <select
              className="w-full border rounded p-2 text-sm mt-1"
              value={sourceA}
              onChange={(e) => setSourceA(e.target.value)}
            >
              <option value="">-- Select dataset --</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.category})
                </option>
              ))}
            </select>
          </div>

          {mode === "join" && (
            <div>
              <label className="text-sm font-medium">Secondary Dataset</label>
              <select
                className="w-full border rounded p-2 text-sm mt-1"
                value={sourceB}
                onChange={(e) => setSourceB(e.target.value)}
              >
                <option value="">-- Select dataset --</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.category})
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === "scalar" && (
            <div>
              <label className="text-sm font-medium">Scalar Value</label>
              <input
                type="number"
                className="w-full border rounded p-2 text-sm mt-1"
                placeholder="e.g. 0.25"
                value={scalar ?? ""}
                onChange={(e) => setScalar(parseFloat(e.target.value))}
              />
            </div>
          )}
        </div>

        {/* Operation & Metadata */}
        <div className="mt-4 space-y-3">
          {mode === "join" && (
            <div>
              <label className="text-sm font-medium">Join Operation</label>
              <select
                className="w-full border rounded p-2 text-sm mt-1"
                value={joinType}
                onChange={(e) => setJoinType(e.target.value)}
              >
                <option value="multiply">Multiply</option>
                <option value="add">Add</option>
                <option value="subtract">Subtract</option>
                <option value="divide">Divide</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">New Dataset Name</label>
            <input
              type="text"
              className="w-full border rounded p-2 text-sm mt-1"
              placeholder="e.g. Exposed Population"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <input
              type="text"
              className="w-full border rounded p-2 text-sm mt-1"
              placeholder="e.g. Underlying Vulnerability"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Target Admin Level</label>
            <select
              className="w-full border rounded p-2 text-sm mt-1"
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value)}
            >
              <option value="ADM4">ADM4</option>
              <option value="ADM3">ADM3</option>
              <option value="ADM2">ADM2</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>

        {message && (
          <p
            className={`mt-3 text-sm ${
              message.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
