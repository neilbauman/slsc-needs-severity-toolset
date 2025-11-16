'use client';

import React, { useState } from 'react';
import supabase from '@/lib/supabaseClient';

interface CleanNumericDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onCleaned: () => Promise<void>;
}

export default function CleanNumericDatasetModal({
  dataset,
  onClose,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!dataset) return null;

  const handleClean = async () => {
    setLoading(true);
    setStatus('Cleaning data...');

    try {
      const { data, error } = await supabase.rpc('clean_numeric_dataset', {
        dataset_id: dataset.id,
      });

      if (error) throw error;
      console.log('Clean result:', data);

      setStatus('Dataset cleaned successfully.');
      await onCleaned();
      onClose();
    } catch (err) {
      console.error(err);
      setStatus('Error cleaning dataset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">
          Clean Numeric Dataset
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          This will normalize and validate numeric values in the dataset{' '}
          <strong>{dataset.name}</strong>.
        </p>

        {status && (
          <div className="mb-4 text-sm text-gray-700">{status}</div>
        )}

        <div className="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleClean}
            disabled={loading}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          >
            {loading ? 'Cleaning...' : 'Run Clean'}
          </button>
        </div>
      </div>
    </div>
  );
}
