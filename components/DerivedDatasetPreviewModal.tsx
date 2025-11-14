'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type DerivedDatasetPreviewModalProps = {
  baseDatasetIds: string[];
  formula: string;
  targetLevel: string;
  weight_dataset_id?: string | null;
  onClose: () => void;
};

export default function DerivedDatasetPreviewModal({
  baseDatasetIds,
  formula,
  targetLevel,
  weight_dataset_id,
  onClose,
}: DerivedDatasetPreviewModalProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const { data, error } = await supabase.rpc('preview_derived_dataset', {
          base_dataset_ids: baseDatasetIds,
          formula,
          target_level: targetLevel,
          weight_dataset_id: weight_dataset_id || null,
        });

        if (error) {
          console.error('Preview error:', error);
          setErrorMsg(error.message || 'Failed to preview dataset');
          setRows([]);
        } else {
          setRows(data || []);
        }
      } catch (err: any) {
        setErrorMsg('Unexpected error loading preview.');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [baseDatasetIds, formula, targetLevel, weight_dataset_id]);

  const weightingActive = !!weight_dataset_id;
  const multiLevel =
    Array.isArray(baseDatasetIds) && baseDatasetIds.length > 1 ? true : false;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">
            Preview Derived Dataset
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Info banners */}
        <div className="flex flex-wrap gap-2 text-xs">
          {weightingActive && (
            <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded">
              ⚖ Weighted by selected dataset
            </span>
          )}
          {multiLevel && (
            <span className="inline-flex items-center px-2 py-0.5 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded">
              ⬆ Data levels differ — aligned to {targetLevel}
            </span>
          )}
        </div>

        {/* Status */}
        {loading && (
          <div className="text-center text-gray-500 text-sm py-4">
            Loading preview…
          </div>
        )}

        {errorMsg && (
          <div className="text-center text-red-700 bg-red-50 border border-red-200 rounded py-2 px-3 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Table */}
        {!loading && !errorMsg && rows.length > 0 && (
          <div className="overflow-x-auto max-h-[60vh] border rounded">
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left border-b w-1/3">
                    Admin PCode
                  </th>
                  <th className="px-3 py-2 text-left border-b">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-700">
                      {r.admin_pcode}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-800">
                      {r.value !== null
                        ? Number(r.value).toLocaleString(undefined, {
                            maximumFractionDigits: 3,
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="text-center text-gray-500 text-xs py-1">
                Showing first 50 rows only
              </p>
            )}
          </div>
        )}

        {!loading && !errorMsg && rows.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-4">
            No preview data available.
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
