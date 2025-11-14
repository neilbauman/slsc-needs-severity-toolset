'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CleanCategoricalDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void> | void;
}

type MatchStatus = 'matched' | 'no_adm2_match' | 'no_adm3_name_match' | string;

interface CategoricalPreviewRow {
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
  match_status: MatchStatus | null;
}

interface CategoricalSummary {
  total: number;
  matched: number;
  noAdm2: number;
  noAdm3: number;
}

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanCategoricalDatasetModalProps) {
  const [rows, setRows] = useState<CategoricalPreviewRow[]>([]);
  const [summary, setSummary] = useState<CategoricalSummary | null>(null);
  const [wideFormat, setWideFormat] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadPreview(wideFormat);
  }, [open, datasetId, wideFormat]);

  async function loadPreview(useWide: boolean) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc('preview_categorical_cleaning', {
        in_dataset_id: datasetId,
        in_wide_format: useWide,
      });

      if (error) {
        console.error('preview_categorical_cleaning error', error);
        setErrorMsg(error.message || 'Failed to load categorical preview.');
        setRows([]);
        setSummary(null);
        return;
      }

      const preview = (data || []) as CategoricalPreviewRow[];

      const total = preview.length;
      const matched = preview.filter((r) => r.match_status === 'matched').length;
      const noAdm2 = preview.filter(
        (r) => r.match_status === 'no_adm2_match'
      ).length;
      const noAdm3 = preview.filter(
        (r) => r.match_status === 'no_adm3_name_match'
      ).length;

      setRows(preview);
      setSummary({ total, matched, noAdm2, noAdm3 });
    } catch (err: any) {
      console.error('loadPreview categorical exception', err);
      setErrorMsg(err.message || 'Failed to load categorical preview.');
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  const displayRows = useMemo(() => rows.slice(0, 1000), [rows]);

  async function handleApplyCleaning() {
    if (!datasetId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.rpc('clean_categorical_dataset', {
        p_dataset_id: datasetId,
      });
      if (error) {
        console.error('clean_categorical_dataset error', error);
        setErrorMsg(error.message || 'Failed to apply categorical cleaning.');
        return;
      }

      alert('✅ Categorical dataset cleaned and saved.');
      await onCleaned();
      onOpenChange(false);
    } catch (err: any) {
      console.error('handleApplyCleaning exception', err);
      setErrorMsg(err.message || 'Failed to apply categorical cleaning.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={() => !loading && onOpenChange(false)} />
      <div
        className="modal"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Clean Categorical Dataset
            </h2>
            <p className="text-xs text-gray-500">
              {datasetName} ({datasetId})
            </p>
          </div>
          <button
            className="text-gray-500 hover:text-gray-700 text-xl"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          {/* Summary panel */}
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800 text-sm">
                Match quality preview
              </h3>
              <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={wideFormat}
                  onChange={(e) => setWideFormat(e.target.checked)}
                  disabled={loading}
                />
                Treat dataset as wide format (columns are building typology
                categories)
              </label>
            </div>
            {summary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <div className="text-gray-500">Total rows</div>
                  <div className="font-semibold">{summary.total}</div>
                </div>
                <div>
                  <div className="text-gray-500">Matched ADM3</div>
                  <div className="font-semibold text-green-700">
                    {summary.matched}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">No ADM2 match</div>
                  <div className="font-semibold text-red-700">
                    {summary.noAdm2}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">No ADM3 name match</div>
                  <div className="font-semibold text-orange-700">
                    {summary.noAdm3}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                {loading
                  ? 'Loading preview…'
                  : 'No preview loaded yet. It may have failed to load.'}
              </p>
            )}
          </div>

          {errorMsg && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {errorMsg}
            </div>
          )}

          {/* Preview table */}
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800 text-sm">
                Preview of reshaped categorical values
              </h3>
              <p className="text-[11px] text-gray-500">
                Showing first {displayRows.length.toLocaleString()} of{' '}
                {rows.length.toLocaleString()} rows
              </p>
            </div>
            <div className="overflow-x-auto max-h-[360px] border rounded">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 border-b text-left">Raw PCode</th>
                    <th className="px-2 py-1 border-b text-left">Raw Name</th>
                    <th className="px-2 py-1 border-b text-left">Category</th>
                    <th className="px-2 py-1 border-b text-right">Value</th>
                    <th className="px-2 py-1 border-b text-left">ADM3 PCode</th>
                    <th className="px-2 py-1 border-b text-left">ADM3 Name</th>
                    <th className="px-2 py-1 border-b text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1 border-b">
                        {r.admin_pcode_raw || '—'}
                      </td>
                      <td className="px-2 py-1 border-b">
                        {r.admin_name_raw || '—'}
                      </td>
                      <td className="px-2 py-1 border-b">
                        {r.category || '—'}
                      </td>
                      <td className="px-2 py-1 border-b text-right">
                        {r.value_raw ?? '—'}
                      </td>
                      <td className="px-2 py-1 border-b">
                        {r.admin_pcode_clean || '—'}
                      </td>
                      <td className="px-2 py-1 border-b">
                        {r.admin_name_clean || '—'}
                      </td>
                      <td className="px-2 py-1 border-b">
                        {r.match_status || '—'}
                      </td>
                    </tr>
                  ))}
                  {displayRows.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-2 py-2 text-center text-gray-500"
                      >
                        No preview rows to display.
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-2 py-2 text-center text-gray-500"
                      >
                        Loading…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="border-t px-4 py-3 flex justify-between items-center text-xs">
          <div className="text-gray-500">
            This will overwrite existing cleaned categorical values for this
            dataset.
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleApplyCleaning}
              disabled={loading || rows.length === 0}
            >
              {loading ? 'Working…' : 'Apply Cleaning'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
