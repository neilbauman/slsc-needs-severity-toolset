'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

export default function RawDatasetPage({ params }: { params: { dataset_id: string } }) {
  const datasetId = params.dataset_id;
  const [dataset, setDataset] = useState<any>(null);
  const [values, setValues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState(false);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);

  // Load dataset info and its values
  useEffect(() => {
    loadDataset();
  }, [datasetId]);

  const loadDataset = async () => {
    setLoading(true);

    const { data: datasetData, error: datasetError } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (datasetError) {
      console.error(datasetError);
      setLoading(false);
      return;
    }

    setDataset(datasetData);

    // Load dataset values depending on type
    const valueTable =
      datasetData.type === 'numeric'
        ? 'dataset_values_numeric'
        : 'dataset_values_categorical';

    const { data: valuesData, error: valuesError } = await supabase
      .from(valueTable)
      .select('*')
      .eq('dataset_id', datasetId)
      .limit(500); // keep it light for browser view

    if (valuesError) console.error(valuesError);
    else setValues(valuesData || []);

    setLoading(false);
  };

  const isNumeric = dataset?.type === 'numeric';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold mb-2">
            {dataset?.name || 'Dataset'}
          </h1>
          <p className="text-sm text-gray-600">
            Admin Level: {dataset?.admin_level} | Type: {dataset?.type}
          </p>
        </div>

        <button
          onClick={() =>
            isNumeric ? setShowNumericModal(true) : setShowCategoricalModal(true)
          }
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
        >
          Clean Dataset
        </button>
      </div>

      {/* Data Table */}
      <div className="mt-6">
        {loading ? (
          <p className="text-gray-500">Loading dataset values…</p>
        ) : values.length === 0 ? (
          <p className="text-gray-500">No data found for this dataset.</p>
        ) : (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  {Object.keys(values[0]).map((col) => (
                    <th key={col} className="px-3 py-2 text-left">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {values.map((row, i) => (
                  <tr key={i} className="border-t">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-3 py-1">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
