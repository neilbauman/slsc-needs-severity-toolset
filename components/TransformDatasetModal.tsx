"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function TransformDatasetModal({ dataset, onClose, onTransformed }) {
  const [targetLevel, setTargetLevel] = useState("ADM3");
  const [method, setMethod] = useState("distribute");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleTransform = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("transform_admin_level", {
      source_id: dataset.id,
      target_admin_level: targetLevel,
      method,
    });

    if (error) {
      console.error("Transform error:", error);
      setMessage("⚠️ " + error.message);
    } else {
      setMessage("✅ Transformation complete!");
      if (onTransformed) await onTransformed();
      setTimeout(onClose, 1200);
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-96 p-5 text-gray-800 border border-gray-200">
        <h2 className="text-lg font-semibold mb-3">Transform Dataset</h2>

        <p className="text-sm text-gray-600 mb-3">
          Transform <strong>{dataset.name}</strong> from{" "}
          <code>{dataset.admin_level}</code> to another level.
        </p>

        <label className="text-sm font-medium">Target Admin Level</label>
        <select
          value={targetLevel}
          onChange={(e) => setTargetLevel(e.target.value)}
          className="w-full border rounded p-2 mt-1 mb-3 text-sm"
        >
          <option value="ADM1">ADM1</option>
          <option value="ADM2">ADM2</option>
          <option value="ADM3">ADM3</option>
          <option value="ADM4">ADM4</option>
        </select>

        <label className="text-sm font-medium">Method</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full border rounded p-2 mt-1 mb-3 text-sm"
        >
          <option value="sum">Sum (aggregate up)</option>
          <option value="average">Average (aggregate up)</option>
          <option value="distribute">Distribute (disaggregate down)</option>
        </select>

        {message && <div className="text-sm text-center mb-2">{message}</div>}

        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleTransform}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Transform"}
          </button>
        </div>
      </div>
    </div>
  );
}
