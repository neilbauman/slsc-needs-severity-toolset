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

  if (!open) return null;

  const handleClean = async () => {
    setLoading(true);
    const { error } = await supabase.rpc('clean_numeric_dataset', {
      dataset_id: dataset.id,
      method,
    });
    setLoading(false);
    if (error) return alert(error.message);
    onClose();
    await onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[450px]">
        <h2 className="text-lg font-semibold mb-4">
          Clean Dataset: {dataset?.name}
        </h2>

        <label className="block text-sm font-medium mb-1">
          Cleaning Method
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full border rounded p-2 mb-6"
        >
          <option value="pcode_match_fast">PCode Match Only (Fast, ADM4)</option>
          <option value="pcode_match_full">PCode Match + Value Validation</option>
          <option value="aggregate_by_admin">Aggregate by Admin Level</option>
        </select>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleClean}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Cleaning…' : 'Start Cleaning'}
          </button>
        </div>
      </div>
    </div>
  );
}
