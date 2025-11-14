'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

type DatasetType = 'numeric' | 'categorical';

type Dataset = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  type: DatasetType;
  admin_level: 'ADM1' | 'ADM2' | 'ADM3' | 'ADM4';
  created_at: string;
};

export default function RawDatasetPage() {
  const params = useParams();
  const router = useRouter();
  const datasetId = (params?.dataset_id as string) ?? '';

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [showCleanNumeric, setShowCleanNumeric] = useState(false);
  const [showCleanCategorical, setShowCleanCategorical] = useState(false);

  // Fetch dataset metadata
  useEffect(() => {
    if (!datasetId) return;

    const fetchMeta = async () => {
      setLoadingMeta(true);
      setMetaError(null);
      try {
        const { data, error } = await supabase
          .from('datasets')
          .select('*')
          .eq('id', datasetId)
          .single();

        if (error) {
          console.error('Error loading dataset:', error);
          setMetaError('Failed to load dataset metadata.');
        } else {
          setDataset(data as Dataset);
        }
      } catch (err: any) {
        console.error('Unexpected error loading dataset:', err);
        setMetaError(err.message || 'Unexpected error loading dataset.');
      } finally {
        setLoadingMeta(false);
      }
    };

    fetchMeta();
  }, [datasetId]);

  const fetchPreview = useCallback(async () => {
    if (!datasetId || !dataset) return;

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      let fromTable: string;

      if (dataset.type === 'numeric') {
        fromTable = 'dataset_values_numeric_raw';
      } else {
        fromTable = 'dataset_values_categorical_raw';
      }

      const { data, error } = await supabase
        .from(fromTable)
        .select('*')
        .eq('dataset_id', datasetId)
        .limit(20);

      if (error) {
        console.error('Error loading preview:', error);
        setPreviewError('Failed to load raw preview rows.');
      } else {
        setPreviewRows(data || []);
      }
    } catch (err: any) {
      console.error('Unexpected error loading preview:', err);
      setPreviewError(err.message || 'Unexpected error loading preview.');
    } finally {
      setPreviewLoading(false);
    }
  }, [datasetId, dataset]);

  // Load preview once dataset meta is known
  useEffect(() => {
    if (dataset) {
      fetchPreview();
    }
  }, [dataset, fetchPreview]);

  const handleCleaned = async () => {
    // After cleaning, just refresh the preview
    await fetchPreview();
  };

  const handleBack = () => {
    router.push('/datasets');
  };

  const renderPreviewTable = () => {
    if (!previewRows.length) {
      return (
        <p className="text-sm text-gray-500">
          No raw rows found yet. Upload data for this dataset to see a preview.
        </p>
      );
    }

    const columns = Array.from(
      new Set(previewRows.flatMap((r) => Object.keys(r || {})))
    );

    return (
      <div className="overflow-x-auto border rounded-md bg-white">
        <table className="min-w-full text-xs border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-2 py-1 border-b text-left font-semibold"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-t">
                {columns.map((col) => (
                  <td key={col} className="px-2 py-1 border-b">
                    {String(row?.[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="px-4 py-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <button
            onClick={handleBack}
            className="text-sm text-blue-600 hover:underline mb-1"
          >
            ← Back to datasets
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            Raw Dataset Details
          </h1>
        </div>
      </div>

      {loadingMeta && (
        <p className="text-sm text-gray-500">Loading dataset metadata…</p>
      )}
      {metaError && (
        <p className="text-sm text-red-600">
          {metaError}
        </p>
      )}

      {dataset && (
        <>
          {/* Dataset summary */}
          <div className="bg-white border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {dataset.name}
                </h2>
                <p className="text-xs text-gray-500">
                  Dataset ID: <span className="font-mono">{dataset.id}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5">
                  Type: {dataset.type}
                </span>
                <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 px-2 py-0.5">
                  Admin: {dataset.admin_level}
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">
                  Category: {dataset.category}
                </span>
              </div>
            </div>
            {dataset.description && (
              <p className="text-sm text-gray-700">{dataset.description}</p>
            )}

            <div className="pt-3 border-t flex flex-wrap gap-2">
              {dataset.type === 'numeric' && (
                <button
                  onClick={() => setShowCleanNumeric(true)}
                  className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Clean numeric dataset
                </button>
              )}
              {dataset.type === 'categorical' && (
                <button
                  onClick={() => setShowCleanCategorical(true)}
                  className="px-3 py-1.5 text-sm rounded bg-purple-600 text-white hover:bg-purple-700"
                >
                  Clean categorical dataset
                </button>
              )}
            </div>
          </div>

          {/* Raw preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Raw staging preview (first 20 rows)
              </h3>
              {previewLoading && (
                <span className="text-xs text-gray-500">Loading…</span>
              )}
            </div>
            {previewError && (
              <p className="text-sm text-red-600">{previewError}</p>
            )}
            {!previewLoading && renderPreviewTable()}
          </div>
        </>
      )}

      {/* Numeric cleaning modal */}
      {dataset && showCleanNumeric && dataset.type === 'numeric' && (
        <CleanNumericDatasetModal
          datasetId={dataset.id}
          datasetName={dataset.name}
          onClose={() => setShowCleanNumeric(false)}
          onCleaned={handleCleaned}
        />
      )}

      {/* Categorical cleaning modal */}
      {dataset && showCleanCategorical && dataset.type === 'categorical' && (
        <CleanCategoricalDatasetModal
          datasetId={dataset.id}
          datasetName={dataset.name}
          onClose={() => setShowCleanCategorical(false)}
          onCleaned={handleCleaned}
        />
      )}
    </div>
  );
}
