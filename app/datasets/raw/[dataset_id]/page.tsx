'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';

interface Dataset {
  id: string;
  name: string;
  admin_level: string;
  is_cleaned: boolean;
  is_derived: boolean;
  created_at: string;
  description?: string;
}

interface DatasetValue {
  admin_pcode: string;
  admin_name: string;
  value: number;
}

export default function DatasetRawPage() {
  const params = useParams();
  const datasetId = params?.dataset_id as string;

  const supabase = createClient();

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [values, setValues] = useState<DatasetValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState(false);

  // 🧠 Load dataset and its data
  useEffect(() => {
    if (datasetId) {
      loadAll();
    }
  }, [datasetId]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([fetchDataset(), fetchValues()]);
    setLoading(false);
  }

  async function fetchDataset() {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (error) {
      console.error('Error loading dataset metadata:', error);
      return;
    }

    setDataset(data);
  }

  async function fetchValues() {
    const { data, error } = await supabase
      .from('dataset_values_numeric_raw')
      .select('admin_pcode_raw, admin_name_raw, value_raw')
      .eq('dataset_id', datasetId)
      .limit(1000);

    if (error) {
      console.error('Error loading dataset values:', error);
      return;
    }

    if (!data) return;

    // Rename to match display convention
    const formatted = data.map((d) => ({
      admin_pcode: d.admin_pcode_raw,
      admin_name: d.admin_name_raw,
      value: d.value_raw,
    }));

    setValues(formatted);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          Raw Dataset: {dataset?.name ?? 'Loading...'}
        </h1>

        {!dataset?.is_cleaned && (
          <button
            onClick={() => setShowNumericModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Clean Dataset
          </button>
        )}
      </div>

      {/* Metadata */}
      {dataset && (
        <div className="bg-white shadow-sm rounded-xl p-4 border">
          <p><strong>Admin Level:</strong> {dataset.admin_level}</p>
          <p><strong>Created At:</strong> {new Date(dataset.created_at).toLocaleString()}</p>
          <p><strong>Derived:</strong> {dataset.is_derived ? 'Yes' : 'No'}</p>
          <p><strong>Cleaned:</strong> {dataset.is_cleaned ? '✅ Yes' : '❌ No'}</p>
          {dataset.description && <p><strong>Description:</strong> {dataset.description}</p>}
        </div>
      )}

      {/* Data Preview */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h2 className="text-lg font-semibold mb-3">Raw Data Preview</h2>

        {loading ? (
          <p>Loading dataset values...</p>
        ) : values.length === 0 ? (
          <p>No data found for this dataset.</p>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border p-2 text-left">Admin PCode (Raw)</th>
                  <th className="border p-2 text-left">Admin Name (Raw)</th>
                  <th className="border p-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {values.map((v, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border p-2">{v.admin_pcode}</td>
                    <td className="border p-2">{v.admin_name}</td>
                    <td className="border p-2 text-right">{v.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cleaning Modal */}
      <CleanNumericDatasetModal
        datasetId={datasetId}
        datasetName={dataset?.name ?? ''}
        open={showNumericModal}
        onOpenChange={setShowNumericModal}
        onCleaned={loadAll}
      />
    </div>
  );
}
