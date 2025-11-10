'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import InstanceDatasetConfigModal from '@/components/InstanceDatasetConfigModal';
import InstanceScoringModal from '@/components/InstanceScoringModal';

type InstanceRow = {
  id: string;
  name: string;
  created_at?: string;
};

export default function InstancesPage() {
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDatasetConfig, setShowDatasetConfig] = useState<InstanceRow | null>(null);
  const [showOverallScoring, setShowOverallScoring] = useState<InstanceRow | null>(null);

  const loadInstances = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('instances')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setInstances((data || []) as InstanceRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadInstances();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Instances</h1>
        <p className="text-gray-600">Configure datasets for an instance, then compute framework and overall scores.</p>
      </div>

      <div className="bg-white rounded-lg shadow border">
        <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-sm font-semibold">
          <div className="col-span-6">Instance</div>
          <div className="col-span-3">Created</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>

        {loading && (
          <div className="px-4 py-6 text-gray-600">Loading…</div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-red-600">{error}</div>
        )}

        {!loading && !error && instances.length === 0 && (
          <div className="px-4 py-6 text-gray-600">No instances found.</div>
        )}

        {!loading && !error && instances.length > 0 && (
          <div className="divide-y">
            {instances.map((inst) => (
              <div key={inst.id} className="grid grid-cols-12 items-center px-4 py-3">
                <div className="col-span-6">
                  <div className="font-medium">{inst.name}</div>
                  <div className="text-xs text-gray-500">{inst.id}</div>
                </div>
                <div className="col-span-3 text-sm text-gray-700">
                  {inst.created_at ? new Date(inst.created_at).toLocaleString() : '—'}
                </div>
                <div className="col-span-3 flex justify-end gap-2">
                  <button
                    className="px-3 py-2 rounded border text-sm hover:bg-gray-100"
                    onClick={() => setShowDatasetConfig(inst)}
                  >
                    Configure Datasets
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700"
                    onClick={() => setShowOverallScoring(inst)}
                  >
                    Overall Scoring
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dataset configuration modal (numeric/categorical per dataset) */}
      {showDatasetConfig && (
        <InstanceDatasetConfigModal
          instance={showDatasetConfig}
          onClose={() => setShowDatasetConfig(null)}
          onSaved={loadInstances}
        />
      )}

      {/* Overall / framework scoring modal (category + SSC rollups) */}
      {showOverallScoring && (
        <InstanceScoringModal
          instance={showOverallScoring}
          onClose={() => setShowOverallScoring(null)}
          onSaved={loadInstances}
        />
      )}
    </div>
  );
}
