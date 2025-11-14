'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onCleaned: () => void;
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  onClose,
  onCleaned,
}: Props) {
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMismatches, setShowMismatches] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);

    const { data, error: rpcErr } = await supabase.rpc(
      'preview_numeric_cleaning',
      { in_dataset: datasetId }
    );

    if (rpcErr) {
      setError(rpcErr.message);
      setLoading(false);
      return;
    }

    setPreview(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadPreview();
  }, [datasetId]);

  const runCleaning = async () => {
    const { error: rpcErr } = await supabase.rpc(
      'apply_numeric_cleaning_psa_to_namria',
      { in_dataset: datasetId }
    );

    if (rpcErr) {
      alert('Cleaning failed:\n' + rpcErr.message);
      return;
    }

    onClose();
    await onCleaned();
  };

  const filteredRows = showMismatches
    ? preview.filter((r) => r.match_status !== 'matched')
    : preview;

  const matchedCount = preview.filter((r) => r.match_status === 'matched').length;
  const noAdm2 = preview.filter((r) => r.match_status === 'no_adm2_match').length;
  const noAdm3Name = preview.filter(
    (r) => r.match_status === 'no_adm3_name_match'
  ).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b px-5 py-3">
          <h2 className="text-xl font-semibold text-gray-800">
            Clean Numeric Dataset — {datasetName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 text-sm space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded">
            <ul className="list-disc ml-6">
              <li>Matches PSA-style ADM3 PCodes to NAMRIA ADM3 boundaries.</li>
              <li>Writes cleaned rows into <code>dataset_values_numeric</code>.</li>
              <li>Raw rows remain in <code>dataset_values_numeric_raw</code>.</li>
            </ul>
          </div>

          {/* Summary */}
          <div className="flex gap-4">
            <div className="bg-green-50 border-green-200 border rounded p-3 w-40 text-center">
              <div className="font-semibold text-gray-700">Matched ADM3</div>
              <div className="text-2xl">{matchedCount}</div>
            </div>
            <div className="bg-red-50 border-red-200 border rounded p-3 w-40 text-center">
              <div className="font-semibold text-gray-700">No ADM2 match</div>
              <div className="text-2xl">{noAdm2}</div>
            </div>
            <div className="bg-orange-50 border-orange-200 border rounded p-3 w-40 text-center">
              <div className="font-semibold text-gray-700">No ADM3 name match</div>
              <div className="text-2xl">{noAdm3Name}</div>
            </div>
          </div>

          {/* Toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showMismatches}
              onChange={(e) => setShowMismatches(e.target.checked)}
            />
            Show mismatches only
          </label>

          {/* Preview Table */}
          {!loading && filteredRows.length > 0 && (
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    {Object.keys(filteredRows[0]).map((c) => (
                      <th key={c} className="px-2 py-1 border-b text-left">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => (
                    <tr key={i} className="border-t">
                      {Object.keys(row).map((c) => (
                        <td key={c} className="px-2 py-1 border-b">
                          {String(row[c] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && <p>Loading preview…</p>}
          {!loading && filteredRows.length === 0 && (
            <p className="text-gray-500 italic">No rows.</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={runCleaning}
          >
            Run cleaning & save
          </button>
        </div>
      </div>
    </div>
  );
}
