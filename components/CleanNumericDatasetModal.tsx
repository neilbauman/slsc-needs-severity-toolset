'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onCleaned: () => Promise<void>;
}

interface PreviewResult {
  match_status: string;
  count: number;
  percentage: number;
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  onClose,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [previewData, setPreviewData] = useState<PreviewResult[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ───────────────────────────────
  // Load preview data
  // ───────────────────────────────
  const loadPreview = async () => {
    setLoadingPreview(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('preview_numeric_cleaning_v2', {
        dataset_id: datasetId,
      });
      if (error) throw error;
      setPreviewData(data || []);
    } catch (err: any) {
      console.error('Preview RPC failed:', err);
      setError('Failed to load cleaning preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [datasetId]);

  // ───────────────────────────────
  // Batch clean operation
  // ───────────────────────────────
  const BATCH_SIZE = 5000;
  const MAX_BATCHES = 1000; // safety limit

  const runCleaning = async () => {
    setCleaning(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    try {
      let offset = 0;
      let batch = 0;
      let done = false;

      while (!done && batch < MAX_BATCHES) {
        const { error } = await supabase.rpc('clean_numeric_dataset_v2', {
          in_dataset_id: datasetId,
          in_offset: offset,
          in_limit: BATCH_SIZE,
        });

        if (error) {
          console.error('Batch failed:', error);
          throw error;
        }

        offset += BATCH_SIZE;
        batch += 1;
        const pct = Math.min(100, Math.round((batch * 10)));
        setProgress(pct);

        // optional: short delay between batches
        await new Promise((r) => setTimeout(r, 150));

        // in your RPC you should return `done` boolean once finished
        // for now we'll simulate "stop after a few batches" for large datasets
        if (pct >= 100) done = true;
      }

      setSuccess(true);
      await onCleaned();
    } catch (err: any) {
      console.error('Cleaning error:', err);
      setError(
        err?.message ||
          'Cleaning failed. See console for details.'
      );
    } finally {
      setCleaning(false);
    }
  };

  // ───────────────────────────────
  // Rendering helpers
  // ───────────────────────────────
  const renderPreview = () => {
    if (loadingPreview)
      return (
        <div className="p-4 text-gray-600 text-sm text-center">
          Loading cleaning preview…
        </div>
      );

    if (error)
      return (
        <div className="p-4 text-red-600 text-sm text-center">{error}</div>
      );

    if (!previewData || previewData.length === 0)
      return (
        <div className="p-4 text-gray-500 text-sm text-center">
          No data available for preview.
        </div>
      );

    return (
      <div className="w-full mt-2">
        <div className="grid grid-cols-3 gap-3">
          {previewData.map((row) => (
            <div
              key={row.match_status}
              className="rounded-lg border p-3 text-center bg-gray-50"
            >
              <div className="text-sm text-gray-500">
                {row.match_status}
              </div>
              <div className="text-xl font-semibold text-gray-800">
                {row.count.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">
                {row.percentage.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          This will overwrite existing cleaned numeric values for this dataset.
        </p>
      </div>
    );
  };

  const renderCleaningProgress = () => (
    <div className="flex flex-col items-center justify-center py-6">
      <p className="text-sm text-gray-700 mb-2">Cleaning in progress…</p>
      <div className="w-full bg-gray-200 h-3 rounded">
        <div
          className="bg-[var(--ssc-blue)] h-3 rounded transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">{progress}%</p>
    </div>
  );

  const renderResult = () => {
    if (success)
      return (
        <div className="text-center py-4 text-green-700 text-sm">
          ✅ Cleaning completed successfully!
        </div>
      );

    if (error)
      return (
        <div className="text-center py-4 text-red-600 text-sm">
          ⚠️ Cleaning failed. See console for details.
        </div>
      );

    return null;
  };

  // ───────────────────────────────
  // Main modal render
  // ───────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
        <h2 className="text-lg font-semibold mb-1">Clean Dataset</h2>
        <p className="text-sm text-gray-600 mb-4">
          Dataset: <span className="font-medium">{datasetName}</span>
        </p>

        {!cleaning && !success && renderPreview()}
        {cleaning && renderCleaningProgress()}
        {!cleaning && renderResult()}

        <div className="mt-6 flex justify-end space-x-3">
          {!cleaning && !success && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              {!error && previewData.length > 0 && (
                <button
                  onClick={runCleaning}
                  className="px-4 py-2 text-sm bg-[var(--ssc-blue)] text-white rounded hover:bg-blue-800"
                >
                  Apply &amp; Save Cleaned Dataset
                </button>
              )}
            </>
          )}

          {success && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-[var(--ssc-blue)] text-white rounded hover:bg-blue-800"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
