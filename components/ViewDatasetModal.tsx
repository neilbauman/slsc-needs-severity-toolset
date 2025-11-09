"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ViewDatasetModal({
  datasetId,
  onClose,
}: {
  datasetId: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPreview() {
      const { data, error } = await supabase
        .from("dataset_values")
        .select("*")
        .eq("dataset_id", datasetId)
        .limit(10);

      if (error) console.error("Error loading data preview", error);
      else setRows(data ?? []);

      setLoading(false);
    }

    fetchPreview();
  }, [datasetId]);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white rounded shadow-lg p-6 max-w-3xl w-full overflow-auto max-h-[90vh]">
        <h2 className="text-xl font-semibold mb-4">Dataset Preview</h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-500">No data found for this dataset.</p>
        ) : (
          <table className="min-w-full text-sm border">
            <thead>
              <tr>
                {Object.keys(rows[0]).map((key) => (
                  <th
                    key={key}
                    className="text-left border px-2 py-1 bg-gray-100"
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  {Object.values(row).map((val, i) => (
                    <td key={i} className="border px-2 py-1">
                      {String(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 text-right">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-black"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
