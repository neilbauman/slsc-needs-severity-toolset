"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const [dataRows, setDataRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const valueTable =
        dataset.type === "categorical"
          ? "dataset_values_categorical"
          : "dataset_values_numeric";

      // Flexible join on admin boundaries (handle adm3 / adm4 differences)
      const { data, error } = await supabase
        .from(valueTable)
        .select(
          `
            admin_pcode,
            value,
            admin_boundaries!inner (
              name,
              admin_level
            )
          `
        )
        .eq("dataset_id", dataset.id)
        .order("admin_pcode", { ascending: true })
        .limit(5000);

      if (error) {
        console.error("Error loading dataset:", error);
      } else {
        // Sort results by admin name (handles nulls gracefully)
        const sorted = data
          .map((r) => ({
            pcode: r.admin_pcode,
            name: r.admin_boundaries?.name || "—",
            value: r.value,
            level: r.admin_boundaries?.admin_level || "—",
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setDataRows(sorted);
      }

      setLoading(false);
    };

    loadData();
  }, [dataset]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            {dataset.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Dataset Info */}
        <div className="px-4 py-2 text-sm text-gray-600">
          <p>
            <strong>Category:</strong> {dataset.category || "Uncategorized"}
          </p>
          <p>
            <strong>Admin Level:</strong> {dataset.admin_level}
          </p>
          <p>
            <strong>Type:</strong> {dataset.type}
          </p>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-y-auto mt-2 px-4 pb-4">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Loading data...
            </p>
          ) : dataRows.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No records found for this dataset.
            </p>
          ) : (
            <table className="min-w-full border border-gray-200 text-sm text-gray-800">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left border-b">Admin Name</th>
                  <th className="px-3 py-2 text-left border-b">PCode</th>
                  <th className="px-3 py-2 text-left border-b">Value</th>
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, i) => (
                  <tr
                    key={`${row.pcode}-${i}`}
                    className="hover:bg-gray-50 border-b"
                  >
                    <td className="px-3 py-1.5">{row.name}</td>
                    <td className="px-3 py-1.5 text-gray-600 text-xs">
                      {row.pcode}
                    </td>
                    <td className="px-3 py-1.5 font-medium text-gray-700">
                      {row.value ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-3 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
