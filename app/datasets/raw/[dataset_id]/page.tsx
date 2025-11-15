'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Wand2 } from 'lucide-react';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

export default function DatasetRawPage({ params }: { params: { dataset_id: string } }) {
  const datasetId = params.dataset_id;
  const [dataset, setDataset] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState(false);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);

    const { data: ds, error: dsError } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (dsError) {
      console.error('Failed to load dataset metadata:', dsError);
      setLoading(false);
      return;
    }

    setDataset(ds);

    const table =
      ds.type === 'categorical'
        ? 'dataset_values_categorical_raw'
        : 'dataset_values_numeric_raw';

    const { data: values, error: valError } = await supabase
      .from(table)
      .select('*')
      .eq('dataset_id', datasetId)
      .limit(1000);

    if (valError) {
      console.error('Failed to load dataset values:', valError);
    }

    setRows(values || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading dataset…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800">{dataset?.name}</h1>
        <div className="flex gap-2">
          {dataset?.type === 'numeric' && (
            <button
              onClick={() => setShowNumericModal(true)}
              className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm font-medium"
            >
              <Wand2 size={16} /> Clean Dataset
            </button>
          )}
          {dataset?.type === 'categorical' && (
            <button
              onClick={() => setShowCategoricalModal(true)}
              className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm font-medium"
            >
              <Wand2 size={16} /> Clean Dataset
            </button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              {rows.length > 0 &&
                Object.keys(rows[0]).map((col) => (
                  <th key={col} className="px-3 py-2 text-left">
                    {col}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                {Object.values(row).map((val: any, j) => (
                  <td key={j} className="px-3 py-2 text-gray-700">
                    {val?.toString() || '–'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="text-center text-gray-500 py-6">No data found.</div>
        )}
      </div>

      {showNumericModal && (
        <CleanNumericDatasetModal
          datasetId={datasetId}
          datasetName={dataset?.name}
          onClose={() => setShowNumericModal(false)}
          onSaved={loadAll}
        />
      )}

      {showCategoricalModal && (
        <CleanCategoricalDatasetModal
          datasetId={datasetId}
          datasetName={dataset?.name}
          onClose={() => setShowCategoricalModal(false)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
