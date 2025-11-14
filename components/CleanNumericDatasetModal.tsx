'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => void;
}

type NumericPreviewRow = {
  match_status?: string | null;
  [key: string]: any;
};

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [previewRows, setPreviewRows] = useState<NumericPreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load preview whenever the modal opens
  useEffect(() => {
    if (!open) {
      // reset lightweight state
      setPreviewRows([]);
      setError(null);
      setLoadingPreview(false);
      setApplying(false);
      return;
    }

    const load = async () => {
      setLoadingPreview(true);
      setError(null);

      const { data, error } = await supabase.rpc('preview_numeric_cleaning_v2', {
        in_dataset: datasetId,
      });

      if (error) {
        console.error('preview_numeric_cleaning_v2 error:', error);
        setError(error.message);
        setPreviewRows([]);
      } else {
        setPreviewRows((data as NumericPreviewRow[]) || []);
      }

      setLoadingPreview(false);
    };

    load();
  }, [open, datasetId]);

  const close = () => {
    if (!applying) {
      onOpenChange(false);
    }
  };

  const matchSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of previewRows) {
      const key = (row.match_status || 'unknown') as string;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [previewRows]);

  const allColumns = useMemo(() => {
    const cols = new Set<string>();
    previewRows.forEach((r) => {
      Object.keys(r).forEach((k) => cols.add(k));
    });
    return Array.from(cols);
  }, [previewRows]);

  const handleApply = async () => {
    setApplying(true);
    setError(null);

    const { error } = await supabase.rpc('clean_numeric_dataset', {
      in_dataset: datasetId,
    });

    if (error) {
      console.error('clean_numeric_dataset error:', error);
      setError(error.message);
      setApplying(false);
      return;
    }

    // Notify parent and close
    await onCleaned();
    setApplying(false);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-gray-900">
              Clean Numeric Dataset
            </h2>
            <p className="text-xs text-gray-600">
              Dataset: <span className="font-medium">{datasetName}</span>
            </p>
          </div>
          <button
            onClick={close}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            disabled={applying}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs md:text-sm">
          {error && (
            <div className="border border-red-300 bg-red-50 text-red-800 px-3 py-2 rounded">
              <p className="font-semibold">Error</p>
              <p className="mt-1 break-all">{error}</p>
            </div>
          )}

          <div className="border rounded px-3 py-2 bg-gray-50 text-gray-700">
            <p className="font-semibold mb-1">What this step does</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Uses{' '}
                <code className="px-1 bg-gray-100 rounded text-[0.65rem]">
                  preview_numeric_cleaning_v2
                </code>{' '}
                to match your raw rows to official admin boundaries.
              </li>
              <li>
                When you click{' '}
                <span className="font-medium">Apply cleaning</span>, it calls{' '}
                <code className="px-1 bg-gray-100 rounded text-[0.65rem]">
                  clean_numeric_dataset
                </code>{' '}
                and writes the{' '}
                <span className="font-medium">matched rows</span> into{' '}
                <code className="px-1 bg-gray-100 rounded text-[0.65rem]">
                  dataset_values_numeric
                </code>
                .
              </li>
              <li>
                Your{' '}
                <code className="px-1 bg-gray-100 rounded text-[0.65rem]">
                  dataset_values_numeric_raw
                </code>{' '}
                staging rows are kept for traceability.
              </li>
            </ul>
          </div>

          {/* Summary */}
          <div className="border rounded px-3 py-2">
            <p className="font-semibold text-gray-800 mb-2">Match summary</p>
            {loadingPreview ? (
              <p className="text-gray-600 text-xs">Loading preview…</p>
            ) : previewRows.length === 0 ? (
              <p className="text-gray-600 text-xs">
                No preview rows returned. Check that raw numeric rows exist for this dataset.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {Object.keys(matchSummary).map((key) => (
                  <div
                    key={key}
                    className="border rounded px-2 py-1 text-xs bg-gray-50 flex items-center gap-2"
                  >
                    <span className="font-medium">{key}</span>
                    <span className="text-gray-500">· {matchSummary[key]} rows</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Table preview */}
          {previewRows.length > 0 && (
            <div>
              <p className="font-semibold text-gray-800 mb-1">
                Preview rows ({previewRows.length})
              </p>
              <div className="border rounded overflow-auto max-h-[45vh]">
                <table className="min-w-full border-collapse text-[0.7rem]">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      {allColumns.map((col) => (
                        <th
                          key={col}
                          className="px-2 py-1 border-b text-left font-semibold text-gray-700 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        {allColumns.map((col) => (
                          <td
                            key={col}
                            className="px-2 py-1 border-b whitespace-nowrap text-gray-800"
                          >
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex justify-between items-center text-xs md:text-sm">
          <button
            onClick={close}
            className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
            disabled={applying}
          >
            Cancel
          </button>

          <button
            onClick={handleApply}
            disabled={applying || loadingPreview || previewRows.length === 0}
            className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {applying ? 'Applying cleaning…' : 'Apply cleaning and save'}
          </button>
        </div>
      </div>
    </div>
  );
}
