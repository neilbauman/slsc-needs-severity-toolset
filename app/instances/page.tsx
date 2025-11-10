'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DatasetConfigModal from '@/components/DatasetConfigModal';
import ScoringPreviewModal from '@/components/ScoringPreviewModal';

export default function InstancesPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);
  const [instanceDatasets, setInstanceDatasets] = useState<any[]>([]);

  const [showDatasetConfig, setShowDatasetConfig] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load all instances
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

  // Load datasets linked to a given instance
  const loadInstanceDatasets = async (instanceId?: string) => {
    const id = instanceId || selectedInstance?.id;
    if (!id) return;

    const { data, error } = await supabase
      .from('instance_datasets')
      .select(`
        *,
        datasets(*)
      `)
      .eq('instance_id', id);

    if (error) console.error(error);
    else setInstanceDatasets(data || []);
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const handleOpenInstance = async (instance: any) => {
    setSelectedInstance(instance);
    await loadInstanceDatasets(instance.id);
  };

  const handleCreateInstance = async (type: string) => {
    const name = prompt(`Enter a name for the ${type} instance:`);
    if (!name) return;

    const { data, error } = await supabase
      .from('instances')
      .insert([{ name, type }])
      .select()
      .single();

    if (error) {
      console.error(error);
      alert('Failed to create instance');
      return;
    }

    await loadInstances();
    await handleOpenInstance(data);
  };

  const handleAddDataset = async () => {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return console.error(error);

    const datasetName = prompt(
      `Enter the name of the dataset to add:\n${data
        .map((d: any) => d.name)
        .join(', ')}`
    );
    const dataset = data.find(
      (d: any) => d.name.toLowerCase() === datasetName?.toLowerCase()
    );

    if (!dataset) {
      alert('Dataset not found.');
      return;
    }

    const { error: linkError } = await supabase.from('instance_datasets').insert([
      { instance_id: selectedInstance.id, dataset_id: dataset.id },
    ]);

    if (linkError) {
      console.error(linkError);
      alert('Failed to link dataset.');
    } else {
      await loadInstanceDatasets();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Instances</h1>
          <div className="flex gap-2">
            <button
              onClick={() => handleCreateInstance('baseline')}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
            >
              + New Baseline
            </button>
            <button
              onClick={() => handleCreateInstance('forecast')}
              className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-green-700"
            >
              + New Forecast
            </button>
            <button
              onClick={() => handleCreateInstance('nowcast')}
              className="bg-purple-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-purple-700"
            >
              + New Nowcast
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading instances...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className={`border rounded-lg p-4 bg-white shadow-sm cursor-pointer hover:shadow-md transition ${
                  selectedInstance?.id === instance.id ? 'border-blue-500' : ''
                }`}
                onClick={() => handleOpenInstance(instance)}
              >
                <h2 className="text-lg font-semibold">{instance.name}</h2>
                <p className="text-sm text-gray-600 capitalize">
                  Type: {instance.type}
                </p>
                <p className="text-xs text-gray-400">
                  Created: {new Date(instance.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {selectedInstance && (
          <div className="mt-8 border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {selectedInstance.name} — Datasets
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleAddDataset}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
                >
                  + Add Dataset
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className="bg-gray-700 text-white px-3 py-1.5 rounded-md text-sm hover:bg-gray-800"
                >
                  Preview Scoring
                </button>
              </div>
            </div>

            {instanceDatasets.length === 0 ? (
              <p className="text-sm text-gray-500">
                No datasets added to this instance.
              </p>
            ) : (
              <table className="min-w-full text-sm border rounded-md overflow-hidden bg-white shadow-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Dataset</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Admin Level</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {instanceDatasets.map((d: any, i: number) => (
                    <tr
                      key={i}
                      className="border-t hover:bg-gray-50 transition"
                    >
                      <td className="px-3 py-2">{d.datasets?.name}</td>
                      <td className="px-3 py-2">{d.datasets?.category}</td>
                      <td className="px-3 py-2 capitalize">
                        {d.datasets?.type}
                      </td>
                      <td className="px-3 py-2">{d.datasets?.admin_level}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() =>
                            setShowDatasetConfig({
                              dataset: d.datasets,
                              instanceId: selectedInstance.id,
                            })
                          }
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Dataset Configuration Modal */}
      {showDatasetConfig && (
        <DatasetConfigModal
          dataset={showDatasetConfig.dataset}
          instanceId={showDatasetConfig.instanceId}
          onClose={() => setShowDatasetConfig(null)}
          onSaved={() => loadInstanceDatasets(showDatasetConfig.instanceId)}
        />
      )}

      {/* Scoring Preview Modal */}
      {showPreview && selectedInstance && (
        <ScoringPreviewModal
          instance={selectedInstance}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
