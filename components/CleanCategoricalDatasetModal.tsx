'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X } from 'lucide-react';

interface CleanDatasetModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  onClose,
  onSaved,
}: CleanDatasetModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    previewCleaning();
  }, []);

  const previewCleaning = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('preview_categorical_cleaning_v2', {
      dataset_id: datasetId,
    });
    if (error) {
      console.error('Error previewing categorical cleaning:', error);
      setError(error.message);
    } else {
      setPreview(data || []);
    }
    setLoading(false);
  };

  const applyCleaning = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('apply_categorical_cleaning_v2', {
      dataset_id: datasetId,
    });
    setSaving(false);
    if (error) {
      console.error('Error applying categorical cleaning:', error);
      alert('Failed to apply cleaning: ' + error.message);
    } else {
      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold mb-4">
          Clean categorical dataset
        </h2>
        <p className="text-sm text-gray-600 mb-4">{datasetName}</p>

        {loading ? (
          <div className="flex justify-center items-center py-8 text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading preview…
          </div>
        ) : error ? (
          <div className="text-red-600 bg-red-50 border border-red-200 p-3 rounded">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {preview.map((row: any, i: number) => (
              <div
                key={i}
                className="text-center border rounded p-3 bg-gray-50 text-sm"
              >
                <div className="font-medium text-gray-700">
                  {row.match_status}
                </div>
                <div className="text-gray-800 text-lg font-semibold">
                  {row.count}
                </div>
                <div className="text-xs text-gray-500">
                  {Number(row.percentage).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-600 mb-4">
          This will overwrite existing cleaned categorical values for this dataset.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={applyCleaning}
            disabled={saving}
            className="px-4 py-2 bg-[var(--ssc-blue)] text-white rounded hover:bg-blue-800 text-sm"
          >
            {saving ? 'Saving…' : 'Apply & save cleaned dataset'}
          </button>
        </div>
      </div>
    </div>
  );
}
