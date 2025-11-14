'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DerivedDatasetPreviewModal({
  baseDatasetIds,
  formula,
  onClose,
}: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('preview_derived_dataset', {
        base_dataset_ids: baseDatasetIds,
        formula,
      });
      if (!error && data) setRows(data);
      else console.error('Preview error:', error);
      setLoading(false);
    };
    loadPreview();
  }, [baseDatasetIds, formula]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 shadow-lg max-w-3xl w-full">
        <h2 className="text-lg font-semibold mb-3">Derived Dataset Preview</h2>

        {loading ? (
          <div className="text-gray-600 text-sm text-center py-6">
            Generating preview…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-6">
            No data available for preview.
          </div>
        ) : (
          <div className="overflow-y-auto max-h-80 border rounded">
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 border-b text-left">Admin PCode</th>
                  <th className="px-3 py-2 border-b text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">{r.admin_pcode}</td>
                    <td className="px-3 py-2">{r.value?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
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
