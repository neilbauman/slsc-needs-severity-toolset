'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => void;
}

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const [wideMode, setWideMode] = useState(false);
  const [showOnlyMismatches, setShowOnlyMismatches] = useState(false);

  const [stats, setStats] = useState({
    matched: 0,
    unmatched: 0,
  });

  useEffect(() => {
    if (!open) return;
    loadPreview();
  }, [open, wideMode, showOnlyMismatches]);

  async function loadPreview() {
    const { data, error } = await supabase.rpc(
      'preview_categorical_cleaning_v1',
      {
        dataset_id: datasetId,
        wide_mode: wideMode,
      }
    );

    if (error) {
      console.error(error);
      setRows([]);
      return;
    }

    const all = data || [];

    const matched = all.filter(r => r.is_match === true).length;
    const unmatched = all.length - matched;

    setStats({ matched, unmatched });

    if (showOnlyMismatches) {
      setRows(all.filter(r => !r.is_match));
    } else {
      setRows(all);
    }
  }

  async function applyCleaning() {
    setLoading(true);
    const { error } = await supabase.rpc('clean_categorical_dataset', {
      dataset_id: datasetId,
      wide_mode: wideMode,
    });

    setLoading(false);

    if (error) {
      alert('Cleaning failed: ' + error.message);
      return;
    }

    onOpenChange(false);
    onCleaned();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Clean Categorical Dataset — {datasetName}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-600 hover:text-black text-xl"
          >
            ×
          </button>
        </div>

        {/* Options */}
        <div className="px-4 py-3 space-y-3">
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={wideMode}
              onChange={(e) => setWideMode(e.target.checked)}
            />
            <label className="text-gray-700">
              Wide-format data (column headings are categories)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlyMismatches}
              onChange={(e) => setShowOnlyMismatches(e.target.checked)}
            />
            <label className="text-gray-700">
              Show mismatched rows only
            </label>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-green-100 rounded">
              <div className="text-gray-600 text-sm">Matched</div>
              <div className="text-xl font-bold">{stats.matched}</div>
            </div>

            <div className="p-3 bg-red-100 rounded">
              <div className="text-gray-600 text-sm">Unmatched</div>
              <div className="text-xl font-bold">{stats.unmatched}</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                {rows[0] &&
                  Object.keys(rows[0]).map((col) => (
                    <th key={col} className="px-2 py-1 border text-left">
                      {col}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t">
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="px-2 py-1 border">
                      {v === null ? '—' : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-4 text-gray-500">
                    No rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>

          <button
            onClick={applyCleaning}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Cleaning…' : 'Apply Cleaning'}
          </button>
        </div>

      </div>
    </div>
  );
}
