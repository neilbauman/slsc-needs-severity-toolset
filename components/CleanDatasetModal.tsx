'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getNumericCleaningPreview } from '@/lib/supabasePreview';

export default function CleanDatasetModal({ dataset, onClose, onCleaned }: any) {
  const [preview, setPreview] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const runPreview = async () => {
    setLoading(true);
    setMessage(null);
    try {
      let result;
      if (dataset.type === 'numeric') {
        result = await supabase.rpc('preview_numeric_cleaning_v2', {
          _dataset_id: dataset.id,
        });
      } else {
        result = await supabase.rpc('preview_categorical_cleaning', {
          _dataset_id: dataset.id,
        });
      }

      if (result.error) throw result.error;
      setPreview(result.data);
    } catch (e) {
      setMessage('⚠️ Preview failed. Check console.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const runClean = async () => {
    setCleaning(true);
    setMessage(null);
    try {
      const rpcName =
        dataset.type === 'numeric'
          ? 'clean_numeric_dataset'
          : 'clean_categorical_dataset';
      const { error } = await supabase.rpc(rpcName, {
        _dataset_id: dataset.id,
      });
      if (error) throw error;
      setMessage('✅ Dataset cleaned successfully.');
      onCleaned?.();
    } catch (e) {
      console.error(e);
      setMessage('❌ Cleaning failed.');
    }
    setCleaning(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">
            Clean Dataset: {dataset.name}
          </h2>
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {!preview && !loading && (
          <div className="flex flex-col items-center justify-center space-y-3 text-center">
            <p className="text-sm text-gray-600">
              Run a quick data health check before cleaning.
            </p>
            <button
              onClick={runPreview}
              className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Run Preview
            </button>
          </div>
        )}

        {loading && <p className="text-gray-600">Analyzing dataset…</p>}

        {preview && (
          <div className="space-y-3">
            <h3 className="text-md font-medium text-gray-800 mb-1">
              Data Health Summary
            </h3>
            <table className="min-w-full text-sm border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-2 py-1">Match Status</th>
                  <th className="text-left px-2 py-1">Count</th>
                  <th className="text-left px-2 py-1">%</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row: any) => (
                  <tr key={row.match_status}>
                    <td className="px-2 py-1">{row.match_status}</td>
                    <td className="px-2 py-1">{row.count}</td>
                    <td className="px-2 py-1">{row.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={runClean}
                disabled={cleaning}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                {cleaning ? 'Cleaning…' : 'Run Clean'}
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="text-sm text-center mt-3 text-gray-700">{message}</p>
        )}
      </div>
    </div>
  );
}
