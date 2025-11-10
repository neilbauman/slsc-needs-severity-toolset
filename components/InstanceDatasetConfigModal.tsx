'use client';

import React, { useState, useEffect } from 'react';
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
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // scoring modals
  const [showNumericModal, setShowNumericModal] = useState<any>(null);
  const [showCategoricalModal, setShowCategoricalModal] = useState<any>(null);

  // load datasets
  useEffect(() => {
    async function loadDatasets() {
      setLoading(true);
      try {
        const res = await fetch(`/api/datasets`);
        const data = await res.json();
        setDatasets(data || []);
      } catch (err) {
        console.error('Error loading datasets', err);
      } finally {
        setLoading(false);
      }
    }
    loadDatasets();
  }, []);

  const handleToggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    try {
      await fetch(`/api/instances/${instance.id}/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetIds: selected }),
      });
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving datasets', err);
    }
  };

  const handleConfigureScoring = (dataset: any) => {
    if (dataset.type === 'numeric') setShowNumericModal(dataset);
    else if (dataset.type === 'categorical') setShowCategoricalModal(dataset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg w-[900px] max-h-[85vh] overflow-y-auto p-6">
        <h2 className="text-2xl font-semibold mb-4">Dataset Configuration</h2>

        <p className="mb-4 text-gray-600">
          Configure which datasets are included in instance:{' '}
          <strong>{instance?.name}</strong>
        </p>

        {loading ? (
          <p>Loading datasets...</p>
        ) : (
          <table className="min-w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Select</th>
                <th className="p-2 text-left">Dataset Name</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Admin Level</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((ds) => (
                <tr key={ds.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(ds.id)}
                      onChange={() => handleToggle(ds.id)}
                    />
                  </td>
                  <td className="p-2">{ds.name}</td>
                  <td className="p-2">{ds.category}</td>
                  <td className="p-2 capitalize">{ds.type}</td>
                  <td className="p-2">{ds.admin_level}</td>
                  <td
                    className="p-2 text-blue-600 cursor-pointer hover:underline"
                    onClick={() => handleConfigureScoring(ds)}
                  >
                    Configure Scoring
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-end mt-6 gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Selections
          </button>
        </div>

        {/* scoring modals */}
        {showNumericModal && (
          <NumericScoringModal
            dataset={showNumericModal}
            instanceId={instance.id}
            onClose={() => setShowNumericModal(null)}
          />
        )}

        {showCategoricalModal && (
          <CategoricalScoringModal
            dataset={showCategoricalModal}
            instanceId={instance.id}
            onClose={() => setShowCategoricalModal(null)}
          />
        )}
      </div>
    </div>
  );
}
