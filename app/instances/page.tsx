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
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setInstances(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createInstance = async () => {
    if (!newName.trim()) return alert('Instance name required');
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
    if (error) return alert(error.message);
    setNewName('');
    setNewDesc('');
    await load();
    setAreaModalFor(data);
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--gsc-blue)]">Instances</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Home
        </Link>
      </header>

      {/* Create form */}
      <div className="p-4 bg-white rounded shadow">
        <h2 className="font-semibold text-[var(--gsc-green)] mb-2">Create New Instance</h2>
        <div className="grid grid-cols-3 gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="border rounded px-2 py-1"
            placeholder="Instance name"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="border rounded px-2 py-1 col-span-2"
            placeholder="Description"
          />
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={createInstance}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Your Instances</h2>
          <span className="text-xs text-gray-500">{instances.length} total</span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : instances.length === 0 ? (
          <p className="text-sm text-gray-500">No instances yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-left py-2">Name</th>
                <th>Created</th>
                <th>Type</th>
                <th>Affected ADM1</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => (
                <tr key={inst.id} className="border-t">
                  <td className="py-2">{inst.name}</td>
                  <td>{inst.created_at ? new Date(inst.created_at).toLocaleString() : '—'}</td>
                  <td>{inst.type ?? '—'}</td>
                  <td>{inst.admin_scope?.length ?? 0}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setAreaModalFor(inst)}
                        className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                      >
                        Define Area
                      </button>
                      <Link
                        href={`/instances/${inst.id}`}
                        className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Open
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
