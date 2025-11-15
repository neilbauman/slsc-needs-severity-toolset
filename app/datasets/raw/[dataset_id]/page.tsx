'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

export default function RawDatasetPage({ params }: { params: { dataset_id: string } }) {
  const datasetId = params.dataset_id;
  const [dataset, setDataset] = useState<any>(null);
  const [showNumericModal, setShowNumericModal] = useState(false);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);

  useEffect(() => {
    loadDataset();
  }, [datasetId]);

  const loadDataset = async () => {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (error) console.error(error);
    else setDataset(data);
  };

  const isNumeric = dataset?.type === 'numeric';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">
        {dataset?.name || 'Dataset'}
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        Admin Level: {dataset?.admin_level} | Type: {dataset?.type}
      </p>

      <div className="flex justify-end mb-4">
        <button
          onClick={() =>
            isNumeric ? setShowNumericModal(true) : setShowCategoricalModal(true)
          }
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
        >
          Clean Dataset
        </button>
      </div>

      {/* Table or other dataset view here */}

      {/* Modals */}
      {showNumericModal && (
        <CleanNumericDatasetModal
          datasetId={datasetId}
          datasetName={dataset?.name || ''}
          open={showNumericModal}
          onOpenChange={setShowNumericModal}
          onCleaned={loadDataset}
        />
      )}
      {showCategoricalModal && (
        <CleanCategoricalDatasetModal
          datasetId={datasetId}
          datasetName={dataset?.name || ''}
          open={showCategoricalModal}
          onOpenChange={setShowCategoricalModal}
          onCleaned={loadDataset}
        />
      )}
    </div>
  );
}
