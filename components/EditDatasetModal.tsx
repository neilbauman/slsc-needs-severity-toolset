'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EditDatasetModal({ open, onClose, dataset, onSaved }) {
  const [name, setName] = useState(dataset?.name || '');
  const [description, setDescription] = useState(dataset?.description || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dataset) {
      setName(dataset.name || '');
      setDescription(dataset.description || '');
    }
  }, [dataset]);

  const handleSave = async () => {
    if (!dataset?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('datasets')
      .update({ name, description }) // no updated_at
      .eq('id', dataset.id);

    setSaving(false);

    if (!error) {
      onSaved?.();
      onClose();
    } else {
      alert(`Failed to save dataset: ${error.message}`);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-[480px]">
        <h2 className="text-lg font-semibold mb-4">Edit Dataset</h2>

        <label className="block mb-2 text-sm font-medium">Dataset Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded w-full px-3 py-2 mb-4"
          placeholder="Enter dataset name"
        />

        <label className="block mb-2 text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border rounded w-full px-3 py-2 mb-4"
          rows={3}
          placeholder="Enter dataset description"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
