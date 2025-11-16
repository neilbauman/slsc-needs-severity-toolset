"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient"; // ✅ Correct and consistent path

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [isCleaning, setIsCleaning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchSize] = useState(5000);
  const [totalCleaned, setTotalCleaned] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClean() {
    setIsCleaning(true);
    setDone(false);
    setError(null);
    setLog([]);
    setTotalCleaned(0);
    setProgress(0);

    let offset = 0;
    const maxIterations = 2000; // Safety limit to avoid infinite loops
    let iteration = 0;

    try {
      while (iteration < maxIterations) {
        iteration++;
        setLog((prev) => [...prev, `Batch ${iteration}: offset ${offset}`]);

        const { data, error } = await supabase.rpc("clean_numeric_dataset_v5", {
          in_dataset_id: datasetId,
          in_offset: offset,
          in_limit: batchSize,
        });

        if (error) throw error;

        const cleanedCount = data || 0;

        if (cleanedCount === 0) {
          setLog((prev) => [...prev, "✅ Cleaning complete."]);
          break;
        }

        setTotalCleaned((prev) => prev + cleanedCount);
        offset += batchSize;

        const newProgress = Math.min(100, Math.round((offset / 100000) * 100));
        setProgress(newProgress);
      }

      setDone(true);
      setIsCleaning(false);
      setProgress(100);
      setLog((prev) => [
        ...prev,
        `🎯 Total cleaned: ${totalCleaned.toLocaleString()}`,
      ]);
      await onCleaned();
    } catch (err: any) {
      console.error("Cleaning failed", err);
      setError(err.message || "Unknown error");
      setIsCleaning(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-2">Clean Numeric Dataset</h2>
        <p className="text-sm text-gray-600 mb-4">
          Dataset: <span className="font-medium">{datasetName}</span>
        </p>

        {!done && (
          <>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div
                className="bg-green-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <button
              onClick={handleClean}
              disabled={isCleaning}
              className={`w-full py-2 rounded-md text-white font-medium ${
                isCleaning
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isCleaning ? "Cleaning..." : "Start Cleaning"}
            </button>
          </>
        )}

        {done && (
          <div className="text-green-700 bg-green-100 p-3 rounded-md mt-3 text-sm">
            ✅ Cleaning complete! {totalCleaned.toLocaleString()} records processed.
          </div>
        )}

        {error && (
          <div className="text-red-700 bg-red-100 p-3 rounded-md mt-3 text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-4 max-h-40 overflow-y-auto bg-gray-50 p-2 text-xs font-mono rounded">
          {log.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))}
        </div>

        <div className="flex justify-end mt-4 space-x-2">
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
