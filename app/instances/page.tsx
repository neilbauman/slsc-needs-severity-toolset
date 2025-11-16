'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';
import InstanceDatasetConfigModal from '@/components/InstanceDatasetConfigModal';

interface Instance {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  admin_scope: string[] | null;
}

export default function InstancesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);

  useEffect(() => {
    // ensure client-side execution only
    if (typeof window === 'undefined') return;
    loadInstances();
  }, []);

  const loadInstances = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instances')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading instances:', error);
    } else {
      setInstances(data || []);
    }
    setLoading(false);
  };

  const handleCreateInstance = async () => {
    const name = prompt('Enter a name for the new instance:');
    if (!name) return;

    const { data, error } = await supabase
      .from('instances')
      .insert({ name })
      .select()
      .single();

    if (error) {
      console.error('Error creating instance:', error);
      return;
    }

    router.push(`/instances/${data.id}`);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Instances</h1>
        <button className="btn btn-primary" onClick={handleCreateInstance}>
          + New Instance
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading instances...</div>
      ) : instances.length === 0 ? (
        <div className="text-sm text-gray-500">No instances yet. Create one to begin.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map(instance => (
            <div
              key={instance.id}
              className="card p-4 border border-gray-200 rounded hover:shadow cursor-pointer transition"
              onClick={() => router.push(`/instances/${instance.id}`)}
            >
              <h2 className="font-medium text-lg">{instance.name}</h2>
              <div className="text-xs text-gray-500 mt-1">
                Created:{' '}
                {instance.created_at
                  ? new Date(instance.created_at).toLocaleString()
                  : '—'}
              </div>
              {instance.description && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                  {instance.description}
                </p>
              )}
              {instance.admin_scope && instance.admin_scope.length > 0 && (
                <div className="text-xs text-blue-600 mt-2">
                  🌍 Scope: {instance.admin_scope.join(', ')}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-3">
                <button
                  className="text-xs btn btn-secondary"
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedInstance(instance);
                    setShowDatasetModal(true);
                  }}
                >
                  Configure
                </button>
                <button
                  className="text-xs btn btn-primary"
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedInstance(instance);
                    setShowAreaModal(true);
                  }}
                >
                  Area
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAreaModal && selectedInstance && (
        <DefineAffectedAreaModal
          instance={selectedInstance}
          onClose={() => setShowAreaModal(false)}
          onSaved={loadInstances}
        />
      )}

      {showDatasetModal && selectedInstance && (
        <InstanceDatasetConfigModal
          instance={selectedInstance}
          onClose={() => setShowDatasetModal(false)}
          onSaved={loadInstances}
        />
      )}
    </div>
  );
}
