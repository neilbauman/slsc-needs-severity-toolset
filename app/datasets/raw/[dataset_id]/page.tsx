'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import { Eye, ArrowLeft, RefreshCcw } from 'lucide-react';

interface Dataset {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  is_cleaned: boolean;
  admin_level: string;
  created_at: string;
}

export default function DatasetRawPage() {
  const params = useParams();
  const datasetId = params?.dataset_id as string;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ────────────────────────────────────────────────
  // Load dataset metadata
  // ────────────────────────────────────────────────
  const loadDataset = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (error) console.error('Error loading dataset:', error);
    else setDataset(data);

    setLoading(false);
  };

  // ────────────────────────────────────────────────
  // Load raw values for preview
  // ────────────────────────────────────────────────
  const loadRawData = async () => {
    if (!datasetId) return;

    setRefreshing(true);
    try {
      const table =
        dataset?.type === 'categorical'
          ? 'dataset_values_categorical_raw'
          : 'dataset_values_numeric_raw';

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('dataset_id', datasetId)
        .limit(1000);

      if (error) console.error('Error loading raw data:', error);
      else setRawData(data ?? []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDataset();
  }, [datasetId]);

  useEffect(() => {
    if (dataset) loadRawData();
  }, [dataset]);

  // ────────────────────────────────────────────────
  // Handle post-clean refresh
  // ────────────────────────────────────────────────
  const handleCleaned = async () => {
    await loadDataset();
    await loadRawData();
  };

  // ────────────────────────────────────────────────
  // UI Rendering
  // ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 text-gray-600">
        <p>Loading dataset details...</p>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="p-6 text-gray-600">
        <p>Dataset not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <button
            onClick={() => (window.location.href = '/datasets')}
            className="flex items-center text-sm text-gray-600 hover:text-[var(--ssc-blue)] mb-2"
          >
            <ArrowLeft size={16} className="mr-1" /> Back to Datasets
          </button>
          <h1 className="text-xl font-semibold text-gray-800">
            {dataset.name}
          </h1>
          <p className="text-gray-500 text-sm">
            {dataset.type.charAt(0).toUpperCase() + dataset.type.slice(1)} data
            {' · '}
            {dataset.is_cleaned ? (
              <span className="text-green-700 font-medium">Cleaned</span>
            ) : (
              <span className="text-red-700 font-medium">Raw</span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadRawData}
            disabled={refreshing}
            className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm font-medium"
          >
            <RefreshCcw
              size={16}
              className={refreshing ? 'animate-spin text-[var(--ssc-blue)]' : ''}
            />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          {!dataset.is_cleaned && dataset.type === 'numeric' && (
            <button
              onClick={() => setShowNumericModal(true)}
              className="flex items-center gap-1 px-3 py-2 bg-[var(--ssc-blue)] text-white rounded hover:bg-blue-800 text-sm font-medium"
            >
              Clean Dataset
            </button>
          )}
        </div>
      </div>

      {/* Cleaning Modal */}
      {showNumericModal && (
  <CleanNumericDatasetModal
    datasetId={datasetId}
    datasetName={dataset?.name || ""}
    onClose={() => setShowNumericModal(false)}
    onCleaned={handleCleaned}
  />
)}
      {/* Data Preview */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              {rawData.length > 0 &&
                Object.keys(rawData[0]).map((col) => (
                  <th key={col} className="px-3 py-2 text-left">
                    {col}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rawData.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-4 text-center text-gray-500 italic"
                >
                  No raw data found for this dataset.
                </td>
              </tr>
            ) : (
              rawData.map((row, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="px-3 py-2 text-gray-800 truncate">
                      {val === null || val === '' ? '–' : String(val)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400 text-right">
        Showing up to 1000 rows of raw data
      </div>
    </div>
  );
}
