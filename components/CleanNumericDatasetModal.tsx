'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

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
  const supabase = createClient();

  const [cleaningMode, setCleaningMode] = useState<string>('pcode_exact');
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [previewStats, setPreviewStats] = useState<any>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  if (!open) return null;

  // 🧠 Preview matching results before cleaning
  async function handlePreview() {
    setShowPreview(true);
    setStatus('Generating preview...');
    setProgress(10);

    const { data, error } = await supabase.rpc('preview_clean_numeric_dataset', {
      in_dataset_id: datasetId,
      in_mode: cleaningMode,
    });

    if (error) {
      console.error(error);
      setStatus('Error generating preview.');
      return;
    }

    setPreviewStats(data);
    setStatus('Preview ready.');
    setProgress(100);
  }

  // 🧹 Run the actual cleaning
  async function handleRunCleaning() {
    setIsRunning(true);
    setProgress(0);
    setStatus('Starting cleaning process...');

    try {
      let currentProgress = 0;

      // Step 1: Start cleaning
      const { data, error } = await supabase.rpc('clean_numeric_dataset_v7', {
        in_dataset_id: datasetId,
        in_mode: cleaningMode,
      });

      if (error) throw error;

      // Simulated progress for user feedback
      const interval = setInterval(() => {
        currentProgress += 10;
        setProgress(Math.min(currentProgress, 95));
      }, 500);

      setTimeout(() => {
        clearInterval(interval);
        setProgress(100);
        setStatus('Cleaning complete.');
        setIsRunning(false);
        onCleaned();
        onOpenChange(false);
      }, 4000);
    } catch (err: any) {
      console.error(err);
      setStatus('Cleaning failed.');
      setIsRunning(false);
    }
  }

  // 🛑 Close and reset modal
  function handleClose() {
    onOpenChange(false);
    setStatus('');
    setProgress(0);
    setShowPreview(false);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-2xl font-bold mb-4">
          Clean Dataset – {datasetName}
        </h2>

        {/* Cleaning Mode Selection */}
        <div className="mb-6">
          <label className="font-semibold block mb-2">
            Choose Cleaning Strategy
          </label>
          <select
            value={cleaningMode}
            onChange={(e) => setCleaningMode(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full"
            disabled={isRunning}
          >
            <option value="pcode_exact">Exact PCode Match (Fast, Safe)</option>
            <option value="pcode_fuzzy">PCode Fuzzy Match (Trims, Prefix/Suffix)</option>
            <option value="name_fuzzy">Admin Name Fuzzy Match</option>
            <option value="hierarchical">Hierarchical Roll-up (ADM3 fallback)</option>
          </select>
        </div>

        {/* Preview */}
        {!isRunning && !showPreview && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={handlePreview}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg"
            >
              Preview Cleaning Impact
            </button>
            <button
              onClick={handleRunCleaning}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Run Cleaning
            </button>
          </div>
        )}

        {/* Preview Results */}
        {showPreview && previewStats && (
          <div className="bg-gray-50 border rounded-lg p-3 mb-4">
            <h3 className="font-semibold mb-2">Preview Results</h3>
            <p>
              <strong>Total Rows:</strong> {previewStats.total_rows}
            </p>
            <p>
              <strong>Matched:</strong> {previewStats.matched_rows}
            </p>
            <p>
              <strong>Unmatched:</strong> {previewStats.unmatched_rows}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              You can adjust your cleaning strategy above to improve alignment.
            </p>
          </div>
        )}

        {/* Progress */}
        {isRunning && (
          <div className="my-4">
            <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">{status}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={handleClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg"
            disabled={isRunning}
          >
            Close
          </button>
          {!isRunning && (
            <button
              onClick={handleRunCleaning}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              Confirm & Run Cleaning
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
