'use client';

import React, { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type CleanNumericDatasetModalProps = {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
};

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const supabase = createClientComponentClient();
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error' | 'reverting'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  if (!open) return null;

  const handleClose = () => {
    onOpenChange(false);
    setStatus('idle');
    setErrorMessage(null);
    setProgress(0);
  };

  const handleClean = async () => {
    setStatus('running');
    setErrorMessage(null);
    setProgress(0);

    try {
      let offset = 0;
      const limit = 1000;
      let more = true;
      let batch = 0;

      while (more) {
        const { data, error } = await supabase.rpc('clean_numeric_dataset_v2', {
          in_dataset_id: datasetId,
          in_offset: offset,
          in_limit: limit,
        });

        if (error) {
          console.error('Cleaning error:', error);
          throw error;
        }

        batch++;
        offset += limit;
        setProgress((offset / 41984) * 100); // approximate progress

        more = data === true;
      }

      setStatus('success');
      await onCleaned();
    } catch (err: any) {
      console.error('Cleaning failed:', err);
      setErrorMessage(err.message || 'Cleaning failed. See console for details.');
      setStatus('error');
    }
  };

  const handleRevert = async () => {
    setStatus('reverting');
    setErrorMessage(null);

    try {
      const { error: delError } = await supabase
        .from('dataset_values_numeric')
        .delete()
        .eq('dataset_id', datasetId);

      if (delError) throw delError;

      const { error: updError } = await supabase
        .from('datasets')
        .update({ is_cleaned: false })
        .eq('id', datasetId);

      if (updError) throw updError;

      setStatus('idle');
      alert('Dataset reverted to raw successfully.');
      await onCleaned();
    } catch (err: any) {
      console.error('Revert failed:', err);
      setErrorMessage(err.message || 'Failed to revert dataset.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-2">Clean Dataset</h2>
        <p className="text-gray-600 mb-4">Dataset: <strong>{datasetName}</strong></p>

        {status === 'running' && (
          <div className="mb-4">
            <p className="text-center mb-2">Cleaning in progress...</p>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
            <p className="text-sm text-center mt-2">{Math.min(progress, 100).toFixed(0)}%</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-red-600 mb-4 text-center whitespace-pre-line">
            {errorMessage || 'Cleaning failed. See console for details.'}
          </div>
        )}

        {status === 'success' && (
          <div className="text-green-600 mb-4 text-center">✅ Cleaning completed successfully!</div>
        )}

        <div className="flex justify-end space-x-3 mt-6">
          {status !== 'running' && (
            <button
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800"
              onClick={handleRevert}
              disabled={status === 'reverting'}
            >
              {status === 'reverting' ? 'Reverting...' : 'Revert to Raw'}
            </button>
          )}
          <button
            className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800"
            onClick={handleClose}
          >
            Cancel
          </button>
          {status !== 'running' && (
            <button
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleClean}
            >
              {status === 'success' ? 'Re-run Cleaning' : 'Start Cleaning'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
