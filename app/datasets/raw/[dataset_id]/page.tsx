'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

export default function RawDatasetDetail({ params }: any) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // ---- Load dataset metadata ----
  useEffect(() => {
    const loadDataset = async () => {
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .eq('id', datasetId)
        .single();

      if (error) {
        console.error('Dataset load error:', error);
        return;
      }

      setDataset(data);
    };

    loadDataset();
  }, [datasetId]);

  // ---- Load raw values depending on type ----
  useEffect(() => {
    if (!dataset) return;

    const loadRawValues = async () => {
      setLoading(true);

      let table =
        dataset.type === 'numeric'
          ? 'dataset_values_numeric_raw'
          : 'dataset_values_categorical_raw';

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('dataset_id', datasetId)
        .limit(50);

      if (error) {
        console.error('Raw load error:', error);
        setRows([]);
        setColumns([]);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setRows([]);
        setColumns([]);
        setLoading(false);
        return;
      }

      const first = data[0];
      const cols = Object.keys(first);

      setRows(data);
      setColumns(cols);
      setLoading(false);
    };

    loadRawValues();
  }, [dataset]);

  const openClean = () => setModalOpen(true);
  const closeClean = () => setModalOpen(false);

  const refresh = async () => {
    setModalOpen(false);
    // reload preview after cleaning
    setRows([]);
    setColumns([]);
    const { data } = await supabase
      .from(
        dataset.type === 'numeric'
          ? 'dataset_values_numeric_raw'
          : 'dataset_values_categorical_raw'
      )
      .select('*')
      .eq('dataset_id', datasetId)
      .limit(50);

    if (data) {
      setRows(data);
      setColumns(data[0] ? Object.keys(data[0]) : []);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {dataset && (
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Raw Dataset</h1>
          <p className="text-gray-600 mt-1">
            {dataset.name} ({dataset.admin_level}) ·{' '}
            {dataset.type.toUpperCase()}
          </p>
        </div>
      )}

      {/* Clean button */}
      {dataset && (
        <div className="flex justify-end mb-4">
          <button
            onClick={openClean}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Clean Dataset
          </button>
        </div>
      )}

      {/* Preview */}
      <div className="border rounded bg-white overflow-x-auto">
        <div className="p-3 border-b font-semibold">Raw Values (Preview)</div>

        {loading ? (
          <p className="p-4 text-gray-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-gray-500">No raw rows found.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-2 py-1 border-b text-left">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t">
                  {columns.map((c) => (
                    <td key={c} className="px-2 py-1 border-b">
                      {typeof row[c] === 'object'
                        ? JSON.stringify(row[c])
                        : String(row[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CLEAN MODALS */}
      {modalOpen && dataset?.type === 'numeric' && (
        <CleanNumericDatasetModal
          datasetId={datasetId}
          onClose={closeClean}
          onCleaned={refresh}
        />
      )}

      {modalOpen && dataset?.type === 'categorical' && (
        <CleanCategoricalDatasetModal
          datasetId={datasetId}
          onClose={closeClean}
          onCleaned={refresh}
        />
      )}
    </div>
  );
}
