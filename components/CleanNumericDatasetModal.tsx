"use client";

import { useState, useEffect } from "react";
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
  const [isCleaning, setIsCleaning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const BATCH_SIZE = 5000;
  const MAX_ITERATIONS = 1000;

  const cleanDataset = async () => {
    try {
      setIsCleaning(true);
      setProgress(0);
      setStatusMessage("Initializing cleaning...");
      setErrorMessage(null);

      let offset = 0;
      let totalCleaned = 0;
      let iteration = 0;

      while (iteration < MAX_ITERATIONS) {
        const { data, error } = await supabase.rpc("clean_numeric_dataset_v5", {
          in_dataset_id: datasetId,
          in_offset: offset,
          in_limit: BATCH_SIZE,
        });

        if (error) {
          console.error("RPC error:", error);
          setErrorMessage(`Error cleaning batch at offset ${offset}: ${error.message}`);
          break;
        }

        const cleanedCount = data ?? 0;
        totalCleaned += cleanedCount;

        if (cleanedCount === 0) break; // stop when done

        offset += BATCH_SIZE;
        iteration++;

        setProgress(Math.min(100, (iteration * 100) / MAX_ITERATIONS));
        setStatusMessage(`Processed ${totalCleaned.toLocaleString()} records...`);
      }

      setProgress(100);
      setStatusMessage(`Cleaning complete. ${totalCleaned.toLocaleString()} records processed.`);

      await supabase.from("datasets").update({ is_cleaned: true }).eq("id", datasetId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await onCleaned();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsCleaning(false);
    }
  };

  useEffect(() => {
    let started = false;
    if (!started) {
      started = true;
      cleanDataset();
    }
    return () => {
      started = true; // prevent re-run under StrictMode
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-6 text-center">
        <h2 className="text-xl font-semibold mb-4">
          Cleaning Dataset: <span className="text-blue-600">{datasetName}</span>
        </h2>

        {statusMessage && <p className="text-gray-700 text-sm mb-4">{statusMessage}</p>}

        <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
          <div
            className="bg-blue-500 h-4 transition-all duration-500 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{errorMessage}</div>
        )}

        {!isCleaning && !errorMessage && (
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Close
          </button>
        )}

        {isCleaning && (
          <button
            disabled
            className="bg-gray-400 text-white px-4 py-2 rounded-md cursor-not-allowed"
          >
            Cleaning...
          </button>
        )}
      </div>
    </div>
  );
}
