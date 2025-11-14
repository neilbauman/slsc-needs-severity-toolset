'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onCleaned: () => void | Promise<void>;
}

type PreviewRow = Record<string, any>;

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  onClose,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingClean, setLoadingClean] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMismatchesOnly, setShowMismatchesOnly] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      setLoadingPreview(true);
      setError(null);
      try {
        const { data, error } = await supabase.rpc(
          'preview_numeric_cleaning_v2',
          { dataset_id: datasetId }
        );

        if (error) {
          console.error('preview_numeric_cleaning_v2 error:', error);
          setError('Failed to load cleaning preview.');
        } else {
          setPreviewRows((data as PreviewRow[]) || []);
        }
      } catch (err: any) {
        console.error('Unexpected preview error:', err);
        setError(err.message || 'Unexpected error loading preview.');
      } finally {
        setLoadingPreview(false);
      }
    };

    if (datasetId) {
      fetchPreview();
    }
  }, [datasetId]);

  const handleRunCleaning = async () => {
    setLoadingClean(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('clean_numeric_dataset', {
        dataset_id: datasetId,
      });

      if (error) {
        console.error('clean_numeric_dataset error:', error);
        setError('Cleaning failed.');
      } else {
        await onCleaned();
        onClose();
      }
    } catch (err: any) {
      console.error('Unexpected cleaning error:', err);
      setError(err.message || 'Unexpected error during cleaning.');
    } finally {
      setLoadingClean(false);
    }
  };

  const displayedRows = showMismatchesOnly
    ? previewRows.filter(
        (r) =>
          r.match_status &&
          typeof r.match_status === 'string' &&
          r.match_status.toLowerCase() !== 'matched'
      )
    : previewRows;

  const columns = previewRows.length
    ? Array.from(
        new Set(previewRows.flatMap((r) => Object.keys(r || {})))
      )
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Clean Numeric Dataset
            </h2>
            <p className="text-xs text-gray-500">
              {datasetName} — raw numeric values → cleaned & normalized, with
              admin pcode / name matching.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
            disabled={loadingClean}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
          {error && <p className="text-red-600">{error}</p>}

          <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2 text-xs text-blue-800">
            <p className="font-semibold mb-1">What this will do</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Parse and normalize numeric values (percentages vs counts).</li>
              <li>
                Clean and match Admin PCodes / names to official boundaries (ADM1–ADM3).
              </li>
              <li>
                Write final values into <code>dataset_values</code> for this dataset.
              </li>
              <li>
                Raw staging rows remain in{' '}
                <code>dataset_values_numeric_raw</code> for auditability.
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                id="mismatch-only-numeric"
                type="checkbox"
                className="h-4 w-4"
                checked={showMismatchesOnly}
                onChange={(e) => setShowMismatchesOnly(e.target.checked)}
              />
              <label
                htmlFor="mismatch-only-numeric"
                className="text-xs text-gray-700"
              >
                Show rows with matching problems only (non-<code>matched</code>{' '}
                status)
              </label>
            </div>
            {loadingPreview && (
              <span className="text-xs text-gray-500">
                Loading preview…
              </span>
            )}
          </div>

          {/* Preview table */}
          {columns.length ? (
            <div className="overflow-x-auto border rounded-md bg-white">
              <table className="min-w-full text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-2 py-1 border-b text-left font-semibold"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-2 py-2 text-center text-gray-500"
                      >
                        No rows to display with current filter.
                      </td>
                    </tr>
                  )}
                  {displayedRows.map((row, i) => (
                    <tr key={i} className="border-t">
                      {columns.map((col) => (
                        <td key={col} className="px-2 py-1 border-b">
                          {row[col] === null || row[col] === undefined
                            ? '—'
                            : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !loadingPreview && (
              <p className="text-xs text-gray-500">
                No preview rows returned from <code>preview_numeric_cleaning_v2</code>.
              </p>
            )
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-gray-200 hover:bg-gray-300"
            disabled={loadingClean}
          >
            Cancel
          </button>
          <button
            onClick={handleRunCleaning}
            disabled={loadingClean}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loadingClean ? 'Running cleaning…' : 'Run cleaning & save'}
          </button>
        </div>
      </div>
    </div>
  );
}
