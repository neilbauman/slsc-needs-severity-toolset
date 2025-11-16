'use client';

import React, { useState } from 'react';
import supabase from '@/lib/supabaseClient';

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function EditDatasetModal({
  dataset,
  onClose,
  onSaved,
}: EditDatasetModalProps) {
  const [form, setForm] = useState({
    name: dataset.name || '',
    description: dataset.description || '',
    type: dataset.type || 'numeric',
    admin_level: dataset.admin_level || '',
    absolute_relative_index: dataset.absolute_relative_index || '',
  });

  const [saving, setSaving] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from('datasets')
      .update({
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
        admin_level: form.admin_level,
        absolute_relative_index: form.absolute_relative_index,
      })
      .eq('id', dataset.id);

    setSaving(false);

    if (error) {
      console.error('Error updating dataset:', error);
      alert('Failed to save changes.');
    } else {
      await onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Edit Dataset</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="numeric">Numeric</option>
              <option value="categorical">Categorical</option>
            </select>
          </div>

          {/* Admin Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Admin Level</label>
            <select
              name="admin_level"
              value={form.admin_level}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Level</option>
              <option value="adm1">ADM1</option>
              <option value="adm2">ADM2</option>
              <option value="adm3">ADM3</option>
              <option value="adm4">ADM4</option>
              <option value="adm5">ADM5</option>
            </select>
          </div>

          {/* Absolute / Relative / Index */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Value Type
            </label>
            <select
              name="absolute_relative_index"
              value={form.absolute_relative_index}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Type</option>
              <option value="absolute">Absolute</option>
              <option value="relative">Relative</option>
              <option value="index">Index</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 rounded text-white ${
                saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
