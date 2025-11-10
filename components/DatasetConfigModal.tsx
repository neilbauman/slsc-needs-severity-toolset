'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NumericScoringModal from './NumericScoringModal';
import CategoricalScoringModal from './CategoricalScoringModal';

interface InstanceDatasetConfigModalProps {
  instance: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function InstanceDatasetConfigModal({
  instance,
  onClose,
  onSaved,
}: InstanceDatasetConfigModalProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState<any | null>(null);
  const [showCategoricalModal, setShowCategoricalModal] = useState<any | null>(null);

  useEffect(() => {
    if (instance) loadDatasets();
  }, [instance]);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('category', { ascending: true });
    if (error) console.error(error);
    else setDatasets(data || []);
    setLoading(false);

    // Load existing instance dataset links
    const { data: linked } = await supabase
      .from('instance_datasets')
      .select('dataset_id')
      .eq('instance_id', instance.id);
    if (linked) setSelectedDatasets(linked.map((l) => l.dataset_id));
  };

  const toggleDataset = (datasetId: string) => {
    setSelectedDatasets((prev) =>
      prev.includes(datasetId)
        ? prev.filter((id) => id !== datasetId)
        : [...prev, datasetId]
    );
  };

  const handleSaveSelections = async () => {
    // Delete existing links and reinsert new ones
    await supabase.from('instance_datasets').delete().eq('instance_id', instance.id);
    if (selectedDatasets.length > 0) {
      const newLinks = selectedDatasets.map((id) => ({
        instance_id: instance.id,
        dataset_id: id,
      }));
      await supabase.from('instance_datasets').insert(newLinks);
    }
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Dataset Configuration</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
            ×
          </button>
        </div>

        <div className="p-4">
          <p className="text-gray-600 mb-3">
            Configure which datasets are included in instance:{' '}
            <strong>{instance?.name}</strong>
          </p>

          {loading ? (
            <p className="text-sm text-gray-500">Loading datasets…</p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="min-w-full text-sm border-collapse">
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
                          checked={selectedDatasets.includes(d.id)}
                          onChange={() => toggleDataset(d.id)}
                        />
                      </td>
                      <td className="px-3 py-2">{d.name}</td>
                      <td className="px-3 py-2">{d.category}</td>
                      <td className="px-3 py-2">{d.type}</td>
                      <td className="px-3 py-2">{d.admin_level}</td>
                      <td className="px-3 py-2">
                        {d.type === 'Numeric' ? (
                          <button
                            onClick={() => setShowNumericModal(d)}
                            className="text-blue-600 hover:underline"
                          >
                            Configure Scoring
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowCategoricalModal(d)}
                            className="text-blue-600 hover:underline"
                          >
                            Configure Scoring
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            onClick={handleSaveSelections}
            className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Save Selections
          </button>
        </div>
      </div>

      {/* Modals for Scoring */}
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
