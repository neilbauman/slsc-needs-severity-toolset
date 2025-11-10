'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NumericScoringModal from './NumericScoringModal';
import CategoricalScoringModal from './CategoricalScoringModal';

interface DatasetConfigModalProps {
  instance: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function DatasetConfigModal({
  instance,
  onClose,
  onSaved,
}: DatasetConfigModalProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState<any | null>(null);
  const [showCategoricalModal, setShowCategoricalModal] = useState<any | null>(null);

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, category, type, admin_level');
    if (!error && data) setDatasets(data);
    setLoading(false);
  };

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedDatasets);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedDatasets(newSet);
  };

  const handleSave = async () => {
    const instanceDatasets = Array.from(selectedDatasets).map((datasetId) => ({
      instance_id: instance.id,
      dataset_id: datasetId,
    }));

    await supabase.from('instance_datasets').upsert(instanceDatasets);
    if (onSaved) onSaved();
    onClose();
  };

  const handleConfigureScoring = (dataset: any) => {
    if (dataset.type === 'Numeric') setShowNumericModal(dataset);
    if (dataset.type === 'Categorical') setShowCategoricalModal(dataset);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl relative">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Dataset Configuration
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-light"
          >
            ×
          </button>
        </div>

        <div className="p-4 text-sm text-gray-700">
          {loading ? (
            <p>Loading datasets…</p>
          ) : (
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Select</th>
                  <th className="px-3 py-2 text-left">Dataset Name</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Admin Level</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedDatasets.has(d.id)}
                        onChange={() => handleSelect(d.id)}
                      />
                    </td>
                    <td className="px-3 py-2">{d.name}</td>
                    <td className="px-3 py-2">{d.category}</td>
                    <td className="px-3 py-2">{d.type}</td>
                    <td className="px-3 py-2">{d.admin_level}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleConfigureScoring(d)}
                        className="text-blue-600 hover:underline"
                      >
                        Configure Scoring
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md border text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Save Selections
          </button>
        </div>
      </div>

      {showNumericModal && (
        <NumericScoringModal
          dataset={showNumericModal}
          instance={instance}
          onClose={() => setShowNumericModal(null)}
        />
      )}
      {showCategoricalModal && (
        <CategoricalScoringModal
          dataset={showCategoricalModal}
          instance={instance}
          onClose={() => setShowCategoricalModal(null)}
        />
      )}
    </div>
  );
}
