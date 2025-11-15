'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X } from 'lucide-react';

interface CleanCategoricalDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanCategoricalDatasetModalProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadPreview();
    }
  }, [open]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .rpc('preview_categorical_cleaning_v2', { dataset_id: datasetId });

    if (error) {
      console.error('Preview error:', error);
      setError(error.message);
    } else {
      setPreview(data || []);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.rpc('apply_categorical_cleaning_v2', {
      dataset_id: datasetId,
    });

    if (error) {
      console.error('Apply error:', error);
      setError(error.message);
      setLoading(false);
      return;
    }

    await onCleaned();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          onClick={() => onOpenChange(false)}
        >
          <X size={20} />
        </button>

        <h2 className="text-lg font-semibold mb-2">
          Clean categorical dataset
        </h2>
        <p className="text-gray-600 text-sm mb-4">{datasetName}</p>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-600">
            <Loader2 className="animate-spin mr-2" /> Loading preview…
          </div>
        ) : error ? (
          <div className="text-red-600 bg-red-50 p-3 rounded border border-red-200 text-sm">
            {error}
          </div>
        ) : preview.length === 0 ? (
          <div className="text-gray-500 text-sm text-center">
            No rows found in preview.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-md mb-4">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Match Status</th>
                  <th className="px-3 py-2 text-left">Count</th>
                  <th className="px-3 py-2 text-left">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">{r.match_status}</td>
                    <td className="px-3 py-2">{r.count}</td>
                    <td className="px-3 py-2">{r.percentage?.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-[var(--ssc-blue)] hover:bg-blue-800 text-white rounded-md text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Cleaning…' : 'Apply & Save Cleaned Dataset'}
          </button>
        </div>
      </div>
    </div>
  );
}
