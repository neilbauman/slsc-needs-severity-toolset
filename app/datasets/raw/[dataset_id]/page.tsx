'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
};

export default function RawDatasetDetailPage({ params }: any) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNumericModal, setShowNumericModal] = useState(false);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);

  const load = async () => {
    setLoading(true);

    // Load dataset metadata
    const { data: ds, error: dsErr } = await supabase
      .from('datasets')
      .select('id, name, type, admin_level')
      .eq('id', datasetId)
      .single();

    if (dsErr) {
      console.error('Failed to load dataset:', dsErr);
      setLoading(false);
      return;
    }

    setDataset(ds);

    // Load preview rows from correct RAW table
    let rawTable =
      ds.type === 'numeric'
        ? 'dataset_values_numeric_raw'
        : 'dataset_values_categorical_raw';

    const { data: rawRows, error: rawErr } = await supabase
      .from(rawTable)
      .select('*')
      .eq('dataset_id', datasetId)
      .limit(20);

    if (rawErr) {
      console.error(rawErr);
      setRows([]);
      setColumns([]);
      setLoading(false);
      return;
    }

    setRows(rawRows || []);
    setColumns(rawRows?.length ? Object.keys(rawRows[0]) : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [datasetId]);

  const openCleanModal = () => {
    if (!dataset) return;

    if (dataset.type === 'numeric') {
      setShowNumericModal(true);
    } else {
      setShowCategoricalModal(true);
    }
  };

  return (
    <div className="p-6">
      {showNumericModal && dataset && (
        <CleanNumericDatasetModal
          datasetId={dataset.id}
          datasetName={dataset.name}
          onClose={() => setShowNumericModal(false)}
          onCleaned={load}
        />
      )}

      {showCategoricalModal && dataset && (
        <CleanCategoricalDatasetModal
          datasetId={dataset.id}
          datasetName={dataset.name}
          onClose={() => setShowCategoricalModal(false)}
          onCleaned={load}
        />
      )}

      <h1 className="text-3xl font-bold mb-2">Raw Dataset</h1>

      {dataset && (
        <div className="text-gray-700 mb-4">
          {dataset.name} ({dataset.admin_level.toLowerCase()}) ·{' '}
          {dataset.type.toUpperCase()}
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={openCleanModal}
        >
          Clean Dataset
        </button>
      </div>

      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : columns.length === 0 ? (
        <p className="text-gray-500 italic">No raw rows found.</p>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-2 py-1 border-b text-left">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {columns.map((c) => (
                    <td key={c} className="px-2 py-1 border-b whitespace-nowrap">
                      {String(r[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
