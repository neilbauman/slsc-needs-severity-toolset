'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/supabaseClient';
import InstanceRecomputePanel from '@/components/InstanceRecomputePanel';

type Instance = {
  id: string;
  name: string;
  created_at: string;
};

export default function InstancesPage() {
  const supabase = createClient();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all instances on load
  const loadInstances = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('instances')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else if (data) {
      setInstances(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadInstances();
  }, []);

  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-800">Instances</h1>

      {loading && <div className="text-gray-600">Loading instances…</div>}
      {error && (
        <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded-md">
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && instances.length === 0 && (
        <div className="text-gray-500">No instances found.</div>
      )}

      {!loading && instances.length > 0 && (
        <div className="grid gap-8">
          {instances.map((instance) => (
            <div
              key={instance.id}
              className="border border-gray-200 rounded-lg shadow-sm bg-white p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{instance.name}</h2>
                  <p className="text-sm text-gray-500">
                    Created {new Date(instance.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Recompute buttons and panel */}
              <div className="mt-4">
                <InstanceRecomputePanel
                  instanceId={instance.id}
                  onReload={() => {
                    // When recompute finishes, refresh this page's instance data or map
                    loadInstances();
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
