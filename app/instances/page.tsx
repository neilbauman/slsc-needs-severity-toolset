'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';

export default function InstancesPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);

  async function loadInstances() {
    setLoading(true);
    const { data, error } = await supabase.from('instances').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    else setInstances(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadInstances();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Instances</h1>
        <button
          onClick={() => setSelectedInstance({})}
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Define Affected Area
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="min-w-full border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border-b">Name</th>
              <th className="p-2 border-b">Created At</th>
              <th className="p-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="p-2">{i.name}</td>
                <td className="p-2">{new Date(i.created_at).toLocaleString()}</td>
                <td className="p-2">
                  <button
                    className="text-blue-600 hover:underline mr-3"
                    onClick={() => (window.location.href = `/instances/${i.id}`)}
                  >
                    View
                  </button>
                  <button
                    className="text-gray-600 hover:underline"
                    onClick={() => setSelectedInstance(i)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedInstance && (
        <DefineAffectedAreaModal
          open={!!selectedInstance}
          onClose={() => setSelectedInstance(null)}
          instance={selectedInstance}
          onSaved={loadInstances}
        />
      )}
    </div>
  );
}
