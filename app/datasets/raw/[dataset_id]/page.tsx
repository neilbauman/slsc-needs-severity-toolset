'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

type Dataset = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  type: 'numeric' | 'categorical' | string;
  admin_level: string | null;
};

type RawNumericRow = {
  id: string;
  dataset_id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  value_raw: string | null;
  is_percentage?: boolean | null;
  raw_row?: any;
};

type RawCategoricalRow = {
  id: string;
  dataset_id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  shape?: string | null;
  raw_row?: any;
};

type Props = {
  params: { dataset_id: string };
};

export default function RawDatasetPage({ params }: Props) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCleanNumeric, setShowCleanNumeric] = useState(false);
  const [showCleanCategorical, setShowCleanCategorical] = useState(false);

  const isNumeric = dataset?.type === 'numeric';
  const isCategorical = dataset?.type === 'categorical';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: ds, error: dsError } = await supabase
        .from('datasets')
        .select('*')
        .eq('id', datasetId)
        .single();

      if (dsError) {
        console.error('dataset load error', dsError);
        setError(dsError.message ?? 'Failed to load dataset.');
        setDataset(null);
        setRawRows([]);
        return;
      }

      setDataset(ds as Dataset);

      if ((ds as Dataset).type === 'numeric') {
        const { data: rows, error: rowsError } = await supabase
          .from('dataset_values_numeric_raw')
          .select('*')
          .eq('dataset_id', datasetId)
          .limit(200);

        if (rowsError) {
          console.error('numeric raw load error', rowsError);
          setError(rowsError.message ?? 'Failed to load raw numeric rows.');
          setRawRows([]);
          return;
        }

        setRawRows((rows || []) as RawNumericRow[]);
      } else if ((ds as Dataset).type === 'categorical') {
        const { data: rows, error: rowsError } = await supabase
          .from('dataset_values_categorical_raw')
          .select('*')
          .eq('dataset_id', datasetId)
          .limit(200);

        if (rowsError) {
          console.error('categorical raw load error', rowsError);
          setError(
            rowsError.message ?? 'Failed to load raw categorical rows.'
          );
          setRawRows([]);
          return;
        }

        setRawRows((rows || []) as RawCategoricalRow[]);
      } else {
        setRawRows([]);
      }
    } catch (err: any) {
      console.error('raw dataset load unexpected error', err);
      setError(err.message ?? 'Failed to load dataset.');
      setDataset(null);
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  const columns = rawRows.length
    ? Object.keys(rawRows[0]).filter(
        (k) =>
          k !== 'dataset_id' &&
          k !== 'id' &&
          k !== 'created_at' &&
          k !== 'updated_at'
      )
    : [];

  const title = dataset ? dataset.name : 'Raw Dataset';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {dataset?.description && (
            <p className="mt-1 text-sm text-gray-600">
              {dataset.description}
            </p>
          )}
          {dataset && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded bg-gray-100 px-2 py-0.5">
                Type:{' '}
                <span className="font-semibold">{dataset.type ?? '—'}</span>
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5">
                Category:{' '}
                <span className="font-semibold">
                  {dataset.category ?? '—'}
                </span>
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5">
                Admin level:{' '}
                <span className="font-semibold">
                  {dataset.admin_level ?? '—'}
                </span>
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5">
                Raw rows shown:{' '}
                <span className="font-semibold">{rawRows.length}</span>{' '}
                <span className="text-[0.7rem] text-gray-500">
                  (preview limited)
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>

          {isNumeric && (
            <button
              onClick={() => setShowCleanNumeric(true)}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={loading || rawRows.length === 0}
            >
              Clean numeric dataset
            </button>
          )}
          {isCategorical && (
            <button
              onClick={() => setShowCleanCategorical(true)}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={loading || rawRows.length === 0}
            >
              Clean categorical dataset
            </button>
          )}
        </div>
      </div>

      {/* Notice */}
      <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
        <p className="font-semibold">Raw staging view</p>
        <p className="mt-1">
          This page shows the <span className="font-semibold">raw</span> rows
          as uploaded into{' '}
          {isNumeric ? (
            <code className="rounded bg-gray-100 px-1 text-[0.7rem]">
              dataset_values_numeric_raw
            </code>
          ) : isCategorical ? (
            <code className="rounded bg-gray-100 px-1 text-[0.7rem]">
              dataset_values_categorical_raw
            </code>
          ) : (
            <code className="rounded bg-gray-100 px-1 text-[0.7rem]">
              (unknown raw table)
            </code>
          )}
          . Cleaning writes to the corresponding cleaned table and{' '}
          <span className="font-semibold">does not modify</span> this raw
          staging data.
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Raw rows table */}
      <div className="rounded border bg-white">
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-gray-600">
          <span className="font-semibold">Raw rows preview</span>
          <span>
            Showing up to <span className="font-semibold">200</span> rows for
            this dataset.
          </span>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-100 text-[0.7rem] text-gray-700">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="border-b px-2 py-1 text-left">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={columns.length || 1}
                    className="px-3 py-4 text-center text-xs text-gray-500"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rawRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length || 1}
                    className="px-3 py-4 text-center text-xs text-gray-500"
                  >
                    No raw rows found for this dataset.
                  </td>
                </tr>
              )}
              {!loading &&
                rawRows.map((row, idx) => (
                  <tr key={row.id ?? idx} className="odd:bg-white even:bg-gray-50">
                    {columns.map((col) => {
                      const value = (row as any)[col];
                      if (col === 'raw_row') {
                        const text = JSON.stringify(value ?? {});
                        return (
                          <td key={col} className="border-b px-2 py-1">
                            <span className="font-mono text-[0.65rem]">
                              {text.length > 100
                                ? text.slice(0, 100) + '…'
                                : text}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={col} className="border-b px-2 py-1">
                          {value === null || value === undefined || value === ''
                            ? '—'
                            : String(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {dataset && (
        <>
          <CleanNumericDatasetModal
            open={showCleanNumeric}
            onOpenChange={setShowCleanNumeric}
            datasetId={dataset.id}
            datasetName={dataset.name}
            onCleaned={load}
          />
          <CleanCategoricalDatasetModal
            open={showCleanCategorical}
            onOpenChange={setShowCleanCategorical}
            datasetId={dataset.id}
            datasetName={dataset.name}
            onCleaned={load}
          />
        </>
      )}
    </div>
  );
}
