'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  // Load cleaning preview
  useEffect(() => {
    if (open) fetchPreview();
  }, [open]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('preview_numeric_cleaning_v3', {
      dataset_id: datasetId,
    });
    setLoading(false);

    if (error) {
      console.error('Preview failed:', error);
      setError(error.message);
    } else {
      setPreview(data || []);
    }
  };

  // Confirm clean
  const handleClean = async () => {
    if (!confirm('Confirm cleaning this dataset?')) return;

    setCleaning(true);
    const { error } = await supabase.rpc('clean_numeric_dataset', {
      dataset_id: datasetId,
    });
    setCleaning(false);

    if (error) {
      console.error('Cleaning failed:', error);
      alert('Cleaning failed: ' + error.message);
    } else {
      alert('Dataset successfully cleaned.');
      await onCleaned();
      onOpenChange(false);
    }
  };

  // Render modal
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Clean Dataset — {datasetName}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded mb-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm">Loading preview…</p>
        ) : preview.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Cleaning preview completed. Summary below:
            </p>

            <table className="min-w-full text-sm border rounded overflow-hidden">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  {Object.keys(preview[0]).map((col) => (
                    <th key={col} className="px-3 py-2 text-left">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-3 py-1">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleClean}
                disabled={cleaning}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                {cleaning ? 'Cleaning…' : 'Confirm Clean'}
              </button>
            </div>
          </div>
        ) : (
          !error && (
            <p className="text-gray-500 text-sm">No preview data available.</p>
          )
        )}
      </div>
    </div>
  );
}
