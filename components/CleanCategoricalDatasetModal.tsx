'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onCleaned: () => void;
}

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  onClose,
  onCleaned,
}: Props) {
  const [preview, setPreview] = useState<any[]>([]);
  const [wideFormat, setWideFormat] = useState(true);
  const [detectedWide, setDetectedWide] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMismatches, setShowMismatches] = useState(false);

  const detectWide = (rawRows: any[]) => {
    if (rawRows.length === 0) return true;
    const sample = rawRows[0].raw_row || {};
    const keys = Object.keys(sample);
    return keys.length > 6; // crude but effective
  };

  const loadPreview = async () => {
    setLoading(true);
    setError(null);

    const { data: rawRows } = await supabase
      .from('dataset_values_categorical_raw')
      .select('raw_row')
      .eq('dataset_id', datasetId)
      .limit(5);

    const autoWide = detectWide(rawRows || []);
    setDetectedWide(autoWide);
    setWideFormat(autoWide);

    const { data, error: rpcErr } = await supabase.rpc(
      'preview_categorical_cleaning',
      {
        in_dataset_id: datasetId,
        in_wide_format: autoWide,
      }
    );

    if (rpcErr) {
      setError(rpcErr.message);
      setPreview([]);
      setLoading(false);
      return;
    }

    setPreview(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadPreview();
  }, [datasetId]);

  const refreshPreview = async () => {
    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc(
      'preview_categorical_cleaning',
      {
        in_dataset_id: datasetId,
        in_wide_format: wideFormat,
      }
    );
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      setPreview(data || []);
    }
    setLoading(false);
  };

  const runCleaning = async () => {
    const { error: rpcErr } = await supabase.rpc(
      'clean_categorical_dataset',
      { p_dataset_id: datasetId }
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

  const matched = preview.filter((r) => r.match_status === 'matched').length;
  const noAdm2 = preview.filter((r) => r.match_status === 'no_adm2_match').length;
  const noAdm3 = preview.filter(
    (r) => r.match_status === 'no_adm3_name_match'
  ).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-7xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b px-5 py-3">
          <h2 className="text-xl font-semibold text-gray-800">
            Clean Categorical Dataset — {datasetName}
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
              Preview error: {error}
            </div>
          )}

          <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-2 rounded">
            <ul className="list-disc ml-6">
              <li>Reshapes raw categorical rows into normalized long format.</li>
              <li>Uses PSA→NAMRIA pcode logic identical to numeric cleaning.</li>
              <li>
                Writes cleaned rows into{' '}
                <code>dataset_values_categorical</code>.
              </li>
              <li>
                Raw rows in <code>dataset_values_categorical_raw</code> are never
                modified.
              </li>
            </ul>
          </div>

          {/* Wide/Narrow selection */}
          <div>
            <div className="font-semibold text-gray-700">
              Data layout (wide vs long)
            </div>
            <div className="text-gray-600 mb-1">
              Detected:{' '}
              <span className="font-semibold">
                {detectedWide ? 'Wide' : 'Long'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={wideFormat === detectedWide}
                  onChange={() => {
                    setWideFormat(detectedWide);
                    refreshPreview();
                  }}
                />
                Auto (recommended)
              </label>

              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={wideFormat === true}
                  onChange={() => {
                    setWideFormat(true);
                    refreshPreview();
                  }}
                />
                Force wide
              </label>

              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={wideFormat === false}
                  onChange={() => {
                    setWideFormat(false);
                    refreshPreview();
                  }}
                />
                Force long
              </label>
            </div>
          </div>

          {/* Summary */}
          <div className="flex gap-4 mt-3">
            <div className="bg-green-50 border-green-200 border rounded p-3 w-48 text-center">
              <div className="font-semibold text-gray-700">Matched ADM3</div>
              <div className="text-2xl">{matched}</div>
            </div>
            <div className="bg-red-50 border-red-200 border rounded p-3 w-48 text-center">
              <div className="font-semibold text-gray-700">No ADM2 match</div>
              <div className="text-2xl">{noAdm2}</div>
            </div>
            <div className="bg-orange-50 border-orange-200 border rounded p-3 w-48 text-center">
              <div className="font-semibold text-gray-700">No ADM3 name match</div>
              <div className="text-2xl">{noAdm3}</div>
            </div>
          </div>

          {/* Mismatch toggle */}
          <label className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              checked={showMismatches}
              onChange={(e) => setShowMismatches(e.target.checked)}
            />
            Show mismatches only
          </label>

          {/* Preview Table */}
          {loading && <p>Loading preview…</p>}

          {!loading && filteredRows.length > 0 && (
            <div className="overflow-x-auto border rounded mt-3">
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
                  {filteredRows.map((r, i) => (
                    <tr key={i} className="border-t">
                      {Object.keys(r).map((c) => (
                        <td key={c} className="px-2 py-1 border-b whitespace-nowrap">
                          {String(r[c] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredRows.length === 0 && (
            <p className="text-gray-500 italic">No rows to show.</p>
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
            className="px-4 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700"
            onClick={runCleaning}
          >
            Run cleaning & save
          </button>
        </div>
      </div>
    </div>
  );
}
