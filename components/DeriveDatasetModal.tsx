"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface DeriveDatasetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => Promise<void>;
}

export default function DeriveDatasetModal({
  open,
  onOpenChange,
  onCreated,
}: DeriveDatasetModalProps) {
  const [baseA, setBaseA] = useState("");
  const [baseB, setBaseB] = useState("");
  const [method, setMethod] = useState<"ratio" | "difference" | "sum">("ratio");
  const [preview, setPreview] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handlePreview = async () => {
    if (!baseA || !baseB) {
      setError("Please provide both dataset UUIDs.");
      return;
    }

    setLoading(true);
    setError(null);
    setPreview([]);
    setSummary(null);

    try {
      const { data, error } = await supabase.rpc("preview_derived_dataset_v2", {
        base_a: baseA,
        base_b: baseB,
        method,
        target_admin_level: "ADM4",
      });

      if (error) throw error;

      const normalRows = data.filter((row: any) => row.admin_name !== "SUMMARY");
      const summaryRow = data.find((row: any) => row.admin_name === "SUMMARY");

      setPreview(normalRows);
      setSummary(summaryRow?.summary || null);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!baseA || !baseB) {
      setError("Please provide both dataset UUIDs before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc("materialize_derived_dataset_v2", {
        base_a: baseA,
        base_b: baseB,
        method,
      });

      if (error) throw error;

      if (onCreated) await onCreated();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white w-[90%] max-w-5xl rounded-lg shadow-lg p-6 flex flex-col max-h-[90vh] overflow-hidden">
        <h2 className="text-xl font-bold mb-4">Derive New Dataset</h2>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Base Dataset A (UUID)</label>
            <input
              type="text"
              value={baseA}
              onChange={(e) => setBaseA(e.target.value)}
              placeholder="Enter Dataset A UUID"
              className="w-full border rounded p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Base Dataset B (UUID)</label>
            <input
              type="text"
              value={baseB}
              onChange={(e) => setBaseB(e.target.value)}
              placeholder="Enter Dataset B UUID"
              className="w-full border rounded p-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium">Method:</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as "ratio" | "difference" | "sum")}
            className="border rounded p-2 text-sm"
          >
            <option value="ratio">Ratio (A ÷ B)</option>
            <option value="difference">Difference (A - B)</option>
            <option value="sum">Sum (A + B)</option>
          </select>

          <button
            onClick={handlePreview}
            disabled={loading}
            className={`px-4 py-2 rounded text-white text-sm ${
              loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Loading..." : "Preview"}
          </button>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {/* Preview Table */}
        {preview.length > 0 && (
          <div className="border rounded overflow-y-auto flex-grow mb-4">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">Admin PCode</th>
                  <th className="border px-3 py-2 text-left">Admin Name</th>
                  <th className="border px-3 py-2 text-right">Derived Value</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border px-3 py-1">{row.admin_pcode}</td>
                    <td className="border px-3 py-1">{row.admin_name}</td>
                    <td className="border px-3 py-1 text-right">
                      {row.result_value !== null ? row.result_value.toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="border rounded bg-gray-50 p-3 text-sm mb-4">
            <h3 className="font-semibold mb-1">Summary</h3>
            <div className="flex flex-wrap gap-6">
              <span>Min: <strong>{summary.min}</strong></span>
              <span>Max: <strong>{summary.max}</strong></span>
              <span>Avg: <strong>{summary.avg}</strong></span>
              <span>Count: <strong>{summary.count}</strong></span>
            </div>
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              onOpenChange(false);
              if (onCreated) onCreated();
            }}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded text-white text-sm ${
              saving ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {saving ? "Saving..." : "Save Derived Dataset"}
          </button>
        </div>
      </div>
    </div>
  );
}
