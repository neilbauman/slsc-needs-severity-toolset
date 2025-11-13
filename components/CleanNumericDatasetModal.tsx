// components/CleanNumericDatasetModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PreviewRow = {
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  value_raw: string | null;
  region_code: string | null;
  province_code: string | null;
  muni_code: string | null;
  adm1_pcode_psa_to_namria: string | null;
  adm2_pcode_psa_to_namria: string | null;
  adm2_pcode_match: string | null;
  adm2_name_match: string | null;
  admin_pcode_clean: string | null;
  admin_name_clean: string | null;
  match_status: 'matched' | 'no_adm2_match' | 'no_adm3_name_match' | string;
};

type CleanNumericDatasetModalProps = {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned?: () => void;
};

export default function CleanNumericDatasetModal({
  datasetId,
  open,
  onOpenChange,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const loadPreview = async () => {
      setLoadingPreview(true);
      setError(null);

      const { data, error } = await supabase.rpc('preview_numeric_cleaning_v2', {
        in_dataset: datasetId,
      });

      if (error) {
        console.error('Error loading preview_numeric_cleaning_v2:', error);
        setError(error.message);
        setRows([]);
      } else {
        setRows((data || []) as PreviewRow[]);
      }

      setLoadingPreview(false);
    };

    loadPreview();
  }, [open, datasetId]);

  const handleApply = async () => {
    setApplying(true);
    setError(null);

    const { error } = await supabase.rpc('apply_numeric_cleaning_psa_to_namria', {
      in_dataset: datasetId,
    });

    if (error) {
      console.error('Error applying numeric cleaning:', error);
      setError(error.message);
      setApplying(false);
      return;
    }

    setApplying(false);
    onOpenChange(false);
    if (onCleaned) onCleaned();
  };

  const matchCounts = rows.reduce(
    (acc, row) => {
      const status = row.match_status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const previewRows = rows.slice(0, 100);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="max-h-[90vh] w-[95vw] max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Clean numeric dataset (PSA → NAMRIA ADM3)</h2>
          <button
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
            onClick={() => onOpenChange(false)}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-3 text-sm">
          <p className="text-gray-700">
            This preview shows how PSA ADM3 codes will be mapped to NAMRIA ADM3 boundaries using
            region / province / municipality code logic, then checked against{' '}
            <code>admin_boundaries</code>.
          </p>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs">
            <div className="rounded border bg-gray-50 px-3 py-2">
              <div className="font-semibold">Row counts by status</div>
              <div className="mt-1 space-y-0.5">
                <div>matched: {matchCounts['matched'] || 0}</div>
                <div>no_adm2_match: {matchCounts['no_adm2_match'] || 0}</div>
                <div>no_adm3_name_match: {matchCounts['no_adm3_name_match'] || 0}</div>
                {Object.entries(matchCounts)
                  .filter(
                    ([status]) =>
                      !['matched', 'no_adm2_match', 'no_adm3_name_match'].includes(status)
                  )
                  .map(([status, count]) => (
                    <div key={status}>
                      {status}: {count}
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded border bg-gray-50 px-3 py-2">
              <div className="font-semibold">Notes</div>
              <ul className="mt-1 list-disc pl-4">
                <li>
                  <code>adm2_pcode_psa_to_namria</code> is derived from region + province codes.
                </li>
                <li>
                  A row is <strong>matched</strong> only when an ADM3 child is found under the
                  matched ADM2 with the same municipality code.
                </li>
                <li>
                  Only <strong>matched</strong> rows will be inserted into{' '}
                  <code>dataset_values_numeric</code>.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-2 max-h-[50vh] overflow-auto rounded border text-xs">
            {loadingPreview ? (
              <div className="flex items-center justify-center px-4 py-6 text-gray-500">
                Loading preview…
              </div>
            ) : previewRows.length === 0 ? (
              <div className="flex items-center justify-center px-4 py-6 text-gray-500">
                No preview rows returned.
              </div>
            ) : (
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-1 text-left">admin_pcode_raw</th>
                    <th className="border px-2 py-1 text-left">admin_name_raw</th>
                    <th className="border px-2 py-1 text-left">value_raw</th>
                    <th className="border px-2 py-1 text-left">region</th>
                    <th className="border px-2 py-1 text-left">province</th>
                    <th className="border px-2 py-1 text-left">muni</th>
                    <th className="border px-2 py-1 text-left">adm1_pcode_psa_to_namria</th>
                    <th className="border px-2 py-1 text-left">adm2_pcode_psa_to_namria</th>
                    <th className="border px-2 py-1 text-left">adm2_pcode_match</th>
                    <th className="border px-2 py-1 text-left">adm2_name_match</th>
                    <th className="border px-2 py-1 text-left">admin_pcode_clean</th>
                    <th className="border px-2 py-1 text-left">admin_name_clean</th>
                    <th className="border px-2 py-1 text-left">match_status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="even:bg-gray-50">
                      <td className="border px-2 py-1">{row.admin_pcode_raw}</td>
                      <td className="border px-2 py-1">{row.admin_name_raw}</td>
                      <td className="border px-2 py-1">{row.value_raw}</td>
                      <td className="border px-2 py-1">{row.region_code}</td>
                      <td className="border px-2 py-1">{row.province_code}</td>
                      <td className="border px-2 py-1">{row.muni_code}</td>
                      <td className="border px-2 py-1">{row.adm1_pcode_psa_to_namria}</td>
                      <td className="border px-2 py-1">{row.adm2_pcode_psa_to_namria}</td>
                      <td className="border px-2 py-1">{row.adm2_pcode_match}</td>
                      <td className="border px-2 py-1">{row.adm2_name_match}</td>
                      <td className="border px-2 py-1">{row.admin_pcode_clean}</td>
                      <td className="border px-2 py-1">{row.admin_name_clean}</td>
                      <td className="border px-2 py-1">{row.match_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="text-xs text-gray-500">
            Only rows with <strong>match_status = 'matched'</strong> will be applied.
          </div>
          <div className="flex gap-2">
            <button
              className="rounded border px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => onOpenChange(false)}
              disabled={applying}
            >
              Cancel
            </button>
            <button
              className="rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              onClick={handleApply}
              disabled={applying || loadingPreview}
            >
              {applying ? 'Applying…' : 'Apply cleaning'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
