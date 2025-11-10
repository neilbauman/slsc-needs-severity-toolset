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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState<any | null>(null);
  const [showCategoricalModal, setShowCategoricalModal] = useState<any | null>(null);

  useEffect(() => {
    loadDatasets();
  }, []);

  async function loadDatasets() {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, category, type, admin_level');
    if (!error && data) setDatasets(data);
    setLoading(false);
  }

  function toggleSelection(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function saveSelections() {
    const records = Array.from(selected).map((datasetId) => ({
      instance_id: instance.id,
      dataset_id: datasetId,
    }));
    await supabase.from('instance_datasets').upsert(records);
    if (onSaved) onSaved();
    onClose();
  }

  function configureScoring(dataset: any) {
    if (dataset.type === 'Numeric') setShowNumericModal(dataset);
    else if (dataset.type === 'Categorical') setShowCategoricalModal(dataset);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl relative">
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="text-lg font-semibold text-gray-800">Dataset Configuration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
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
                        checked={selected.has(d.id)}
                        onChange={() => toggleSelection(d.id)}
                      />
                    </td>
                    <td className="px-3 py-2">{d.name}</td>
                    <td className="px-3 py-2">{d.category}</td>
                    <td className="px-3 py-2">{d.type}</td>
                    <td className="px-3 py-2">{d.admin_level}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => configureScoring(d)}
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
            className="px-4 py-1.5 border rounded-md text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={saveSelections}
            className="px-4 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
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
