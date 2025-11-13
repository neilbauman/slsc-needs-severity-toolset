// app/datasets/raw/[dataset_id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical' | string;
  admin_level: string | null;
  is_cleaned: boolean | null;
};

type RawNumericRow = {
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  value_raw: string | null;
};

export default function RawDatasetDetail({ params }: { params: { dataset_id: string } }) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [rows, setRows] = useState<RawNumericRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cleanModalOpen, setCleanModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    // 1) Dataset metadata
    const { data: ds, error: dsError } = await supabase
      .from('datasets')
      .select('id, name, type, admin_level, is_cleaned')
      .eq('id', datasetId)
      .single();

    if (dsError) {
      console.error('Error loading dataset:', dsError);
      setError(dsError.message);
      setDataset(null);
      setRows([]);
      setColumns([]);
      setLoading(false);
      return;
    }

    setDataset(ds as Dataset);

    // 2) Raw rows (numeric only for now)
    if (ds.type === 'numeric') {
      const { data: rawRows, error: rawError } = await supabase
        .from('dataset_values_numeric_raw')
        .select('admin_pcode_raw, admin_name_raw, value_raw')
        .eq('dataset_id', datasetId)
        .limit(500);

      if (rawError) {
        console.error('Error loading raw numeric rows:', rawError);
        setError(rawError.message);
        setRows([]);
        setColumns([]);
      } else {
        const cols = ['admin_pcode_raw', 'admin_name_raw', 'value_raw'];
        setRows((rawRows || []) as RawNumericRow[]);
        setColumns(cols);
      }
    } else {
      // For now, just show a message for non-numeric datasets
      setRows([]);
      setColumns([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  const handleCleaned = () => {
    load();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            Raw dataset: {dataset ? dataset.name : 'Loading…'}
          </h1>
          {dataset && (
            <div className="mt-1 text-sm text-gray-600">
              Type: <span className="font-mono">{dataset.type}</span>{' '}
              {dataset.admin_level && (
                <>
                  · Admin level: <span className="font-mono">{dataset.admin_level}</span>
                </>
              )}{' '}
              · Cleaned:{' '}
              <span className="font-mono">
                {dataset.is_cleaned ? 'yes' : 'no'}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/datasets"
            className="rounded border px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
          >
            ← Back to datasets
          </Link>

          {dataset?.type === 'numeric' && (
            <button
              className="rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              onClick={() => setCleanModalOpen(true)}
            >
              Clean numeric dataset (PSA → NAMRIA ADM3)
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-sm text-gray-500">Loading…</div>
      ) : dataset?.type !== 'numeric' ? (
        <div className="mt-6 rounded border bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          Raw view for non-numeric datasets is not yet implemented on this page.
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6 text-sm text-gray-500">No raw rows found for this dataset.</div>
      ) : (
        <div className="mt-4 max-h-[60vh] overflow-auto rounded border text-sm">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="border px-2 py-1 text-left font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border px-2 py-1">{row.admin_pcode_raw}</td>
                  <td className="border px-2 py-1">{row.admin_name_raw}</td>
                  <td className="border px-2 py-1">{row.value_raw}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CleanNumericDatasetModal
        datasetId={datasetId}
        open={cleanModalOpen}
        onOpenChange={setCleanModalOpen}
        onCleaned={handleCleaned}
      />
    </div>
  );
}
