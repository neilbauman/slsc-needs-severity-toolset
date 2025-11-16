// ======================================================
// 📁 /app/instances/page.tsx
// ======================================================
'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import Link from 'next/link';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';

export default function InstancesPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [showDefineModal, setShowDefineModal] = useState(false);

  async function loadInstances() {
    const { data, error } = await supabase.from('instances').select('*').order('created_at', { ascending: false });
    if (error) console.error('Error loading instances:', error);
    else setInstances(data || []);
  }

  useEffect(() => {
    loadInstances();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Instances</h1>
        <button
          onClick={() => setShowDefineModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Define Affected Area
        </button>
      </div>

      <table className="min-w-full border border-gray-300 rounded-md">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2 border-b">Name</th>
            <th className="text-left p-2 border-b">Created</th>
            <th className="text-left p-2 border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {instances.map((inst) => (
            <tr key={inst.id} className="hover:bg-gray-50">
              <td className="p-2 border-b">{inst.name}</td>
              <td className="p-2 border-b">{new Date(inst.created_at).toLocaleString()}</td>
              <td className="p-2 border-b">
                <Link
                  href={`/instances/${inst.id}`}
                  className="text-blue-600 hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showDefineModal && (
        <DefineAffectedAreaModal
          open={showDefineModal}
          onClose={() => setShowDefineModal(false)}
          onSaved={loadInstances}
        />
      )}
    </div>
  );
}

// ======================================================
// 📁 /app/instances/[id]/page.tsx
// ======================================================
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

export default function InstanceDetailPage() {
  const { id } = useParams();
  const [instance, setInstance] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadInstance() {
    setLoading(true);
    const { data, error } = await supabase.from('instances').select('*').eq('id', id).single();
    if (error) console.error('Error loading instance:', error);
    else setInstance(data);
    setLoading(false);
  }

  useEffect(() => {
    if (id) loadInstance();
  }, [id]);

  if (loading) return <div className="p-6">Loading instance...</div>;
  if (!instance) return <div className="p-6 text-red-600">Instance not found.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{instance.name}</h1>
      <p className="text-gray-700 mb-2">Created: {new Date(instance.created_at).toLocaleString()}</p>
      <p className="text-gray-700 mb-4">Description: {instance.description || 'No description'}</p>

      <button
        onClick={loadInstance}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Refresh
      </button>
    </div>
  );
}

// ======================================================
// 📁 /components/DefineAffectedAreaModal.tsx
// ======================================================
'use client';

import { useState } from 'react';
import supabase from '@/lib/supabaseClient';

export default function DefineAffectedAreaModal({ open, onClose, onSaved }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from('instances').insert({ name, description });
    setSaving(false);

    if (error) {
      console.error('Error saving instance:', error);
      alert('Failed to save instance.');
    } else {
      onSaved?.();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Define Affected Area</h2>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
