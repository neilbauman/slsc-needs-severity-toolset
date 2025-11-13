'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';
import UploadDatasetModal from '@/components/UploadDatasetModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
};

export default function RawDatasetDetailPage({ params }: any) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCleanNumeric, setShowCleanNumeric] = useState(false);
  const [showCleanCategorical, setShowCleanCategorical] = useState(false);

  // ───────────────────────────────────────────────
  // Load dataset metadata
  // ───────────────────────────────────────────────
  const loadDataset = async () => {
    setLoading(true);

    const { data: ds, error: dsErr } = await supabase
      .from('datasets')
      .select('id, name, type, admin_level')
      .eq('id', datasetId)
      .single();

    if (dsErr) {
      console.error(dsErr);
      setDataset(null);
      setLoading(false);
      return;
    }

    setDataset(ds);

    // Now load raw values based on type
    if (ds.type === 'numeric') {
      await loadNumericRaw(ds.id);
    } else {
      await loadCategoricalRaw(ds.id);
    }

    setLoading(false);
  };

  // ───────────────────────────────────────────────
  // Load numeric raw values
  // ───────────────────────────────────────────────
  const loadNumericRaw = async (id: string) => {
    const { data, error } = await supabase
      .from('dataset_values_numeric_raw')
      .select('*')
      .eq('dataset_id', id)
      .limit(50);

    if (error) {
      console.error('numeric raw load error:', error);
      setRawRows([]);
      setColumns([]);
      return;
    }

    if (data && data.length > 0) {
      setRawRows(data);
      setColumns(Object.keys(data[0]));
    } else {
      setRawRows([]);
      setColumns([]);
    }
  };

  // ───────────────────────────────────────────────
  // Load categorical raw values
  // ───────────────────────────────────────────────
  const loadCategoricalRaw = async (id: string) => {
    const { data, error } = await supabase
      .from('dataset_values_categorical_raw')
      .select('*')
      .eq('dataset_id', id)
      .limit(50);

    if (error) {
      console.error('categorical raw load error:', error);
      setRawRows([]);
      setColumns([]);
      return;
    }

    if (data && data.length > 0) {
      setRawRows(data);
      setColumns(Object.keys(data[0]));
    } else {
      setRawRows([]);
      setColumns([]);
    }
  };

  useEffect(() => {
    loadDataset();
  }, [datasetId]);

  // Reload after cleaning
  const refresh = async () => {
    await loadDataset();
  };

  if (loading || !dataset) {
    return (
      <div className="p-6 text-gray-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Raw Dataset</h1>
          <p className="text-gray-700 mt-1">
            {dataset.name} ({dataset.admin_level.toLowerCase()}) ·{' '}
            {dataset.type.toUpperCase()}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          >
            Upload Dataset
          </button>

          {/* CLEAN */}
          {dataset.type === 'numeric' ? (
            <button
              onClick={() => setShowCleanNumeric(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Clean Dataset
            </button>
          ) : (
            <button
              onClick={() => setShowCleanCategorical(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Clean Dataset
            </button>
          )}
        </div>
      </div>

      {/* Raw Table */}
      <div className="border rounded p-3">
        <h2 className="text-lg font-semibold mb-2">Raw Values (Preview)</h2>

        {rawRows.length === 0 ? (
          <p className="text-gray-500">No raw rows found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  {columns.map((c) => (
                    <th
                      key={c}
                      className="border px-2 py-1 text-left text-gray-700"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawRows.map((row, i) => (
                  <tr key={i} className="border-b">
                    {columns.map((c) => (
                      <td key={c} className="border px-2 py-1">
                        {String(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NUMERIC CLEAN MODAL */}
      {showCleanNumeric && (
        <CleanNumericDatasetModal
          open={showCleanNumeric}
          onOpenChange={setShowCleanNumeric}
          datasetId={dataset.id}
          datasetName={dataset.name}
          onCleaned={refresh}
        />
      )}

      {/* CATEGORICAL CLEAN MODAL */}
      {showCleanCategorical && (
        <CleanCategoricalDatasetModal
          open={showCleanCategorical}
          onOpenChange={setShowCleanCategorical}
          datasetId={dataset.id}
          datasetName={dataset.name}
          onCleaned={refresh}
        />
      )}

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <UploadDatasetModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={refresh}
        />
      )}
    </div>
  );
}
