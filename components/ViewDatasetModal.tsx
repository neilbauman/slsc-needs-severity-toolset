"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

interface DatasetRow {
  admin_pcode: string;
  value?: number | string | null;
  category?: string | null;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const supabase = createClient();

  const [data, setData] = useState<DatasetRow[]>([]);
  const [adminMap, setAdminMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!dataset) return;

      try {
        setLoading(true);
        setError(null);

        // 1. Fetch admin boundaries
        const { data: boundaries, error: boundariesError } = await supabase
          .from("admin_boundaries")
          .select("admin_pcode, name");

        if (boundariesError) throw boundariesError;

        const map: Record<string, string> = {};
        boundaries?.forEach((b) => {
          map[b.admin_pcode] = b.name;
        });
        setAdminMap(map);

        // 2. Fetch dataset values (numeric or categorical)
        const table =
          dataset.type === "numeric"
            ? "dataset_values_numeric"
            : "dataset_values_categorical";

        const { data: datasetValues, error: datasetError } = await supabase
          .from(table)
          .select("*")
          .eq("dataset_id", dataset.id)
          .limit(1000); // prevent overload

        if (datasetError) throw datasetError;

        setData(datasetValues || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error loading dataset.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataset, supabase]);

  const resolveAdminName = (pcode: string): string => {
    if (!pcode) return "—";
    if (adminMap[pcode]) return adminMap[pcode];

    // try truncated versions
    for (let i = pcode.length; i >= 2; i--) {
      const prefix = pcode.slice(0, i);
      if (adminMap[prefix]) return adminMap[prefix];
    }

    // try padded versions
    for (let i = pcode.length; i <= 11; i++) {
      const padded = pcode.padEnd(i, "0");
      if (adminMap[padded]) return adminMap[padded];
    }

    return "—";
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  };

  if (!dataset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl mx-4 my-8 p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
        >
          ×
        </button>

        {/* Header */}
        <h2 className="text-2xl font-bold mb-1">{dataset.name}</h2>
        <p className="text-gray-500 mb-4">{dataset.description || "—"}</p>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <p><strong>Type:</strong> {dataset.type || "—"}</p>
            <p><strong>Category:</strong> {dataset.category || "—"}</p>
            <p><strong>Format:</strong> {dataset.metadata?.format || "—"}</p>
            <p><strong>Created At:</strong> {formatDate(dataset.created_at)}</p>
          </div>
          <div>
            <p><strong>Admin Level:</strong> {dataset.admin_level || "—"}</p>
            <p><strong>Source:</strong> {dataset.metadata?.source || "—"}</p>
            <p><strong>Collected At:</strong> {formatDate(dataset.collected_at)}</p>
            <p><strong>Updated At:</strong> {formatDate(dataset.metadata?.updated_at)}</p>
          </div>
        </div>

        {/* Divider */}
        <hr className="my-4" />

        {/* Dataset preview */}
        <h3 className="text-lg font-semibold mb-2">Dataset Preview</h3>
        {loading ? (
          <p className="text-gray-500">Loading data...</p>
        ) : error ? (
          <p className="text-red-600">Error: {error}</p>
        ) : data.length === 0 ? (
          <p className="text-gray-500">No data found for this dataset.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2 border">Admin PCode</th>
                  <th className="text-left p-2 border">Admin Name</th>
                  {dataset.type === "categorical" && (
                    <th className="text-left p-2 border">Category</th>
                  )}
                  <th className="text-left p-2 border">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-2 border font-mono">{row.admin_pcode}</td>
                    <td className="p-2 border">{resolveAdminName(row.admin_pcode)}</td>
                    {dataset.type === "categorical" && (
                      <td className="p-2 border">{row.category || "—"}</td>
                    )}
                    <td className="p-2 border">{row.value ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
