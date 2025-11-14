'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onCleaned: () => void;
}

type MatchStatus = 'matched' | 'no_adm2_match' | 'no_adm3_name_match' | string | null;

interface PreviewRow {
  dataset_id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  category: string | null;
  value_raw: number | null;
  region_code: string | null;
  province_code: string | null;
  muni_code: string | null;
  adm1_pcode_psa_to_namria: string | null;
  adm2_pcode_psa_to_namria: string | null;
  adm2_pcode_match: string | null;
  adm2_name_match: string | null;
  admin_pcode_clean: string | null;
  admin_name_clean: string | null;
  match_status: MatchStatus;
}

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  onClose,
  onCleaned,
}: Props) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wideFormat, setWideFormat] = useState<boolean>(true); // default for typology sheet
  const [showMismatchedOnly, setShowMismatchedOnly] = useState<boolean>(false);

  // Fetch preview when dataset or wide/tall toggle changes
  useEffect(() => {
    async function fetchPreview() {
      setLoadingPreview(true);
      setError(null);

      const { data, error } = await supabase.rpc('preview_categorical_cleaning', {
        dataset_id: datasetId,
        wide_format: wideFormat,
      });

      if (error) {
        console.error('preview_categorical_cleaning error', error);
        setError(error.message || 'Failed to load preview.');
        setRows([]);
      } else {
        setRows((data ?? []) as PreviewRow[]);
      }

      setLoadingPreview(false);
    }

    fetchPreview();
  }, [datasetId, wideFormat]);

  const { matchedCount, unmatchedCount, visibleRows } = useMemo(() => {
    const matched = rows.filter((r) => r.match_status === 'matched').length;
    const unmatched = rows.length - matched;
    const visible = showMismatchedOnly
      ? rows.filter((r) => r.match_status !== 'matched')
      : rows;
    return {
      matchedCount: matched,
      unmatchedCount: unmatched,
      visibleRows: visible,
    };
  }, [rows, showMismatchedOnly]);

  async function handleApply() {
    setApplying(true);
    setError(null);

    const { error } = await supabase.rpc('clean_categorical_dataset', {
      dataset_id: datasetId,
      wide_format: wideFormat,
    });

    if (error) {
      console.error('clean_categorical_dataset error', error);
      setError(error.message || 'Failed to apply cleaning.');
      setApplying(false);
      return;
    }

    await onCleaned();
    setApplying(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-3">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Clean Categorical Dataset — {datasetName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            disabled={applying}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm space-y-4">
          {/* Toggles */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <input
                id="wide_format"
                type="checkbox"
                className="h-4 w-4"
                checked={wideFormat}
                onChange={(e) => setWideFormat(e.target.checked)}
                disabled={loadingPreview || applying}
              />
              <label htmlFor="wide_format" className="text-gray-800">
                Wide-format data (column headings are categories)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="show_mismatched_only"
                type="checkbox"
                className="h-4 w-4"
                checked={showMismatchedOnly}
                onChange={(e) => setShowMismatchedOnly(e.target.checked)}
                disabled={loadingPreview || applying}
              />
              <label htmlFor="show_mismatched_only" className="text-gray-800">
                Show mismatched rows only
              </label>
            </div>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-green-700">
                Matched
              </div>
              <div className="text-2xl font-semibold text-green-800">
                {matchedCount}
              </div>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-red-700">
                Unmatched
              </div>
              <div className="text-2xl font-semibold text-red-800">
                {unmatchedCount}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Preview table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b px-3 py-2 text-xs text-gray-700">
              Preview (first {visibleRows.length} rows in current filter)
            </div>
            <div className="max-h-[45vh] overflow-auto">
              {loadingPreview ? (
                <div className="px-3 py-4 text-gray-500 text-sm">
                  Loading preview…
                </div>
              ) : visibleRows.length === 0 ? (
                <div className="px-3 py-4 text-gray-500 text-sm">
                  No rows.
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-2 py-1 border-b text-left">PSA PCode (raw)</th>
                      <th className="px-2 py-1 border-b text-left">Admin name (raw)</th>
                      <th className="px-2 py-1 border-b text-left">Category</th>
                      <th className="px-2 py-1 border-b text-right">Value</th>
                      <th className="px-2 py-1 border-b text-left">ADM2 match</th>
                      <th className="px-2 py-1 border-b text-left">ADM3 clean pcode</th>
                      <th className="px-2 py-1 border-b text-left">ADM3 clean name</th>
                      <th className="px-2 py-1 border-b text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 border-b whitespace-nowrap">
                          {row.admin_pcode_raw ?? '—'}
                        </td>
                        <td className="px-2 py-1 border-b whitespace-nowrap">
                          {row.admin_name_raw ?? '—'}
                        </td>
                        <td className="px-2 py-1 border-b whitespace-nowrap">
                          {row.category ?? '—'}
                        </td>
                        <td className="px-2 py-1 border-b text-right">
                          {row.value_raw ?? '—'}
                        </td>
                        <td className="px-2 py-1 border-b whitespace-nowrap">
                          {row.adm2_name_match
                            ? `${row.adm2_name_match} (${row.adm2_pcode_match})`
                            : '—'}
                        </td>
                        <td className="px-2 py-1 border-b whitespace-nowrap">
                          {row.admin_pcode_clean ?? '—'}
                        </td>
                        <td className="px-2 py-1 border-b whitespace-nowrap">
                          {row.admin_name_clean ?? '—'}
                        </td>
                        <td className="px-2 py-1 border-b whitespace-nowrap">
                          {row.match_status ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-gray-200 hover:bg-gray-300"
            disabled={applying}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying || rows.length === 0}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {applying ? 'Applying…' : 'Apply Cleaning'}
          </button>
        </div>
      </div>
    </div>
  );
}
