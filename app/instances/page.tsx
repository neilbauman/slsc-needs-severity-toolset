'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import InstanceDatasetConfigModal from '@/components/InstanceDatasetConfigModal';
import InstanceCategoryConfigModal from '@/components/InstanceCategoryConfigModal';
import ScoringPreviewModal from '@/components/ScoringPreviewModal';

export default function InstancesPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);

  // Config modals
  const [datasetConfigInstance, setDatasetConfigInstance] = useState<any | null>(null);
  const [categoryConfigInstance, setCategoryConfigInstance] = useState<any | null>(null);
  const [previewInstance, setPreviewInstance] = useState<any | null>(null);

  // Load instances
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

  useEffect(() => {
    loadInstances();
  }, []);

  const handleCreate = async () => {
    const name = prompt('Enter a name for the new instance:');
    if (!name) return;

    const { data, error } = await supabase
      .from('instances')
      .insert([{ name, type: 'baseline' }])
      .select();

    if (error) {
      console.error(error);
      alert('Failed to create instance.');
    } else {
      await loadInstances();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this instance?')) return;
    await supabase.from('instances').delete().eq('id', id);
    await loadInstances();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Instances</h1>
          <button
            onClick={handleCreate}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
          >
            + New Instance
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading instances...</p>
        ) : instances.length === 0 ? (
          <p className="text-gray-500 text-sm">No instances created yet.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((inst) => (
                  <tr
                    key={inst.id}
                    className="border-t hover:bg-gray-50 transition"
                  >
                    <td className="px-3 py-2">{inst.name}</td>
                    <td className="px-3 py-2 capitalize">{inst.type}</td>
                    <td className="px-3 py-2">
                      {new Date(inst.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => setDatasetConfigInstance(inst)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Dataset Config
                      </button>
                      <button
                        onClick={() => setCategoryConfigInstance(inst)}
                        className="text-green-600 hover:underline text-sm"
                      >
                        Category Config
                      </button>
                      <button
                        onClick={() => setPreviewInstance(inst)}
                        className="text-purple-600 hover:underline text-sm"
                      >
                        Scoring Preview
                      </button>
                      <button
                        onClick={() => handleDelete(inst.id)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dataset Config Modal */}
      {datasetConfigInstance && (
        <InstanceDatasetConfigModal
          instance={datasetConfigInstance}
          onClose={() => setDatasetConfigInstance(null)}
        />
      )}

      {/* Category Config Modal */}
      {categoryConfigInstance && (
        <InstanceCategoryConfigModal
          instance={categoryConfigInstance}
          onClose={() => setCategoryConfigInstance(null)}
        />
      )}

      {/* Scoring Preview Modal (placeholder) */}
      {previewInstance && (
        <ScoringPreviewModal
          instance={previewInstance}
          onClose={() => setPreviewInstance(null)}
        />
      )}
    </div>
  );
}
