'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

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
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [processed, setProcessed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('Preparing...');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const batchSize = 5000;

  // Count total rows in dataset_values_numeric_raw
  useEffect(() => {
    const loadCount = async () => {
      const { count, error } = await supabase
        .from('dataset_values_numeric_raw')
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', datasetId);

      if (error) {
        setError('Failed to load dataset row count.');
        console.error(error);
      } else {
        setTotalRows(count ?? 0);
      }
    };

    loadCount();
  }, [datasetId]);

  // Cleaning handler
  const handleClean = async () => {
    if (!totalRows || totalRows === 0) {
      setError('No rows found in raw dataset.');
      return;
    }

    setRunning(true);
    setError(null);
    setStatus('Starting cleaning...');

    let offset = 0;

    try {
      while (offset < totalRows) {
        setStatus(
          `Cleaning rows ${offset + 1} to ${Math.min(offset + batchSize, totalRows)}...`
        );

        const { error } = await supabase.rpc('clean_numeric_dataset_v2', {
          in_dataset_id: datasetId,
          in_offset: offset,
          in_limit: batchSize,
        });

        if (error) throw error;

        offset += batchSize;
        setProcessed(offset);
        setProgress(Math.min((offset / totalRows) * 100, 100));
      }

      // Mark dataset as cleaned
      await supabase
        .from('datasets')
        .update({ is_cleaned: true })
        .eq('id', datasetId);

      setStatus('Cleaning complete!');
      setProgress(100);
      await onCleaned();

      setTimeout(onClose, 1000);
    } catch (err: any) {
      console.error('Cleaning error:', err);
      setError('Cleaning failed. See console for details.');
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Clean Dataset
        </h2>
        <p className="text-sm text-gray-600 mb-2">
          Dataset: <span className="font-medium">{datasetName}</span>
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 p-2 rounded mb-3 text-sm">
            ⚠ {error}
          </div>
        )}

        {running ? (
          <div>
            <div className="w-full bg-gray-200 rounded h-3 mb-2 overflow-hidden">
              <div
                className="bg-[var(--ssc-blue)] h-3 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-700 text-center">
              {status}
              <br />
              {totalRows
                ? `${processed}/${totalRows} rows processed (${progress.toFixed(1)}%)`
                : 'Counting rows...'}
            </p>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleClean}
              className="px-4 py-2 text-sm bg-[var(--ssc-blue)] hover:bg-blue-800 text-white rounded-md"
              disabled={totalRows === null}
            >
              Start Cleaning
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
