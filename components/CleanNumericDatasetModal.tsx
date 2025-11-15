'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function CleanNumericDatasetModal({ datasetId, datasetName, onClose, onSaved }: CleanNumericDatasetModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ match_status: string; count: number; percentage: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.rpc('preview_numeric_cleaning_v3', { dataset_id: datasetId });

      if (error) {
        console.error('Error loading cleaning preview:', error);
        setError(error.message || 'Failed to preview cleaning.');
      } else if (data) {
        setStats(data);
      }
      setLoading(false);
    };

    loadPreview();
  }, [datasetId]);

  const applyCleaning = async () => {
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc('clean_numeric_dataset', { _dataset_id: datasetId });

    if (error) {
      console.error('Error applying cleaning:', error);
      setError(error.message || 'Failed to save cleaned dataset.');
    } else {
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Clean numeric dataset
        </h2>
        <p className="text-gray-600 text-sm">{datasetName}</p>

        {loading ? (
          <div className="flex justify-center items-center py-10 text-gray-600">
            <Loader2 className="animate-spin mr-2" size={20} />
            Analyzing dataset…
          </div>
        ) : error ? (
          <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded text-sm">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {stats.length > 0 ? (
              stats.map((row) => (
                <div key={row.match_status} className="bg-gray-50 rounded-lg p-4 text-center border">
                  <div className="text-sm text-gray-500 mb-1 capitalize">{row.match_status}</div>
                  <div className="text-2xl font-semibold text-gray-800">{row.count.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{row.percentage.toFixed(2)}%</div>
                </div>
              ))
            ) : (
              <div className="col-span-4 text-center text-gray-500 py-4">
                No matching results found.
              </div>
            )}
          </div>
        )}

        <div className="text-gray-500 text-sm">
          This will overwrite existing cleaned numeric values for this dataset.
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={applyCleaning}
            disabled={saving || loading}
            className="px-4 py-2 bg-[var(--ssc-blue)] hover:bg-blue-800 text-white rounded-md text-sm flex items-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {saving ? 'Saving…' : 'Apply & save cleaned dataset'}
          </button>
        </div>
      </div>
    </div>
  );
}
