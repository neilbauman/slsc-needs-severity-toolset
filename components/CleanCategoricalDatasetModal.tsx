"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned
}) {
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState(null);
  const [mismatchedOnly, setMismatchedOnly] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadPreview();
  }, [open]);

  async function loadPreview() {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc(
        "preview_categorical_cleaning",
        { p_dataset_id: datasetId }
      );

      if (error) throw error;

      let rows = data || [];

      if (mismatchedOnly) {
        rows = rows.filter((r) => r.admin_pcode_clean === null || r.admin_name_clean === null);
      }

      setPreview(rows);
    } catch (err) {
      setError(err.message ?? "Failed to load preview.");
    } finally {
      setLoading(false);
    }
  }

  async function runCleaning() {
    setCleaning(true);
    setError(null);

    try {
      const { error } = await supabase.rpc("clean_categorical_dataset", {
        p_dataset_id: datasetId
      });

      if (error) throw error;

      onCleaned();
      onOpenChange(false);
    } catch (err) {
      setError(err.message ?? "Cleaning failed.");
    } finally {
      setCleaning(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-4xl rounded shadow-lg">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Clean Categorical Dataset</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-4">

          {/* ERROR */}
          {error && (
            <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded text-sm">
              {error}
            </div>
          )}

          {/* TOGGLE */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mismatchedOnly}
              onChange={(e) => {
                setMismatchedOnly(e.target.checked);
                loadPreview();
              }}
            />
            Show only mismatched rows
          </label>

          {/* PREVIEW */}
          <div className="border rounded max-h-[360px] overflow-auto">
            {loading ? (
              <div className="py-6 text-center text-gray-500 text-sm">
                Loading preview…
              </div>
            ) : preview.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-sm">
                No rows to display.
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {Object.keys(preview[0]).map((col) => (
                      <th key={col} className="border px-2 py-2 text-left">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-2 py-1 border whitespace-nowrap">
                          {v === null ? "—" : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>

          <button
            disabled={cleaning}
            onClick={runCleaning}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {cleaning ? "Cleaning…" : "Clean & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
