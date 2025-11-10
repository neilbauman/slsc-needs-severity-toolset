'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function InstancesPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstance, setNewInstance] = useState({
    name: '',
    type: 'baseline',
    description: '',
    admin_level: 'ADM3',
  });

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

  useEffect(() => {
    loadInstances();
  }, []);

  // Create new instance
  const handleCreate = async () => {
    if (!newInstance.name.trim()) return alert('Please enter a name.');
    const { error } = await supabase.from('instances').insert([
      {
        name: newInstance.name.trim(),
        type: newInstance.type,
        description: newInstance.description.trim(),
        admin_level: newInstance.admin_level,
        status: 'draft',
      },
    ]);
    if (error) {
      alert(`Error creating instance: ${error.message}`);
      return;
    }
    setShowCreateModal(false);
    setNewInstance({
      name: '',
      type: 'baseline',
      description: '',
      admin_level: 'ADM3',
    });
    loadInstances();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
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
                  <th className="px-3 py-2 text-left">Admin Level</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-left">Updated</th>
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
                    <td className="px-3 py-2">{inst.admin_level}</td>
                    <td className="px-3 py-2">{inst.status || '—'}</td>
                    <td className="px-3 py-2">
                      {new Date(inst.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      {inst.updated_at
                        ? new Date(inst.updated_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Instance Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Instance</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  value={newInstance.name}
                  onChange={(e) =>
                    setNewInstance({ ...newInstance, name: e.target.value })
                  }
                  className="w-full border rounded-md p-2 text-sm"
                  placeholder="e.g., Ilocos Norte Baseline"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Instance Type
                </label>
                <select
                  value={newInstance.type}
                  onChange={(e) =>
                    setNewInstance({
                      ...newInstance,
                      type: e.target.value,
                    })
                  }
                  className="w-full border rounded-md p-2 text-sm"
                >
                  <option value="baseline">Baseline</option>
                  <option value="forecast">Forecast</option>
                  <option value="nowcast">Nowcast</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Admin Level
                </label>
                <select
                  value={newInstance.admin_level}
                  onChange={(e) =>
                    setNewInstance({
                      ...newInstance,
                      admin_level: e.target.value,
                    })
                  }
                  className="w-full border rounded-md p-2 text-sm"
                >
                  <option value="ADM1">ADM1</option>
                  <option value="ADM2">ADM2</option>
                  <option value="ADM3">ADM3</option>
                  <option value="ADM4">ADM4</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={newInstance.description}
                  onChange={(e) =>
                    setNewInstance({
                      ...newInstance,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full border rounded-md p-2 text-sm"
                  placeholder="Short description..."
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
