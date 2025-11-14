'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type CategoricalPreviewRow = {
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

type LayoutOverride = 'auto' | 'wide' | 'narrow';

export default function CleanCategoricalDatasetModal({
  open,
  onOpenChange,
  datasetId,
  datasetName,
  onCleaned,
}: Props) {
  const [previewRows, setPreviewRows] = useState<CategoricalPreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [showMismatchedOnly, setShowMismatchedOnly] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanError, setCleanError] = useState<string | null>(null);
  const [cleanSuccess, setCleanSuccess] = useState<string | null>(null);

  const [detectedWide, setDetectedWide] = useState<boolean | null>(null);
  const [layoutOverride, setLayoutOverride] = useState<LayoutOverride>('auto');
  const [detectingLayout, setDetectingLayout] = useState(false);

  const effectiveWide = useMemo(() => {
    if (layoutOverride === 'wide') return true;
    if (layoutOverride === 'narrow') return false;
    return detectedWide ?? false;
  }, [layoutOverride, detectedWide]);

  useEffect(() => {
    if (!open) return;
    // When opened, detect layout once, then load preview
    (async () => {
      if (detectedWide === null) {
        await detectLayout();
      }
      await loadPreview();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, datasetId]);

  // Re-run preview when layout override changes
  useEffect(() => {
    if (!open) return;
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveWide]);

  const detectLayout = async () => {
    setDetectingLayout(true);
    try {
      const { data, error } = await supabase
        .from('dataset_values_categorical_raw')
        .select('raw_row')
        .eq('dataset_id', datasetId)
        .limit(20);

      if (error) {
        console.error('layout detection error', error);
        setDetectedWide(false);
        return;
      }

      const rows = (data || []) as { raw_row: any }[];
      if (rows.length === 0) {
        setDetectedWide(false);
        return;
      }

      let wideScore = 0;
      for (const r of rows) {
        const raw = r.raw_row || {};
        const keys = Object.keys(raw);
        const candidateKeys = keys.filter((k) => {
          const lc = k.toLowerCase();
          if (
            lc.includes('pcode') ||
            lc.includes('code') ||
            lc.includes('admin') ||
            lc.includes('name') ||
            lc === 'shape' ||
            lc === 'geometry' ||
            lc === 'geom'
          ) {
            return false;
          }
          return true;
        });
        if (candidateKeys.length >= 2) {
          wideScore += 1;
        }
      }

      setDetectedWide(wideScore >= rows.length / 3);
    } catch (err) {
      console.error('layout detection unexpected error', err);
      setDetectedWide(false);
    } finally {
      setDetectingLayout(false);
    }
  };

  const loadPreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const { data, error } = await supabase.rpc(
        'preview_categorical_cleaning',
        {
          in_dataset_id: datasetId,
          in_wide_format: effectiveWide,
        }
      );

      if (error) {
        console.error('preview_categorical_cleaning error', error);
        setPreviewError(error.message ?? 'Failed to load preview.');
        setPreviewRows([]);
        return;
      }

      setPreviewRows((data || []) as CategoricalPreviewRow[]);
    } catch (err: any) {
      console.error('preview_categorical_cleaning unexpected error', err);
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
      const { error } = await supabase.rpc('clean_categorical_dataset', {
        p_dataset_id: datasetId,
      });

      if (error) {
        console.error('clean_categorical_dataset error', error);
        setCleanError(error.message ?? 'Cleaning failed.');
        return;
      }

      setCleanSuccess(
        'Cleaning completed. Cleaned, normalized categorical values written to dataset_values_categorical.'
      );
      await onCleaned();
      await loadPreview();
    } catch (err: any) {
      console.error('clean_categorical_dataset unexpected error', err);
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

  const layoutLabel = effectiveWide ? 'Wide' : 'Long / narrow';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Clean Categorical Dataset
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
          <div className="rounded border border-blue-300 bg-blue-50 p-3 text-xs text-blue-900">
            <p className="font-semibold">What this does</p>
            <ul className="ml-4 list-disc space-y-1 pt-1">
              <li>
                Reshapes raw categorical rows into{' '}
                <span className="font-semibold">normalized long format</span>{' '}
                (one row per pcode + category).
              </li>
              <li>
                Uses the same PSA→NAMRIA cleaning logic as numeric to match
                ADM3 boundaries.
              </li>
              <li>
                Writes cleaned rows into{' '}
                <code className="rounded bg-blue-100 px-1 text-[0.7rem]">
                  dataset_values_categorical
                </code>{' '}
                with <code>dataset_id</code>, <code>admin_pcode</code>,{' '}
                <code>category</code>, and <code>value</code>.
              </li>
              <li>
                Raw rows in{' '}
                <code className="rounded bg-blue-100 px-1 text-[0.7rem]">
                  dataset_values_categorical_raw
                </code>{' '}
                are <span className="font-semibold">never modified</span>.
              </li>
            </ul>
          </div>

          {/* Errors / status */}
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

          {/* Layout controls + summary */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-gray-700">
                Data layout (wide vs long)
              </p>
              <p className="text-gray-600">
                Detected:{' '}
                <span className="font-semibold">
                  {detectingLayout
                    ? 'Detecting…'
                    : detectedWide === null
                    ? 'Unknown'
                    : detectedWide
                    ? 'Wide (columns are categories)'
                    : 'Long / narrow (rows are categories)'}
                </span>
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="layout"
                    value="auto"
                    checked={layoutOverride === 'auto'}
                    onChange={() => setLayoutOverride('auto')}
                  />
                  <span>Auto (recommended)</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="layout"
                    value="wide"
                    checked={layoutOverride === 'wide'}
                    onChange={() => setLayoutOverride('wide')}
                  />
                  <span>Force wide</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="layout"
                    value="narrow"
                    checked={layoutOverride === 'narrow'}
                    onChange={() => setLayoutOverride('narrow')}
                  />
                  <span>Force long</span>
                </label>
              </div>
              <p className="mt-1 text-[0.7rem] text-gray-500">
                Effective: <span className="font-semibold">{layoutLabel}</span>{' '}
                (used for preview & cleaning).
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-gray-700">
                Matching summary (preview)
              </p>
              <p className="text-gray-600">
                Total previewed:{' '}
                <span className="font-semibold">{summary.total}</span>{' '}
                <span className="text-[0.65rem] text-gray-500">
                  (preview may be limited for performance)
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
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

              <div className="flex flex-col items-end gap-2 pt-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={showMismatchedOnly}
                    onChange={(e) =>
                      setShowMismatchedOnly(e.target.checked)
                    }
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
          </div>

          {/* Preview table */}
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              Preview of normalized categorical rows (after wide→long reshape
              and PSA→NAMRIA cleaning).
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
                    <th className="border-b px-2 py-1 text-left">Category</th>
                    <th className="border-b px-2 py-1 text-right">
                      Value (raw)
                    </th>
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
                        colSpan={9}
                        className="px-3 py-4 text-center text-xs text-gray-500"
                      >
                        No rows to show.
                      </td>
                    </tr>
                  )}
                  {loadingPreview && (
                    <tr>
                      <td
                        colSpan={9}
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
                        <td className="border-b px-2 py-1">
                          {row.category || '—'}
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
