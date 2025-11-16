'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';

type Instance = {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  admin_scope: string[] | null;
  active: boolean | null;
  type: string | null;
};

export default function InstancesPage() {
  const supabase = createClient();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [areaModalFor, setAreaModalFor] = useState<Instance | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instances')
      .select('id, name, description, created_at, admin_scope, active, type')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading instances:', error);
      setInstances([]);
    } else {
      setInstances(data as Instance[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createInstance = async () => {
    if (!newName.trim()) {
      alert('Instance name is required.');
      return;
    }

    setCreating(true);
    const { data, error } = await supabase
      .from('instances')
      .insert({
        name: newName.trim(),
        description: newDesc || null,
        type: 'baseline',
        active: true,
        admin_scope: null,
      })
      .select()
      .single();

    setCreating(false);

    if (error) {
      alert(`Create failed: ${error.message}`);
      return;
    }

    setNewName('');
    setNewDesc('');
    await load();
    setAreaModalFor(data as Instance);
  };

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between no-print">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--gsc-blue)' }}>
          Instances
        </h1>
        <div className="flex gap-2">
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
        </div>
      </header>

      <div className="card p-4 no-print">
        <h2
          className="text-base font-semibold mb-2"
          style={{ color: 'var(--gsc-green)' }}
        >
          Create New Instance
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder="Instance name (e.g., Baseline - Nov 2025)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm md:col-span-2"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
        </div>

        <div className="flex justify-end mt-3">
          <button
            className="btn btn-primary"
            onClick={createInstance}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      <div className="card p-4 print-safe">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">Your Instances</h2>
          <div className="text-xs text-gray-500">{instances.length} total</div>
        </div>

        {loading && <div className="text-sm">Loading…</div>}
        {!loading && instances.length === 0 && (
          <div className="text-sm text-gray-600">
            No instances yet. Create one above.
          </div>
        )}

        {!loading && instances.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Affected ADM1</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((inst) => (
                  <tr key={inst.id} className="border-t">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{inst.name}</div>
                      {inst.description && (
                        <div className="text-xs text-gray-500">
                          {inst.description}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {inst.created_at
                        ? new Date(inst.created_at).toLocaleString()
                        : '—'}
                    </td>
                    <td className="py-2 pr-3">{inst.type ?? '—'}</td>
                    <td className="py-2 pr-3">{inst.admin_scope?.length ?? 0}</td>
                    <td className="py-2 pr-0">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          className="btn btn-secondary"
                          onClick={() => setAreaModalFor(inst)}
                        >
                          Define Affected Area
                        </button>
                        <Link
                          href={`/instances/${inst.id}`}
                          className="btn btn-primary"
                        >
                          Open Dashboard
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {areaModalFor && (
        <DefineAffectedAreaModal
          instance={areaModalFor}
          onClose={() => setAreaModalFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
