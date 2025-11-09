"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!dataset) return null;

  const metadata = dataset.metadata || {};

  const getDate = (val: string | null | undefined) => {
    if (!val) return "—";
    const d = new Date(val);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  };

  // 🧩 Load dataset rows when modal opens
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const supabase = createClient();

        // Table name is usually derived from dataset name
        // Adjust mapping as needed
        const tableName = dataset.name
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^\w_]/g, "");

        const { data, error } = await supabase.from(tableName).select("*").limit(50);
        if (error) throw error;
        setRows(data || []);
      } catch (err: any) {
        setError(err.message || "Failed to fetch dataset data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataset]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Title + Description */}
        <h2 className="text-2xl font-bold mb-1">{dataset.name}</h2>
        {dataset.description && (
          <p className="text-gray-500 mb-4">{dataset.description}</p>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
          <div>
            <p><span className="font-semibold">Type:</span> {dataset.type || "—"}</p>
            <p><span className="font-semibold">Category:</span> {dataset.category || "—"}</p>
            <p><span className="font-semibold">Format:</span> {metadata.format || "—"}</p>
            <p><span className="font-semibold">Created At:</span> {getDate(dataset.created_at)}</p>
          </div>
          <div>
            <p><span className="font-semibold">Admin Level:</span> {dataset.admin_level || "—"}</p>
            <p><span className="font-semibold">Source:</span> {metadata.source || dataset.source || "—"}</p>
            <p><span className="font-semibold">Collected At:</span> {getDate(metadata.collected_at || dataset.collected_at)}</p>
            <p><span className="font-semibold">Updated At:</span> {getDate(metadata.updated_at)}</p>
          </div>
        </div>

        {/* Divider */}
        <hr className="my-4" />

        {/* Dataset Data Section */}
        <h3 className="text-lg font-semibold mb-2">Dataset Preview</h3>

        {loading ? (
          <p className="text-sm text-gray-500">Loading data…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Error: {error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No data available.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {Object.keys(rows[0]).map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 border-b text-left font-semibold text-gray-700"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {Object.keys(row).map((col) => (
                      <td key={col} className="px-3 py-2 border-b text-gray-700">
                        {String(row[col] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
