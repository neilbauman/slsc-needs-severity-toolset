'use client';

import React, { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';

interface Dataset {
  id: string;
  name: string;
  description?: string;
  type: string;
  created_at?: string;
}

export default function RawDatasetPage({
  params,
}: {
  params: { dataset_id: string };
}) {
  const datasetId = params.dataset_id;
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<any[]>([]);
  const [showNumericModal, setShowNumericModal] = useState(false);

  const loadAll = async () => {
    setLoading(true);

    // Load dataset metadata
    const { data: ds, error: dsError } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (dsError) {
      console.error('Error loading dataset:', dsError);
      setDataset(null);
      setLoading(false);
      return;
    }

    setDataset(ds);

    // Load raw values depending on dataset type
    const table =
      ds.type === 'numeric'
        ? 'dataset_values_numeric_raw'
        : 'dataset_values_categorical_raw';

    const { data: vals, error: valError } = await supabase
      .from(table)
      .select('*')
      .eq('dataset_id', datasetId)
      .limit(100);

    if (valError) console.error('Error loading values:', valError);
    else setValues(vals || []);

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [datasetId]);

  if (loading) {
    return (
      <div className="p-6 text-gray-600 text-center">
        Loading dataset...
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="p-6 text-red-600 text-center">
        Failed to load dataset.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">
          Raw Data: {dataset.name}
        </h1>
        {dataset.type === 'numeric' && (
          <button
            onClick={() => setShowNumericModal(true)}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Clean Data
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-2">
        <p>
          <strong>Description:</strong>{' '}
          {dataset.description || 'No description'}
        </p>
        <p>
          <strong>Type:</strong> {dataset.type}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Raw Values</h2>
        {values.length > 0 ? (
          <div className="overflow-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  {Object.keys(values[0]).map((key) => (
                    <th key={key} className="px-3 py-2 border-b">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {values.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="px-3 py-2 border-b">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No values found.</p>
        )}
      </div>

      {showNumericModal && (
        <CleanNumericDatasetModal
          dataset={dataset}
          onClose={() => setShowNumericModal(false)}
          onCleaned={loadAll}
        />
      )}
    </div>
  );
}
