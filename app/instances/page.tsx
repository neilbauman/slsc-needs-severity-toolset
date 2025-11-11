'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import InstanceRecomputePanel from '@/components/InstanceRecomputePanel';

type Instance = {
  id: string;
  name: string;
  created_at: string;
};

export default function InstancesPage() {
  const supabase = createClient();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('instances')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });
      if (!error && data) setInstances(data as Instance[]);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-semibold mb-3">Instances</h1>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : instances.length === 0 ? (
        <div className="text-sm text-gray-500">No instances yet.</div>
      ) : (
        <div className="grid gap-4">
          {instances.map((inst) => (
            <div
              key={inst.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">
                    {inst.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    Created {new Date(inst.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <InstanceRecomputePanel instance={inst} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
