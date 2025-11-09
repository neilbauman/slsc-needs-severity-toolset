"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataset?.id) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const table =
          dataset.type === "numeric"
            ? "dataset_values_numeric"
            : "dataset_values_categorical";

        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("dataset_id", dataset.id)
          .limit(100);

        if (error) throw error;
        setRows(data || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dataset]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-lg">
        <h2 className="text-2xl font-serif mb-3">Dataset Details</h2>

        {/* Metadata section */}
        <div className="mb-4 text-sm text-gray-700">
          <p><strong>Name:</strong> {dataset.name}</p>
          {dataset.description && <p><strong>Description:</strong> {dataset.description}</p>}
          <p><strong>Type:</strong> {dataset.type}</p>
          <p><strong>Admin Level:</strong> {dataset.admin_level}</p>
          <p><strong>Created:</strong> {new Date(dataset.created_at).toLocaleString()}</p>
        </div>

        {/* Data Preview */}
        <h3 className="text-lg font-semibold mb-2">Preview (first 100 rows)</h3>

        {loading && <p className="text-gray-500 text-sm">Loading data...</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {!loading && rows.length > 0 && (
          <div className="border rounded max-h-[60vh] overflow-y-auto text-xs">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border p-1">Admin Pcode</th>
                  {dataset.type === "numeric" ? (
                    <th className="border p-1">Value</th>
                  ) : (
                    <>
                      <th className="border p-1">Category</th>
                      <th className="border p-1">Value (Score)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i} className={i % 2 ? "bg-gray-50" : ""}>
                    <td className="border p-1">{r.admin_pcode}</td>
                    {dataset.type === "numeric" ? (
                      <td className="border p-1 text-right">{r.value}</td>
                    ) : (
                      <>
                        <td className="border p-1">{r.category}</td>
                        <td className="border p-1 text-right">{r.value ?? "-"}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length === 0 && !error && (
          <p className="text-gray-500 text-sm">No data found for this dataset.</p>
        )}

        {/* Actions */}
        <div className="flex justify-end mt-5 space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1 border rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
