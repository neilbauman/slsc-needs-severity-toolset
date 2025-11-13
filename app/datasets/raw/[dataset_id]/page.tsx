'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
  is_cleaned: boolean;
};

export default function RawDatasetDetail({ params }: any) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);

  // Load dataset metadata + preview of raw rows
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Load dataset metadata
      const { data: ds, error: dsError } = await supabase
        .from('datasets')
        .select('*')
        .eq('id', datasetId)
        .single();

      if (dsError) {
        console.error(dsError);
        setLoading(false);
        return;
      }

      setDataset(ds);

      // Load first 20 raw rows for preview
      const rawTable =
        ds.type === 'numeric'
          ? 'dataset_values_numeric_raw'
          : 'dataset_values_categorical_raw';

      const { data: rawRows, error: rawError } = await supabase
        .from(rawTable)
        .select('*')
        .eq('dataset_id', datasetId)
        .limit(20);

      if (rawError) {
        console.error(rawError);
        setLoading(false);
        return;
      }

      setRows(rawRows);
      if (rawRows.length > 0) {
        setColumns(Object.keys(rawRows[0]));
      }

      setLoading(false);
    };

    load();
  }, [datasetId]);

  const handleCleaned = () => {
    // When cleaning completes, refresh metadata
    setModalOpen(false);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading dataset…</p>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="p-6">
        <p>Dataset not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">{dataset.name}</h1>
          <div className="text-gray-600 text-sm">
            Raw dataset ({dataset.type}, {dataset.admin_level})
          </div>
        </div>

        {/* Clean button (only for numeric) */}
        {dataset.type === 'numeric' && (
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Clean numeric dataset
          </button>
        )}
      </div>

      {/* Table preview */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 text-left">
                  {c}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1 whitespace-nowrap">
                    {row[col] === null ? '—' : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <CleanNumericDatasetModal
          datasetId={dataset.id}
          datasetName={dataset.name}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
