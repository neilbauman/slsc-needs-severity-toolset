'use client';

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CleanNumericDatasetModalProps = {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
};

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  onClose,
}: CleanNumericDatasetModalProps) {
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load preview + summary counts
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // ---- 1. Load counts (accurate, all rows) ----
      const { data: countsData, error: countsError } = await supabase
        .rpc("preview_numeric_cleaning_v2_counts", {
          in_dataset: datasetId,
        });

      if (countsError) {
        setErrorMsg(countsError.message);
        setLoading(false);
        return;
      }

      const mappedCounts: Record<string, number> = {};
      countsData.forEach((row: any) => {
        mappedCounts[row.match_status] = Number(row.count_rows);
      });

      setCounts(mappedCounts);

      // ---- 2. Load preview rows (limited to first 1000) ----
      const { data: previewData, error: previewError } = await supabase
        .rpc("preview_numeric_cleaning_v2", {
          in_dataset: datasetId,
        })
        .limit(1000);

      if (previewError) {
        setErrorMsg(previewError.message);
        setLoading(false);
        return;
      }

      setPreviewRows(previewData);
      setLoading(false);
    };

    load();
  }, [datasetId]);

  const applyCleaning = async () => {
    setApplying(true);
    setErrorMsg(null);

    const { error } = await supabase.rpc("clean_numeric_dataset", {
      in_dataset: datasetId,
    });

    if (error) {
      setErrorMsg(error.message);
      setApplying(false);
      return;
    }

    setApplying(false);
    onClose();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg p-6 shadow-xl w-[900px]">
          <p>Loading cleaning preview…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg p-6 shadow-xl w-[95%] max-w-[1300px] max-h-[90%] overflow-auto">

        <h1 className="text-2xl font-semibold mb-1">
          Clean Numeric Dataset
        </h1>
        <p className="text-gray-600 mb-4">
          Dataset: <span className="font-medium">{datasetName}</span>
        </p>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4">
            {errorMsg}
          </div>
        )}

        {/* SUMMARY BOXES */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">Matched</div>
            <div className="text-xl font-semibold">
              {counts["matched"] ?? 0}
            </div>
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">No ADM2 Match</div>
            <div className="text-xl font-semibold">
              {counts["no_adm2_match"] ?? 0}
            </div>
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">No ADM3 Name Match</div>
            <div className="text-xl font-semibold">
              {counts["no_adm3_name_match"] ?? 0}
            </div>
          </div>
        </div>

        {/* PREVIEW TABLE */}
        <div className="overflow-auto border rounded max-h-[500px]">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                {previewRows.length > 0 &&
                  Object.keys(previewRows[0]).map((col) => (
                    <th key={col} className="px-3 py-2 text-left">
                      {col}
                    </th>
                  ))}
              </tr>
            </thead>

            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-b">
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="px-3 py-1 whitespace-nowrap">
                      {v === null ? "—" : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BUTTONS */}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancel
          </button>

          <button
            disabled={applying}
            onClick={applyCleaning}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
          >
            {applying ? "Applying…" : "Apply Cleaning"}
          </button>
        </div>
      </div>
    </div>
  );
}
