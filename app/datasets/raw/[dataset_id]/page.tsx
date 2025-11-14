'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

interface RawDatasetPageProps {
  params: { dataset_id: string };
}

interface DatasetRow {
  id: string;
  name: string;
  description: string | null;
  type: 'numeric' | 'categorical';
  admin_level: 'ADM1' | 'ADM2' | 'ADM3' | 'ADM4';
  category: string | null;
}

interface NumericSummary {
  total: number;
  matched: number;
  noAdm2: number;
  noAdm3: number;
}

interface CategoricalSummary {
  total: number;
  matched: number;
  noAdm2: number;
  noAdm3: number;
}

export default function RawDatasetPage({ params }: RawDatasetPageProps) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<DatasetRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [rawRows, setRawRows] = useState<any[]>([]);
  const [rawColumns, setRawColumns] = useState<string[]>([]);

  const [numericSummary, setNumericSummary] = useState<NumericSummary | null>(
    null
  );
  const [categoricalSummary, setCategoricalSummary] =
    useState<CategoricalSummary | null>(null);

  const [showNumericModal, setShowNumericModal] = useState(false);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);

  useEffect(() => {
    void loadAll();
  }, [datasetId]);

  async function loadAll() {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1) Dataset metadata
      const { data: ds, error: dsError } = await supabase
        .from('datasets')
        .select('*')
        .eq('id', datasetId)
        .single();

      if (dsError) {
        console.error('load dataset error', dsError);
        setErrorMsg(dsError.message || 'Failed to load dataset metadata.');
        setDataset(null);
        setRawRows([]);
        setRawColumns([]);
        setNumericSummary(null);
        setCategoricalSummary(null);
        return;
      }

      const datasetRow = ds as DatasetRow;
      setDataset(datasetRow);

      // 2) Raw rows (small preview)
      const rawTable =
        datasetRow.type === 'numeric'
          ? 'dataset_values_numeric_raw'
          : 'dataset_values_categorical_raw';

      const { data: raw, error: rawError } = await supabase
        .from(rawTable)
        .select('*')
        .eq('dataset_id', datasetId)
        .limit(200);

      if (rawError) {
        console.error('load raw error', rawError);
        setErrorMsg(rawError.message || 'Failed to load raw rows.');
        setRawRows([]);
        setRawColumns([]);
      } else {
        const rows = (raw || []) as any[];
        setRawRows(rows);

        if (rows.length > 0) {
          const first = rows[0] as any;
          const baseCols = new Set<string>();

          // Always show these if present
          if ('admin_pcode_raw' in first) baseCols.add('admin_pcode_raw');
          if ('admin_name_raw' in first) baseCols.add('admin_name_raw');
          if ('value_raw' in first) baseCols.add('value_raw');
          if ('category' in first) baseCols.add('category');

          // Expand raw_row JSON keys (original CSV headings)
          if ('raw_row' in first && first.raw_row) {
            Object.keys(first.raw_row).forEach((k) => baseCols.add(k));
          }

          setRawColumns(Array.from(baseCols));
        } else {
          setRawColumns([]);
        }
      }

      // 3) Summary previews (lightweight analytics)
      if (datasetRow.type === 'numeric') {
        await loadNumericSummary(datasetId);
        setCategoricalSummary(null);
      } else {
        await loadCategoricalSummary(datasetId);
        setNumericSummary(null);
      }
    } catch (err: any) {
      console.error('loadAll exception', err);
      setErrorMsg(err.message || 'Failed to load dataset.');
      setDataset(null);
      setRawRows([]);
      setRawColumns([]);
      setNumericSummary(null);
      setCategoricalSummary(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadNumericSummary(id: string) {
    try {
      const { data, error } = await supabase.rpc('preview_numeric_cleaning_v2', {
        in_dataset: id,
      });
      if (error) {
        console.error('preview_numeric_cleaning_v2 summary error', error);
        setNumericSummary(null);
        return;
      }
      const rows = (data || []) as { match_status: string | null }[];
      const total = rows.length;
      const matched = rows.filter((r) => r.match_status === 'matched').length;
      const noAdm2 = rows.filter(
        (r) => r.match_status === 'no_adm2_match'
      ).length;
      const noAdm3 = rows.filter(
        (r) => r.match_status === 'no_adm3_name_match'
      ).length;
      setNumericSummary({ total, matched, noAdm2, noAdm3 });
    } catch (err) {
      console.error('loadNumericSummary exception', err);
      setNumericSummary(null);
    }
  }

  async function loadCategoricalSummary(id: string) {
    try {
      const { data, error } = await supabase.rpc('preview_categorical_cleaning', {
        in_dataset_id: id,
        in_wide_format: true,
      });
      if (error) {
        console.error('preview_categorical_cleaning summary error', error);
        setCategoricalSummary(null);
        return;
      }
      const rows = (data || []) as { match_status: string | null }[];
      const total = rows.length;
      const matched = rows.filter((r) => r.match_status === 'matched').length;
      const noAdm2 = rows.filter(
        (r) => r.match_status === 'no_adm2_match'
      ).length;
      const noAdm3 = rows.filter(
        (r) => r.match_status === 'no_adm3_name_match'
      ).length;
      setCategoricalSummary({ total, matched, noAdm2, noAdm3 });
    } catch (err) {
      console.error('loadCategoricalSummary exception', err);
      setCategoricalSummary(null);
    }
  }

  const isNumeric = dataset?.type === 'numeric';
  const isCategorical = dataset?.type === 'categorical';

  const rawPreviewRows = useMemo(() => rawRows.slice(0, 50), [rawRows]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Raw Dataset: {dataset?.name ?? datasetId}
          </h1>
          {dataset && (
            <p className="text-xs text-gray-500">
              {dataset.category ? `${dataset.category} · ` : ''}
              {dataset.admin_level} · {dataset.type}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isNumeric && (
            <button
              className="btn btn-primary"
              onClick={() => setShowNumericModal(true)}
              disabled={!dataset}
            >
              Clean numeric dataset
            </button>
          )}
          {isCategorical && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCategoricalModal(true)}
              disabled={!dataset}
            >
              Clean categorical dataset
            </button>
          )}
        </div>
      </div>

      {/* Summary panel */}
      <div className="card p-3 text-sm">
        <h2 className="font-semibold text-gray-800 mb-2 text-sm">
          Cleaning summary preview
        </h2>

        {loading && <p className="text-xs text-gray-500">Loading…</p>}

        {!loading && !dataset && (
          <p className="text-xs text-red-600">
            {errorMsg || 'Dataset could not be loaded.'}
          </p>
        )}

        {!loading && dataset && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {isNumeric && numericSummary && (
              <div className="border rounded-lg p-2">
                <h3 className="font-semibold text-gray-800 text-xs mb-1">
                  Numeric match quality
                </h3>
                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <div className="text-gray-500">Total</div>
                    <div className="font-semibold">
                      {numericSummary.total.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Matched</div>
                    <div className="font-semibold text-green-700">
                      {numericSummary.matched.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">No ADM2</div>
                    <div className="font-semibold text-red-700">
                      {numericSummary.noAdm2.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">No ADM3 name</div>
                    <div className="font-semibold text-orange-700">
                      {numericSummary.noAdm3.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isCategorical && categoricalSummary && (
              <div className="border rounded-lg p-2">
                <h3 className="font-semibold text-gray-800 text-xs mb-1">
                  Categorical match quality
                </h3>
                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <div className="text-gray-500">Total</div>
                    <div className="font-semibold">
                      {categoricalSummary.total.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Matched</div>
                    <div className="font-semibold text-green-700">
                      {categoricalSummary.matched.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">No ADM2</div>
                    <div className="font-semibold text-red-700">
                      {categoricalSummary.noAdm2.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">No ADM3 name</div>
                    <div className="font-semibold text-orange-700">
                      {categoricalSummary.noAdm3.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {((isNumeric && !numericSummary) ||
              (isCategorical && !categoricalSummary)) && (
              <p className="text-xs text-gray-500 col-span-full">
                No summary data available. Try opening the cleaning modal to see
                details; if that fails, there may be an RPC error.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Raw preview */}
      <div className="card p-3 text-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-800 text-sm">
            Raw uploaded rows
          </h2>
          <p className="text-[11px] text-gray-500">
            Showing first {rawPreviewRows.length.toLocaleString()} rows
          </p>
        </div>
        <div className="overflow-x-auto max-h-[400px] border rounded">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-100">
              <tr>
                {rawColumns.map((c) => (
                  <th key={c} className="px-2 py-1 border-b text-left">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rawPreviewRows.map((row, idx) => (
                <tr key={idx} className="border-t">
                  {rawColumns.map((col) => {
                    if (col === 'admin_pcode_raw' || col === 'admin_name_raw' || col === 'value_raw' || col === 'category') {
                      return (
                        <td key={col} className="px-2 py-1 border-b">
                          {row[col] != null ? String(row[col]) : ''}
                        </td>
                      );
                    }
                    // Assume from raw_row JSON
                    const rawRow = row.raw_row || {};
                    return (
                      <td key={col} className="px-2 py-1 border-b">
                        {rawRow[col] != null ? String(rawRow[col]) : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rawPreviewRows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={Math.max(rawColumns.length, 1)}
                    className="px-2 py-2 text-center text-gray-500"
                  >
                    No raw rows found for this dataset.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={Math.max(rawColumns.length, 1)}
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

      {/* Modals */}
      {dataset && (
        <>
          <CleanNumericDatasetModal
            datasetId={datasetId}
            datasetName={dataset.name}
            open={showNumericModal}
            onOpenChange={setShowNumericModal}
            onCleaned={loadAll}
          />
          <CleanCategoricalDatasetModal
            datasetId={datasetId}
            datasetName={dataset.name}
            open={showCategoricalModal}
            onOpenChange={setShowCategoricalModal}
            onCleaned={loadAll}
          />
        </>
      )}
    </div>
  );
}
