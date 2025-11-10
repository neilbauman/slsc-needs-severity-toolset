'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import InstanceDatasetConfigModal from '@/components/InstanceDatasetConfigModal';

export default function InstancesPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDatasetConfig, setShowDatasetConfig] = useState<any | null>(null);

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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Instances</h1>
          <button
            onClick={() => alert('Add instance modal TBD')}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
          >
            New Instance
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading instances...</p>
        ) : instances.length === 0 ? (
          <p className="text-gray-500 text-sm">No instances yet.</p>
        ) : (
          <table className="min-w-full text-sm border border-gray-300 bg-white shadow-sm rounded-md">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((i) => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{i.name}</td>
                  <td className="px-3 py-2 capitalize">{i.type}</td>
                  <td className="px-3 py-2">
                    {new Date(i.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setShowDatasetConfig(i)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Configure Datasets
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDatasetConfig && (
        <InstanceDatasetConfigModal
          instance={showDatasetConfig}
          onClose={() => setShowDatasetConfig(null)}
          onSaved={loadInstances}
        />
      )}
    </div>
  );
}
