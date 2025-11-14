"use client";

import { useEffect, useState } from "react";
import { supabase } from '@/lib/supabaseClient';

export default function CleanNumericDatasetModal({ datasetId, datasetName, open, onOpenChange, onCleaned }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadPreview() {
    setLoading(true);
    const { data, error } = await supabase.rpc("preview_numeric_cleaning_v2", {
      in_dataset_id: datasetId,
    });
    setLoading(false);

    if (error) {
      console.error(error);
      setRows([]);
      return;
    }

    setRows(data ?? []);
  }

  async function runCleaning() {
    await supabase.rpc("clean_numeric_dataset_v2", {
      in_dataset_id: datasetId,
    });
    onCleaned();
    onOpenChange(false);
  }

  useEffect(() => {
    if (open) loadPreview();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-6xl rounded shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Clean Numeric Dataset — {datasetName}
          </h2>
          <button onClick={() => onOpenChange(false)}>✕</button>
        </div>

        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <ul className="list-disc list-inside text-sm">
            <li>Matches PSA-style ADM3 Pcodes to NAMRIA ADM3 boundaries.</li>
            <li>Writes cleaned rows into <code>dataset_values_numeric</code>.</li>
            <li>Raw rows in <code>dataset_values_numeric_raw</code> are never modified.</li>
          </ul>
        </div>

        {loading && <p className="text-center p-8">Loading…</p>}

        {!loading && (
          <div className="max-h-96 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-2 text-left">Admin PCode (raw)</th>
                  <th className="p-2 text-left">Admin Name (raw)</th>
                  <th className="p-2 text-left">Value</th>
                  <th className="p-2 text-left">ADM3 PCode (clean)</th>
                  <th className="p-2 text-left">ADM3 Name</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">{r.admin_pcode_raw}</td>
                    <td className="p-2">{r.admin_name_raw}</td>
                    <td className="p-2">{r.value_raw}</td>
                    <td className="p-2">{r.admin_pcode_clean ?? "—"}</td>
                    <td className="p-2">{r.admin_name_clean ?? "—"}</td>
                    <td className="p-2">{r.match_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Cancel
          </button>

          <button
            onClick={runCleaning}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Run cleaning & save
          </button>
        </div>
      </div>
    </div>
  );
}
