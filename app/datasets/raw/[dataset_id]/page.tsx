// app/datasets/raw/[dataset_id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
};

export default function RawDatasetDetail({ params }: any) {
  const router = useRouter();
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCleanModal, setShowCleanModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // ----------------------------
      // 1. Load dataset metadata
      // ----------------------------
      const { data: ds } = await supabase
        .from('datasets')
        .select('id, name, type, admin_level')
        .eq('id', datasetId)
        .single();

      setDataset(ds);

      // ----------------------------
      // 2. Load RAW rows depending on type
      // ----------------------------
      let rawTable =
        ds?.type === 'numeric'
          ? 'dataset_values_numeric_raw'
          : 'dataset_values_categorical_raw';

      const { data: rawRows } = await supabase
        .from(rawTable)
        .select('*')
        .eq('dataset_id', datasetId)
        .limit(50);

      setRows(rawRows || []);

      if (rawRows && rawRows.length > 0) {
        setColumns(Object.keys(rawRows[0]));
      }

      setLoading(false);
    };

    load();
  }, [datasetId]);

  // -----------------------------------
  // Render
  // -----------------------------------

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Raw Dataset Preview</h1>
        <Link
          href="/datasets/raw"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Raw Datasets
        </Link>
      </div>

      {loading && (
        <div className="text-gray-500 text-sm">Loading dataset…</div>
      )}

      {!loading && dataset && (
        <>
          {/* Dataset Metadata */}
          <div className="mb-6 rounded-lg border bg-gray-50 p-4">
            <div className="mb-2 text-lg font-medium">{dataset.name}</div>

            <div className="text-sm text-gray-600">
              <div>
                <span className="font-semibold">Type:</span>{' '}
                {dataset.type === 'numeric' ? 'Numeric' : 'Categorical'}
              </div>
              <div>
                <span className="font-semibold">Admin Level:</span>{' '}
                {dataset.admin_level}
              </div>
            </div>

            {/* CLEAN DATASET BUTTON */}
            {dataset.type === 'numeric' && (
              <div className="mt-4">
                <button
                  onClick={() => setShowCleanModal(true)}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Clean Dataset
                </button>
              </div>
            )}
          </div>

          {/* RAW DATA PREVIEW */}
          <div>
            <h2 className="mb-2 text-lg font-semibold">Raw Rows</h2>

            {rows.length === 0 ? (
              <div className="text-sm text-gray-500">
                No raw rows found for this dataset.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="px-3 py-2">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        {columns.map((col) => (
                          <td key={col} className="px-3 py-2">
                            {typeof row[col] === 'object'
                              ? JSON.stringify(row[col])
                              : row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* CLEANING MODAL */}
      {showCleanModal && dataset && dataset.type === 'numeric' && (
        <CleanNumericDatasetModal
          datasetId={dataset.id}
          datasetName={dataset.name}
          onClose={() => setShowCleanModal(false)}
          onCleaned={() => {
            setShowCleanModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
