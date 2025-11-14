'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

type DatasetType = 'numeric' | 'categorical';

type Dataset = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  type: DatasetType;
  admin_level: string | null;
  created_at?: string;
};

interface PageProps {
  params: { dataset_id: string };
}

export default function RawDatasetPage({ params }: PageProps) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNumericModal, setShowNumericModal] = useState(false);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);

  const loadDataset = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (error) {
      console.error('Failed to load dataset:', error);
      setError(error.message);
      setDataset(null);
    } else {
      setDataset(data as Dataset);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDataset();
  }, [datasetId]);

  const handleCleaned = async () => {
    // For now, just reload the dataset record.
    await loadDataset();
  };

  if (loading && !dataset) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Loading dataset…</p>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-red-700 mb-2">
          Error loading dataset
        </h1>
        <p className="text-sm text-gray-700 mb-3">{error || 'Dataset not found.'}</p>
        <button
          onClick={loadDataset}
          className="inline-flex items-center px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const isNumeric = dataset.type === 'numeric';
  const isCategorical = dataset.type === 'categorical';

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Raw Dataset: {dataset.name}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Type:{' '}
            <span className="font-medium">
              {dataset.type === 'numeric' ? 'Numeric' : 'Categorical'}
            </span>
            {dataset.admin_level ? (
              <>
                {' · '}Admin level: <span className="font-medium">{dataset.admin_level}</span>
              </>
            ) : null}
            {dataset.category ? (
              <>
                {' · '}Category: <span className="font-medium">{dataset.category}</span>
              </>
            ) : null}
          </p>
          {dataset.description && (
            <p className="mt-2 text-sm text-gray-700 max-w-2xl">
              {dataset.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isNumeric && (
            <button
              onClick={() => setShowNumericModal(true)}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Clean numeric dataset
            </button>
          )}

          {isCategorical && (
            <button
              onClick={() => setShowCategoricalModal(true)}
              className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Clean categorical dataset
            </button>
          )}
        </div>
      </div>

      {/* Help / explanation */}
      <div className="border rounded-md p-3 bg-gray-50 text-xs text-gray-700 space-y-1">
        <p className="font-semibold text-gray-800">How this works</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <span className="font-medium">Numeric cleaning</span>:
            uses <code className="px-1 bg-gray-100 rounded text-[0.7rem]">preview_numeric_cleaning_v2</code>{' '}
            to preview the matching, then{' '}
            <code className="px-1 bg-gray-100 rounded text-[0.7rem]">clean_numeric_dataset</code>{' '}
            to write into <code className="px-1 bg-gray-100 rounded text-[0.7rem]">dataset_values_numeric</code>.
          </li>
          <li>
            <span className="font-medium">Categorical cleaning</span>:
            reshapes wide/long input using{' '}
            <code className="px-1 bg-gray-100 rounded text-[0.7rem]">
              preview_categorical_cleaning
            </code>{' '}
            and writes matches into{' '}
            <code className="px-1 bg-gray-100 rounded text-[0.7rem]">
              dataset_values_categorical
            </code>{' '}
            via{' '}
            <code className="px-1 bg-gray-100 rounded text-[0.7rem]">
              clean_categorical_dataset
            </code>.
          </li>
        </ul>
      </div>

      {/* Modals */}
      {isNumeric && (
        <CleanNumericDatasetModal
          datasetId={dataset.id}
          datasetName={dataset.name}
          open={showNumericModal}
          onOpenChange={setShowNumericModal}
          onCleaned={handleCleaned}
        />
      )}

      {isCategorical && (
        <CleanCategoricalDatasetModal
          datasetId={dataset.id}
          datasetName={dataset.name}
          open={showCategoricalModal}
          onOpenChange={setShowCategoricalModal}
          onCleaned={handleCleaned}
        />
      )}
    </div>
  );
}
