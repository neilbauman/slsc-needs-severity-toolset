'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CleanCategoricalDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => void;
}

type CategoricalPreviewRow = {
  match_status?: string | null;
  category?: string | null;
  value_raw?: number | null;
  [key: string]: any;
};

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanCategoricalDatasetModalProps) {
  const [isWide, setIsWide] = useState(true);
  const [previewRows, setPreviewRows] = useState<CategoricalPreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When modal opens or wide/long toggle changes, reload preview
  useEffect(() => {
    if (!open) {
      setPreviewRows([]);
      setError(null);
      setLoadingPreview(false);
      setApplying(false);
      // keep isWide as last selection
      return;
    }

    const load = async () => {
      setLoadingPreview(true);
      setError(null);

      const { data, error } = await supabase.rpc(
        'preview_categorical_cleaning',
        {
          in_dataset_id: datasetId,
          in_wide_format: isWide,
        }
      );

      if (error) {
        console.error('preview_categorical_cleaning error:', error);
        setError(error.message);
        setPreviewRows([]);
      } else {
        setPreviewRows((data as CategoricalPreviewRow[]) || []);
      }

      setLoadingPreview(false);
    };

    load();
  }, [open, datasetId, isWide]);

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

    const { error } = await supabase.rpc('clean_categorical_dataset', {
      p_dataset_id: datasetId,
    });

    if (error) {
      console.error('clean_categorical_dataset error:', error);
      setError(error.message);
      setApplying(false);
      return;
    }

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
              Clean Categorical Dataset
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

          {/* Explanation */}
          <div className="border rounded px-3 py-2 bg-gray-50 text-gray-700 space-y-1">
            <p className="font-semibold mb-1">What this step does</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Reshapes your raw dataset into a{' '}
                <span className="font-medium">long format</span> using{' '}
                <code className="px-1 bg-gray-100 rounded text-[0.65rem]">
                  preview_categorical_cleaning
                </code>
                .
              </li>
              <li>
                Applies the same PSA → NAMRIA pcode logic used for numeric cleaning to
                find ADM2 and ADM3 boundary matches.
              </li>
              <li>
                When you click{' '}
                <span className="font-medium">Apply cleaning</span>, it writes matched
                rows into{' '}
                <code className="px-1 bg-gray-100 rounded text-[0.65rem]">
                  dataset_values_categorical
                </code>{' '}
                via{' '}
                <code className="px-1 bg-gray-100 rounded text-[0.65rem]">
                  clean_categorical_dataset
                </code>
                , keeping your{' '}
                <code className="px-1 bg-gray-100 rounded text-[0.65rem]">
                  dataset_values_categorical_raw
                </code>{' '}
                intact.
              </li>
            </ul>
          </div>

          {/* Format toggle */}
          <div className="border rounded px-3 py-2 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-semibold text-gray-800">
                Input shape / format
              </p>
              <div className="inline-flex rounded border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setIsWide(true)}
                  className={
                    'px-3 py-1 border-r ' +
                    (isWide
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50')
                  }
                  disabled={loadingPreview || applying}
                >
                  Wide (categories in columns)
                </button>
                <button
                  type="button"
                  onClick={() => setIsWide(false)}
                  className={
                    'px-3 py-1 ' +
                    (!isWide
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50')
                  }
                  disabled={loadingPreview || applying}
                >
                  Long / normalized (category + value columns)
                </button>
              </div>
            </div>
            <p className="text-gray-600 text-xs">
              Wide = building typology style datasets where each category is a separate
              column and values are counts. Long = rows like{' '}
              <code className="px-1 bg-gray-100 rounded text-[0.65rem]">
                category, value
              </code>{' '}
              per admin unit.
            </p>
          </div>

          {/* Summary */}
          <div className="border rounded px-3 py-2">
            <p className="font-semibold text-gray-800 mb-2">Match summary</p>
            {loadingPreview ? (
              <p className="text-gray-600 text-xs">Loading preview…</p>
            ) : previewRows.length === 0 ? (
              <p className="text-gray-600 text-xs">
                No preview rows returned. Check that raw categorical rows exist for this
                dataset and that the shape setting (wide/long) is correct.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {Object.keys(matchSummary).map((key) => (
                  <div
                    key={key}
                    className="border rounded px-2 py-1 text-xs bg-gray-50 flex items-center gap-2"
                  >
                    <span className="font-medium">{key}</span>
                    <span className="text-gray-500">
                      · {matchSummary[key]} rows
                    </span>
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
            className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {applying ? 'Applying cleaning…' : 'Apply cleaning and save'}
          </button>
        </div>
      </div>
    </div>
  );
}
