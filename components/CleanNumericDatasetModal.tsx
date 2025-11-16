'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CleanNumericDatasetModalProps {
  open: boolean;
  dataset: any;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export default function CleanNumericDatasetModal({
  open,
  dataset,
  onClose,
  onSaved,
}: CleanNumericDatasetModalProps) {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('pcode_match_fast');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleClean = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const { error } = await supabase.rpc('clean_numeric_dataset', {
      dataset_id: dataset.id,
      method,
    });

    setLoading(false);

    if (error) {
      console.error('Error cleaning dataset:', error);
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg('Dataset cleaned successfully!');
    onClose();
    await onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[480px] max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          Clean Dataset: {dataset?.name}
        </h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Cleaning Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="pcode_match_fast">
              PCode Match Only (Fast, ADM4)
            </option>
            <option value="pcode_match_full">
              PCode Match + Value Validation
            </option>
            <option value="aggregate_by_admin">
              Aggregate by Admin Level
            </option>
          </select>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 text-sm p-2 rounded mb-3">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 text-green-600 text-sm p-2 rounded mb-3">
            {successMsg}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleClean}
            disabled={loading}
            className={`px-4 py-2 rounded text-white ${
              loading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Cleaning…' : 'Start Cleaning'}
          </button>
        </div>
      </div>
    </div>
  );
}
