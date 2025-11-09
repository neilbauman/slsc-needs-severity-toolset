'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
  datasetId: string;
  onClose: () => void;
  onSave: () => void;
};

export default function EditDatasetModal({ datasetId, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('datasets').select('*').eq('id', datasetId).single();
      if (data) {
        setName(data.name || '');
        setDescription(data.description || '');
        setType(data.type || '');
      }
    }
    load();
  }, [datasetId]);

  async function handleSave() {
    const { error } = await supabase
      .from('datasets')
      .update({ name, description, type })
      .eq('id', datasetId);

    if (error) {
      console.error('Update failed:', error.message);
    } else {
      onSave();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow w-full max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Edit Dataset</h2>

        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          className="w-full border px-3 py-2 rounded mb-4"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          className="w-full border px-3 py-2 rounded mb-4"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          className="w-full border px-3 py-2 rounded mb-4"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Select type</option>
          <option value="numeric">Numeric</option>
          <option value="categorical">Categorical</option>
          <option value="gradient">Gradient</option>
        </select>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
