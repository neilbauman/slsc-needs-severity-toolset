'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  baseDatasetIds: string[];
  formula: string;
  targetLevel: string;
  weight_dataset_id?: string | null;
  alignment_method?: 'aggregate' | 'disaggregate' | 'keep';
  onClose: () => void;
}

export default function DerivedDatasetPreviewModal({
  baseDatasetIds,
  formula,
  targetLevel,
  weight_dataset_id,
  alignment_method = 'keep',
  onClose,
}: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoading(true);
        setError(null);

        // Call your Supabase RPC for preview
        // NOTE: This assumes an RPC like `preview_derived_dataset`
        // exists. If not, we’ll mock with placeholder for structure.
        const { data, error } = await supabase.rpc('preview_derived_dataset', {
          base_dataset_ids: baseDatasetIds,
          formula,
          target_level: targetLevel,
          weight_dataset_id,
          alignment_method,
        });

        if (error) {
          console.error(error);
          throw error;
        }

        if (data) setRows(data);
      } catch (err: any) {
        setError(
          err?.message ||
            'Failed to preview derived dataset. Ensure RPC is defined.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [baseDatasetIds, formula, targetLevel, weight_dataset_id, alignment_method]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-3xl space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-lg font-semibold text-gray-800">
            Preview Derived Dataset
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Formula Context */}
        <div className="bg-gray-50 p-3 rounded text-sm border">
          <p className="text-gray-800">
            <strong>Formula:</strong> {formula}
          </p>
          <p className="text-gray-700 mt-1">
            <strong>Target Level:</strong> {targetLevel}
          </p>
          <p className="text-gray-700">
            <strong>Alignment Method:</strong>{' '}
            {alignment_method === 'aggregate'
              ? 'Aggregate to Higher Level'
              : alignment_method === 'disaggregate'
              ? 'Disaggregate to Lower Level'
              : 'Keep Source Level'}
          </p>
          {weight_dataset_id && (
            <p className="text-gray-700">
              <strong>Weighting Dataset ID:</strong> {weight_dataset_id}
            </p>
          )}
        </div>

        {/* Data Section */}
        {loading && (
          <p className="text-gray-600 text-center py-4">Generating preview…</p>
        )}

        {error && (
          <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded text-sm">
            ⚠ {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="text-center text-gray-500">
            No preview results available.
          </p>
        )}

        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  {Object.keys(rows[0]).map((col) => (
                    <th key={col} className="px-3 py-2 border-b text-left">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 25).map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    {Object.values(r).map((val, j) => (
                      <td key={j} className="px-3 py-1.5 text-gray-800">
                        {val === null || val === undefined
                          ? '-'
                          : typeof val === 'number'
                          ? val.toFixed(2)
                          : String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-1">
              Showing first 25 rows for preview.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="mt-3 px-4 py-2 bg-[var(--ssc-blue)] text-white rounded hover:bg-blue-800 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
