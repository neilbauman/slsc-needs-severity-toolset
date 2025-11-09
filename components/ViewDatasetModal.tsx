"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRows = async () => {
      setLoading(true);
      const tableName = dataset.type === "categorical" ? "dataset_values_cat_rows" : "dataset_values_num_rows";
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("dataset_id", dataset.id)
        .limit(100);

      if (error) {
        console.error("Error loading dataset values:", error);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    };

    fetchRows();
  }, [dataset]);

  const keys = rows.length > 0 ? Object.keys(rows[0]).filter((key) => key !== "dataset_id" && key !== "id") : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white max-w-5xl w-full rounded-lg shadow-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">{dataset.name}</h2>
          <button
            className="text-sm text-gray-500 hover:text-red-500"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="px-6 py-3 space-y-2 text-sm text-gray-700 overflow-y-auto">
          <div><span className="font-semibold">Description:</span> {dataset.description}</div>
          <div><span className="font-semibold">Source:</span> {dataset.source}</div>
          <div><span className="font-semibold">Admin Level:</span> {dataset.admin_level}</div>
          <div><span className="font-semibold">Type:</span> {dataset.type}</div>
        </div>

        <div className="px-6 pt-2 pb-4 overflow-y-auto flex-1">
          <h3 className="text-md font-semibold mb-2 text-gray-700">Preview (first 100 rows)</h3>
          {loading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : (
            <div className="overflow-auto border rounded">
              <table className="w-full text-sm text-left text-gray-700">
                <thead className="bg-gray-100 border-b sticky top-0">
                  <tr>
                    {keys.map((key) => (
                      <th key={key} className="px-3 py-2 border-r whitespace-nowrap">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      {keys.map((key) => (
                        <td key={key} className="px-3 py-1 border-r whitespace-nowrap">
                          {row[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
