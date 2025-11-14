'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type NumericPreviewRow = {
  dataset_id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
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
  match_status:
    | 'matched'
    | 'no_adm2_match'
    | 'no_adm3_name_match'
    | string
    | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetId: string;
  datasetName: string;
  onCleaned: () => void;
}

export default function CleanNumericDatasetModal({
  open,
  onOpenChange,
  datasetId,
  datasetName,
  onCleaned,
}: Props) {
  const [previewRows, setPreviewRows] = useState<NumericPreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [showMismatchedOnly, setShowMismatchedOnly] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanError, setCleanError] = useState<string | null>(null);
  const [cleanSuccess, setCleanSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    loadPreview();
  }, [open, datasetId]);

  const loadPreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const { data, error } = await supabase.rpc('preview_numeric_cleaning', {
        in_dataset: datasetId,
      });

      if (error) {
        console.error('preview_numeric_cleaning error', error);
        setPreviewError(error.message ?? 'Failed to load preview.');
        setPreviewRows([]);
        return;
      }

      setPreviewRows((data || []) as NumericPreviewRow[]);
    } catch (err: any) {
      console.error('preview_numeric_cleaning unexpected error', err);
      setPreviewError(err.message ?? 'Failed to load preview.');
      setPreviewRows([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleClose = () => {
    setPreviewError(null);
    setCleanError(null);
    setCleanSuccess(null);
    setShowMismatchedOnly(false);
    onOpenChange(false);
  };

  const handleClean = async () => {
    setCleaning(true);
    setCleanError(null);
    setCleanSuccess(null);
    try {
      const { error } = await supabase.rpc('clean_numeric_dataset', {
        in_dataset: datasetId,
      });

      if (error) {
        console.error('clean_numeric_dataset error', error);
        setCleanError(error.message ?? 'Cleaning failed.');
        return;
      }

      setCleanSuccess('Cleaning completed. Cleaned values written to dataset_values_numeric.');
      await onCleaned();
      await loadPreview();
    } catch (err: any) {
      console.error('clean_numeric_dataset unexpected error', err);
      setCleanError(err.message ?? 'Cleaning failed.');
    } finally {
      setCleaning(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!showMismatchedOnly) return previewRows;
    return previewRows.filter(
      (r) => r.match_status && r.match_status !== 'matched'
    );
  }, [previewRows, showMismatchedOnly]);

  const summary = useMemo(() => {
    let matched = 0;
    let noAdm2 = 0;
    let noAdm3 = 0;
    for (const r of previewRows) {
      if (r.match_status === 'matched') matched += 1;
      else if (r.match_status === 'no_adm2_match') noAdm2 += 1;
      else if (r.match_status === 'no_adm3_name_match') noAdm3 += 1;
    }
    return { matched, noAdm2, noAdm3, total: previewRows.length };
  }, [previewRows]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Clean Numeric Dataset
            </h2>
            <p className="text-xs text-gray-500">
              Dataset: <span className="font-medium">{datasetName}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-xl text-gray-500 hover:text-gray-700"
            disabled={cleaning}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-4 py-3 text-sm">
          <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900">
            <p className="font-semibold">What this does</p>
            <ul className="ml-4 list-disc space-y-1 pt-1">
              <li>
                Matches PSA-style admin codes/names to{' '}
                <code className="rounded bg-yellow-100 px-1 text-[0.7rem]">
                  admin_boundaries
                </code>{' '}
                at ADM3.
              </li>
              <li>
                Writes cleaned rows into{' '}
                <code className="rounded bg-yellow-100 px-1 text-[0.7rem]">
                  dataset_values_numeric
                </code>
                .
              </li>
              <li>
                Raw rows in{' '}
                <code className="rounded bg-yellow-100 px-1 text-[0.7rem]">
                  dataset_values_numeric_raw
                </code>{' '}
                are <span className="font-semibold">never modified</span>.
              </li>
            </ul>
          </div>

          {/* Status */}
          {(previewError || cleanError || cleanSuccess) && (
            <div className="space-y-2">
              {previewError && (
                <p className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                  Preview error: {previewError}
                </p>
              )}
              {cleanError && (
                <p className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                  Cleaning error: {cleanError}
                </p>
              )}
              {cleanSuccess && (
                <p className="rounded border border-green-300 bg-green-50 p-2 text-xs text-green-700">
                  {cleanSuccess}
                </p>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-gray-700">
                Matching summary (preview)
              </p>
              <p className="text-gray-600">
                Total previewed:{' '}
                <span className="font-semibold">{summary.total}</span>{' '}
                <span className="text-[0.65rem] text-gray-500">
                  (preview may be limited to ~1000 rows for performance)
                </span>
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="rounded bg-green-50 px-2 py-0.5 text-[0.7rem] text-green-700">
                  Matched ADM3: {summary.matched}
                </span>
                <span className="rounded bg-red-50 px-2 py-0.5 text-[0.7rem] text-red-700">
                  No ADM2 match: {summary.noAdm2}
                </span>
                <span className="rounded bg-orange-50 px-2 py-0.5 text-[0.7rem] text-orange-700">
                  No ADM3 name match: {summary.noAdm3}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={showMismatchedOnly}
                  onChange={(e) => setShowMismatchedOnly(e.target.checked)}
                />
                <span>Show mismatches only</span>
              </label>
              <button
                onClick={loadPreview}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                disabled={loadingPreview}
              >
                {loadingPreview ? 'Refreshing preview…' : 'Refresh preview'}
              </button>
            </div>
          </div>

          {/* Preview table */}
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              Preview of cleaned matching (first few hundred / thousand rows).
            </p>
            <div className="max-h-80 overflow-auto rounded border">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-gray-100 text-[0.7rem] text-gray-700">
                  <tr>
                    <th className="border-b px-2 py-1 text-left">
                      Admin PCode (raw)
                    </th>
                    <th className="border-b px-2 py-1 text-left">
                      Admin Name (raw)
                    </th>
                    <th className="border-b px-2 py-1 text-right">Value (raw)</th>
                    <th className="border-b px-2 py-1 text-left">
                      ADM2 PCode (guess)
                    </th>
                    <th className="border-b px-2 py-1 text-left">
                      ADM2 Name (match)
                    </th>
                    <th className="border-b px-2 py-1 text-left">
                      ADM3 PCode (clean)
                    </th>
                    <th className="border-b px-2 py-1 text-left">
                      ADM3 Name (clean)
                    </th>
                    <th className="border-b px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && !loadingPreview && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-4 text-center text-xs text-gray-500"
                      >
                        No rows to show.
                      </td>
                    </tr>
                  )}
                  {loadingPreview && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-4 text-center text-xs text-gray-500"
                      >
                        Loading preview…
                      </td>
                    </tr>
                  )}
                  {!loadingPreview &&
                    filteredRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={
                          row.match_status && row.match_status !== 'matched'
                            ? 'bg-red-50'
                            : ''
                        }
                      >
                        <td className="border-b px-2 py-1">
                          {row.admin_pcode_raw || '—'}
                        </td>
                        <td className="border-b px-2 py-1">
                          {row.admin_name_raw || '—'}
                        </td>
                        <td className="border-b px-2 py-1 text-right">
                          {row.value_raw ?? '—'}
                        </td>
                        <td className="border-b px-2 py-1">
                          {row.adm2_pcode_psa_to_namria || '—'}
                        </td>
                        <td className="border-b px-2 py-1">
                          {row.adm2_name_match || '—'}
                        </td>
                        <td className="border-b px-2 py-1">
                          {row.admin_pcode_clean || '—'}
                        </td>
                        <td className="border-b px-2 py-1">
                          {row.admin_name_clean || '—'}
                        </td>
                        <td className="border-b px-2 py-1">
                          {row.match_status || '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t px-4 py-3 text-sm">
          <button
            onClick={handleClose}
            className="rounded bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
            disabled={cleaning}
          >
            Cancel
          </button>
          <button
            onClick={handleClean}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={cleaning}
          >
            {cleaning ? 'Running cleaning…' : 'Run cleaning and save'}
          </button>
        </div>
      </div>
    </div>
  );
}
