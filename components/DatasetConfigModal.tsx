'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NumericScoringModal from './NumericScoringModal';
import CategoricalScoringModal from './CategoricalScoringModal';

interface DatasetConfigModalProps {
  instanceId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function DatasetConfigModal({
  instanceId,
  onClose,
  onSaved,
}: DatasetConfigModalProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
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
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setDatasets(data || []);

      // Load instance selections
      const { data: existing } = await supabase
        .from('instance_datasets')
        .select('dataset_id')
        .eq('instance_id', instanceId);

      if (existing) {
        setSelected(existing.map((d) => d.dataset_id));
      }
    }

    setLoading(false);
  };

  const toggleSelection = (datasetId: string) => {
    setSelected((prev) =>
      prev.includes(datasetId)
        ? prev.filter((id) => id !== datasetId)
        : [...prev, datasetId]
    );
  };

  const handleSaveSelections = async () => {
    try {
      // Clear existing links for this instance
      await supabase.from('instance_datasets').delete().eq('instance_id', instanceId);

      // Insert updated selections
      const insertRows = selected.map((id) => ({
        instance_id: instanceId,
        dataset_id: id,
      }));

      if (insertRows.length > 0) {
        const { error } = await supabase.from('instance_datasets').insert(insertRows);
        if (error) throw error;
      }

      alert('Datasets updated successfully.');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error saving dataset selections.');
    }
  };

  const grouped = datasets.reduce((acc: any, ds: any) => {
    const cat = ds.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ds);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl relative max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Dataset Configuration
            </h2>
            <p className="text-xs text-gray-500">
              Configure which datasets are included in instance:{' '}
              <span className="font-medium">Baseline (PHL) – Nov 2025</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading datasets…</p>
          ) : (
            Object.keys(grouped).map((cat) => (
              <div key={cat} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {cat}
                </h3>
                <div className="overflow-x-auto border rounded-md bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left w-16">Select</th>
                        <th className="px-3 py-2 text-left">Dataset Name</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Admin Level</th>
                        <th className="px-3 py-2 text-right w-32">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[cat].map((ds: any) => (
                        <tr
                          key={ds.id}
                          className={`border-t ${
                            selected.includes(ds.id)
                              ? 'bg-blue-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selected.includes(ds.id)}
                              onChange={() => toggleSelection(ds.id)}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {ds.name}
                          </td>
                          <td className="px-3 py-2">{ds.category}</td>
                          <td className="px-3 py-2 capitalize">{ds.type}</td>
                          <td className="px-3 py-2">{ds.admin_level}</td>
                          <td className="px-3 py-2 text-right">
                            {ds.type === 'numeric' ? (
                              <button
                                onClick={() => setShowNumericModal(ds)}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                ⚙ Configure Scoring
                              </button>
                            ) : ds.type === 'categorical' ? (
                              <button
                                onClick={() => setShowCategoricalModal(ds)}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                ⚙ Configure Scoring
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border text-gray-600 hover:bg-gray-50"
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

      {/* Numeric Scoring Modal */}
      {showNumericModal && (
        <NumericScoringModal
          dataset={showNumericModal}
          instanceId={instanceId}
          onClose={() => setShowNumericModal(null)}
          onSaved={loadDatasets}
        />
      )}

      {/* Categorical Scoring Modal */}
      {showCategoricalModal && (
        <CategoricalScoringModal
          dataset={showCategoricalModal}
          instanceId={instanceId}
          onClose={() => setShowCategoricalModal(null)}
          onSaved={loadDatasets}
        />
      )}
    </div>
  );
}
