'use client';

import { useState, useEffect } from 'react';
import supabase from '@/lib/supabaseClient';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  instance: any;
}

export default function DefineAffectedAreaModal({ open, onClose, onSaved, instance }: Props) {
  const [name, setName] = useState(instance?.name || '');
  const [description, setDescription] = useState(instance?.description || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (instance) {
      setName(instance.name || '');
      setDescription(instance.description || '');
    }
  }, [instance]);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    const payload = { name, description };

    const { error } = instance.id
      ? await supabase.from('instances').update(payload).eq('id', instance.id)
      : await supabase.from('instances').insert([{ ...payload }]);

    if (error) console.error(error);
    else {
      onSaved();
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          {instance?.id ? 'Edit Affected Area' : 'Define Affected Area'}
        </h2>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700">Name</span>
          <input
            type="text"
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Description</span>
          <textarea
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
