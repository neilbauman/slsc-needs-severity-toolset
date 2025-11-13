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

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState({
    matched: 0,
    no_adm2: 0,
    no_adm3: 0,
  });

  const [showOnlyMismatches, setShowOnlyMismatches] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadPreview();
  }, [open, showOnlyMismatches]);

  async function loadPreview() {
    const { data, error } = await supabase.rpc(
      'preview_numeric_cleaning_v2',
      { dataset_id: datasetId }
    );

    if (error) {
      console.error('Preview error:', error);
      setRows([]);
      return;
    }

    const all = data || [];

    const matched = all.filter(r => r.match_status === 'matched').length;
    const noAdm2 = all.filter(r => r.match_status === 'no_adm2_match').length;
    const noAdm3 = all.filter(r => r.match_status === 'no_adm3_name_match').length;

    setStats({
      matched,
      no_adm2: noAdm2,
      no_adm3: noAdm3,
    });

    if (showOnlyMismatches) {
      setRows(all.filter(r => r.match_status !== 'matched'));
    } else {
      setRows(all);
    }
  }

  async function applyCleaning() {
    setLoading(true);
    const { error } = await supabase.rpc('clean_numeric_dataset', {
      dataset_id: datasetId
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
            Clean Numeric Dataset — {datasetName}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-600 hover:text-black text-xl"
          >
            ×
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 p-4">
          <div className="p-3 bg-green-100 rounded">
            <div className="text-gray-600 text-sm">Matched</div>
            <div className="text-xl font-bold">{stats.matched}</div>
          </div>

          <div className="p-3 bg-yellow-100 rounded">
            <div className="text-gray-600 text-sm">No ADM2 Match</div>
            <div className="text-xl font-bold">{stats.no_adm2}</div>
          </div>

          <div className="p-3 bg-red-100 rounded">
            <div className="text-gray-600 text-sm">No ADM3 Name Match</div>
            <div className="text-xl font-bold">{stats.no_adm3}</div>
          </div>
        </div>

        {/* Toggle */}
        <div className="px-4 pb-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={showOnlyMismatches}
            onChange={(e) => setShowOnlyMismatches(e.target.checked)}
          />
          <label className="text-gray-700">
            Show mismatched rows only
          </label>
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
