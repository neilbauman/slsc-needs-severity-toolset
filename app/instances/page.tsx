'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ScoringPreviewModal from '@/components/ScoringPreviewModal';
import DatasetConfigModal from '@/components/DatasetConfigModal';

export default function InstancesPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScoringPreview, setShowScoringPreview] = useState<any | null>(null);
  const [showDatasetConfig, setShowDatasetConfig] = useState<any | null>(null);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState('Baseline');

  const loadInstances = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instances')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('Error loading instances:', error);
    else setInstances(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) {
      alert('Please enter an instance name.');
      return;
    }

    const { error } = await supabase.from('instances').insert([
      {
        name: newName.trim(),
        type: newType,
        description: newDescription.trim() || null,
      },
    ]);

    if (error) {
      alert(`Error creating instance: ${error.message}`);
    } else {
      setShowCreateModal(false);
      setNewName('');
      setNewDescription('');
      await loadInstances();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Instances</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
          >
            + New Instance
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading instances...</p>
        ) : instances.length === 0 ? (
          <p className="text-gray-500 text-sm">No instances found.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((inst: any) => (
                  <tr
                    key={inst.id}
                    className="border-t hover:bg-gray-50 transition"
                  >
                    <td className="px-3 py-2 font-medium">{inst.name}</td>
                    <td className="px-3 py-2">{inst.type}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {inst.description || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {new Date(inst.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setShowScoringPreview(inst)}
                        className="text-blue-600 hover:underline text-sm mr-3"
                      >
                        Scoring Preview
                      </button>
                      <button
                        onClick={() =>
                          alert('⚙️ Category weighting configuration coming next.')
                        }
                        className="text-green-600 hover:underline text-sm mr-3"
                      >
                        Category Config
                      </button>
                      <button
                        onClick={() => setShowDatasetConfig(inst)}
                        className="text-yellow-600 hover:underline text-sm"
                      >
                        Dataset Config
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b px-4 py-3 flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-800">
                Create New Instance
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-light"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border px-2 py-1 rounded-md text-sm"
                  placeholder="e.g. Baseline (PHL) - Nov 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full border px-2 py-1 rounded-md text-sm"
                >
                  <option value="Baseline">Baseline</option>
                  <option value="Forecast">Forecast</option>
                  <option value="Nowcast">Nowcast</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full border px-2 py-1 rounded-md text-sm"
                  placeholder="Optional description..."
                />
              </div>
            </div>

            <div className="border-t p-3 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="bg-gray-200 px-3 py-1.5 rounded-md text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scoring Preview */}
      {showScoringPreview && (
        <ScoringPreviewModal
          instance={showScoringPreview}
          onClose={() => setShowScoringPreview(null)}
        />
      )}

      {/* Dataset Config */}
      {showDatasetConfig && (
  <DatasetConfigModal
    dataset={showDatasetConfig.dataset}
    instanceId={showDatasetConfig.instanceId}
    onClose={() => setShowDatasetConfig(null)}
    onSaved={loadInstanceDatasets}
  />
)}
    </div>
  );
}
