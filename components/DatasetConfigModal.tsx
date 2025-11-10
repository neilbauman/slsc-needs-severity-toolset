'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NumericScoringModal from './NumericScoringModal';

interface DatasetConfigModalProps {
  instance: any;
  onClose: () => void;
}

export default function DatasetConfigModal({ instance, onClose }: DatasetConfigModalProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState<any | null>(null);

  useEffect(() => {
    loadDatasets();
    loadSelections();
  }, []);

  const loadDatasets = async () => {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('category', { ascending: true });

    if (error) console.error(error);
    else setDatasets(data || []);
    setLoading(false);
  };

  const loadSelections = async () => {
    const { data, error } = await supabase
      .from('instance_datasets')
      .select('dataset_id')
      .eq('instance_id', instance.id);

    if (error) {
      console.error(error);
      return;
    }

    setSelected(data?.map((r: any) => r.dataset_id) || []);
  };

  const handleToggle = (datasetId: string) => {
    if (selected.includes(datasetId)) {
      setSelected(selected.filter((id) => id !== datasetId));
    } else {
      setSelected([...selected, datasetId]);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    // Clear old selections
    await supabase.from('instance_datasets').delete().eq('instance_id', instance.id);

    // Insert new selections
    const records = selected.map((id) => ({
      instance_id: instance.id,
      dataset_id: id,
      score_config: {},
    }));

    const { error } = await supabase.from('instance_datasets').insert(records);

    if (error) {
      alert(`Error saving datasets: ${error.message}`);
    } else {
      alert('Datasets saved for this instance.');
      onClose();
    }

    setSaving(false);
  };

  const openNumericModal = (dataset: any) => {
    setShowNumericModal(dataset);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl relative max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start p-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Dataset Configuration</h2>
            <p className="text-xs text-gray-500">
              Configure which datasets are included in instance: <strong>{instance.name}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-4 text-sm">
          {loading ? (
            <p className="text-gray-500">Loading datasets...</p>
          ) : (
            <table className="min-w-full text-sm border border-gray-200 rounded-md">
              <thead className="bg-gray-100 border-b text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Select</th>
                  <th className="px-3 py-2 text-left">Dataset Name</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Admin Level</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds) => (
                  <tr
                    key={ds.id}
                    className={`border-t ${
                      selected.includes(ds.id) ? 'bg-blue-50' : ''
                    } hover:bg-gray-50 transition`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(ds.id)}
                        onChange={() => handleToggle(ds.id)}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800">{ds.name}</td>
                    <td className="px-3 py-2 text-gray-700">{ds.category}</td>
                    <td className="px-3 py-2 text-gray-700 capitalize">{ds.type}</td>
                    <td className="px-3 py-2 text-gray-700">{ds.admin_level}</td>
                    <td className="px-3 py-2 text-right">
                      {ds.type === 'numeric' && selected.includes(ds.id) && (
                        <button
                          onClick={() => openNumericModal(ds)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          ⚙️ Configure Scoring
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-md text-sm hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Selections'}
          </button>
        </div>
      </div>

      {/* Numeric Scoring Modal */}
      {showNumericModal && (
        <NumericScoringModal
          instanceId={instance.id}
          dataset={showNumericModal}
          onClose={() => setShowNumericModal(null)}
        />
      )}
    </div>
  );
}
