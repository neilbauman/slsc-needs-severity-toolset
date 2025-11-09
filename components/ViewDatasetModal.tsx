"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!dataset) return null;

  const metadata = dataset.metadata || {};

  const getDate = (val: string | null | undefined) => {
    if (!val) return "—";
    const d = new Date(val);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const valueTable =
          dataset.type === "numeric"
            ? "dataset_values_numeric"
            : dataset.type === "categorical"
            ? "dataset_values_categorical"
            : null;

        if (!valueTable) throw new Error(`Unsupported dataset type: ${dataset.type}`);

        // Fetch dataset rows
        const { data: valueData, error: valueError } = await supabase
          .from(valueTable)
          .select("*")
          .eq("dataset_id", dataset.id)
          .limit(50);

        if (valueError) throw valueError;
        if (!valueData || valueData.length === 0) {
          setError("No values found for this dataset.");
          return;
        }

        // Normalize admin_pcodes for lookup (pad/truncate to 11 digits)
        const normalizeCode = (pcode: string) => {
          if (!pcode) return null;
          if (pcode.length < 11) return pcode.padEnd(11, "0");
          if (pcode.length > 11) return pcode.slice(0, 11);
          return pcode;
        };

        const pcodes = [
          ...new Set(valueData.map((r) => normalizeCode(r.admin_pcode)).filter(Boolean)),
        ];

        // Fetch admin names
        const { data: adminData, error: adminError } = await supabase
          .from("admin_boundaries")
          .select("admin_pcode, name");

        if (adminError) throw adminError;

        const lookup: Record<string, string> = {};
        (adminData || []).forEach((a) => {
          const normalized = normalizeCode(a.admin_pcode);
          lookup[normalized] = a.name;
        });

        setAdminNames(lookup);
        setRows(
          valueData.map((r) => ({
            ...r,
            admin_name: lookup[normalizeCode(r.admin_pcode)] || "—",
          }))
        );
      } catch (err: any) {
        setError(err.message || "Failed to fetch dataset data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataset]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">{dataset.name}</h2>
            {dataset.description && (
              <p className="text-gray-500">{dataset.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-800 text-2xl leading-none font-semibold"
          >
            ×
          </button>
        </div>

        {/* Metadata */}
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

        <hr className="my-4" />

        {/* Dataset Table */}
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
                  <th className="px-3 py-2 border-b text-left font-semibold text-gray-700">
                    Admin PCode
                  </th>
                  <th className="px-3 py-2 border-b text-left font-semibold text-gray-700">
                    Admin Name
                  </th>
                  {Object.keys(rows[0])
                    .filter((col) => !["id", "dataset_id", "admin_pcode", "admin_name"].includes(col))
                    .map((col) => (
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
                    <td className="px-3 py-2 border-b text-gray-700">{row.admin_pcode}</td>
                    <td className="px-3 py-2 border-b text-gray-700">{row.admin_name}</td>
                    {Object.keys(row)
                      .filter((col) => !["id", "dataset_id", "admin_pcode", "admin_name"].includes(col))
                      .map((col) => (
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
