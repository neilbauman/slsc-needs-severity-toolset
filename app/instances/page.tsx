'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DatasetConfigModal from '@/components/DatasetConfigModal';
import CategoryConfigModal from '@/components/CategoryConfigModal';
import ScoringPreviewModal from '@/components/ScoringPreviewModal';

export default function InstancesPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDatasetConfig, setShowDatasetConfig] = useState<any | null>(null);
  const [showCategoryConfig, setShowCategoryConfig] = useState<any | null>(null);
  const [showScoringPreview, setShowScoringPreview] = useState<any | null>(null);

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instances')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    else setInstances(data || []);
    setLoading(false);
  };

  const createInstance = async (type: 'Baseline' | 'Forecast' | 'Nowcast') => {
    const name = prompt(`Enter a name for the new ${type} instance:`);
    if (!name) return;

    const { error } = await supabase
      .from('instances')
      .insert([{ name, type, description: null }]);
    if (error) {
      alert(`Error creating instance: ${error.message}`);
    } else {
      alert(`${type} instance created successfully.`);
      loadInstances();
    }
  };

  const handleDelete = async (instanceId: string) => {
    if (!confirm('Are you sure you want to delete this instance?')) return;
    const { error } = await supabase.from('instances').delete().eq('id', instanceId);
    if (error) alert('Error deleting instance');
    else loadInstances();
  };

  const loadInstanceDatasets = async (instanceId: string) => {
    // Placeholder reload after configuration
    console.log(`Reloading datasets for instance: ${instanceId}`);
    await loadInstances();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Instances</h1>
          <div className="flex gap-2">
            <button
              onClick={() => createInstance('Baseline')}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
            >
              + New Baseline
            </button>
            <button
              onClick={() => createInstance('Forecast')}
              className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-green-700"
            >
              + New Forecast
            </button>
            <button
              onClick={() => createInstance('Nowcast')}
              className="bg-purple-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-purple-700"
            >
              + New Nowcast
            </button>
          </div>
        </div>

        {/* Instance List */}
        {loading ? (
          <p className="text-gray-500 text-sm">Loading instances…</p>
        ) : instances.length === 0 ? (
          <p className="text-gray-500 text-sm">No instances found.</p>
        ) : (
          <div className="space-y-6">
            {instances.map((inst) => (
              <div
                key={inst.id}
                className="border rounded-lg bg-white shadow-sm hover:shadow-md transition p-4"
              >
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">{inst.name}</h2>
                    <p className="text-xs text-gray-500">
                      Type: {inst.type} • Created:{' '}
                      {new Date(inst.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowScoringPreview(inst)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Scoring Preview
                    </button>
                    <button
                      onClick={() => setShowCategoryConfig(inst)}
                      className="text-green-600 hover:underline text-sm"
                    >
                      Category Config
                    </button>
                    <button
                      onClick={() => setShowDatasetConfig(inst.id)}
                      className="text-amber-600 hover:underline text-sm"
                    >
                      Dataset Config
                    </button>
                    <button
                      onClick={() => handleDelete(inst.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Instance datasets preview */}
                <InstanceDatasets instanceId={inst.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dataset Config Modal */}
      {showDatasetConfig && (
        <DatasetConfigModal
          instanceId={showDatasetConfig}
          onClose={() => setShowDatasetConfig(null)}
          onSaved={() => loadInstanceDatasets(showDatasetConfig)}
        />
      )}

      {/* Category Config Modal */}
      {showCategoryConfig && (
        <CategoryConfigModal
          instance={showCategoryConfig}
          onClose={() => setShowCategoryConfig(null)}
        />
      )}

      {/* Scoring Preview Modal */}
      {showScoringPreview && (
        <ScoringPreviewModal
          instance={showScoringPreview}
          onClose={() => setShowScoringPreview(null)}
        />
      )}
    </div>
  );
}

/**
 * Simple component for showing which datasets belong to an instance.
 */
function InstanceDatasets({ instanceId }: { instanceId: string }) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInstanceDatasets();
  }, [instanceId]);

  const loadInstanceDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instance_datasets')
      .select('datasets(name, category, type, admin_level)')
      .eq('instance_id', instanceId);

    if (error) console.error(error);
    else setDatasets(data || []);
    setLoading(false);
  };

  if (loading) return <p className="text-gray-400 text-xs mt-1">Loading datasets…</p>;
  if (datasets.length === 0)
    return <p className="text-gray-400 text-xs mt-1">No datasets linked yet.</p>;

  return (
    <table className="w-full text-xs mt-2 border rounded-md">
      <thead className="bg-gray-100 text-gray-600">
        <tr>
          <th className="px-2 py-1 text-left">Dataset</th>
          <th className="px-2 py-1 text-left">Category</th>
          <th className="px-2 py-1 text-left">Type</th>
          <th className="px-2 py-1 text-left">Admin Level</th>
        </tr>
      </thead>
      <tbody>
        {datasets.map((d, i) => (
          <tr
            key={i}
            className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-t`}
          >
            <td className="px-2 py-1">{d.datasets.name}</td>
            <td className="px-2 py-1">{d.datasets.category}</td>
            <td className="px-2 py-1 capitalize">{d.datasets.type}</td>
            <td className="px-2 py-1">{d.datasets.admin_level}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
