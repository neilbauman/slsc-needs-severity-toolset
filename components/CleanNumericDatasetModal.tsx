"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onCleaned: () => Promise<void>;
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  onClose,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "cleaning" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const batchSize = 2000;

  const handleClean = async () => {
    try {
      setStatus("cleaning");
      setProgress(0);

      // Get total row count
      const { count, error: countError } = await supabase
        .from("dataset_values_numeric_raw")
        .select("*", { count: "exact", head: true })
        .eq("dataset_id", datasetId);

      if (countError) throw countError;

      let offset = 0;
      let hasMore = true;
      let cleanedCount = 0;
      const total = count ?? 1;

      while (hasMore) {
        const { data, error: rpcError } = await supabase.rpc(
          "clean_numeric_dataset_v2",
          { in_dataset_id: datasetId, in_offset: offset, in_limit: batchSize }
        );

        if (rpcError) throw rpcError;

        cleanedCount += batchSize;
        offset += batchSize;

        const pct = Math.min(Math.round((cleanedCount / total) * 100), 100);
        setProgress(pct);

        if (data === false || data === null) {
          hasMore = false;
        } else {
          hasMore = true;
        }
      }

      // Mark dataset as cleaned for UI consistency
      await supabase
        .from("datasets")
        .update({ is_cleaned: true })
        .eq("id", datasetId);

      setProgress(100);
      setStatus("success");

      await onCleaned();
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      console.error("Cleaning error:", err);
      setError(err.message || "Cleaning failed.");
      setStatus("error");
    }
  };

  useEffect(() => {
    handleClean();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="bg-white rounded-lg p-6 shadow-md w-[420px] text-center">
        <h2 className="text-xl font-semibold mb-2">Clean Dataset</h2>
        <p className="text-gray-600 mb-4">
          Dataset: <strong>{datasetName}</strong>
        </p>

        {status === "cleaning" && (
          <>
            <p className="text-gray-500 mb-2">Cleaning in progress...</p>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">{progress}%</p>
          </>
        )}

        {status === "success" && (
          <p className="text-green-600 font-medium">✅ Cleaning complete!</p>
        )}

        {status === "error" && (
          <>
            <p className="text-red-600 font-medium mb-2">{error}</p>
            <p className="text-yellow-600 text-sm">
              ⚠️ Cleaning failed. See console for details.
            </p>
          </>
        )}

        {status !== "cleaning" && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
