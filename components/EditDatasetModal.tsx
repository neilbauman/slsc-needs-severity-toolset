'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export default function EditDatasetModal({ dataset, onClose, onSave }: EditDatasetModalProps) {
  const [name, setName] = useState(dataset.name);
  const [category, setCategory] = useState(dataset.category);
  const [description, setDescription] = useState(dataset.description || '');

  const handleSave = async () => {
    const { error } = await supabase
      .from('datasets')
      .update({ name, category, description })
      .eq('id', dataset.id);

    if (error) console.error('Error updating dataset:', error);
    else await onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-md w-full max-w-md p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Edit Dataset</h2>

        <label className="block text-sm mb-2">
          Name
          <input
            className="w-full border rounded-md px-2 py-1 mt-1 text-sm"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </label>

        <label className="block text-sm mb-2">
          Category
          <input
            className="w-full border rounded-md px-2 py-1 mt-1 text-sm"
            value={category}
            onChange={e => setCategory(e.target.value)}
          />
        </label>

        <label className="block text-sm mb-4">
          Description
          <textarea
            className="w-full border rounded-md px-2 py-1 mt-1 text-sm"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </label>

        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-3 py-1 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
