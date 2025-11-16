'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface EditDatasetModalProps {
  open: boolean;
  dataset: any;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export default function EditDatasetModal({
  open,
  dataset,
  onClose,
  onSaved,
}: EditDatasetModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    admin_level: '',
    type: '',
    absolute_relative_index: '',
    category: '',
    subtype: '',
    is_derived: false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when dataset changes
  useEffect(() => {
    if (dataset) {
      setFormData({
        name: dataset.name || '',
        description: dataset.description || '',
        admin_level: dataset.admin_level || '',
        type: dataset.type || '',
        absolute_relative_index: dataset.absolute_relative_index || '',
        category: dataset.category || '',
        subtype: dataset.subtype || '',
        is_derived: dataset.is_derived || false,
      });
    }
  }, [dataset]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('datasets')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim(),
          admin_level: formData.admin_level,
          type: formData.type,
          absolute_relative_index: formData.absolute_relative_index,
          category: formData.category,
          subtype: formData.subtype,
          is_derived: formData.is_derived,
        })
        .eq('id', dataset.id);

      if (updateError) throw updateError;

      await onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to update dataset:', err);
      setError(err.message || 'Error saving dataset');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !dataset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Edit Dataset</h2>

        {error && (
          <div className="bg-red-50 text-red-700 p-2 rounded mb-4 text-sm border border-red-200">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Level</label>
              <select
                name="admin_level"
                value={formData.admin_level}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                <option value="ADM1">ADM1</option>
                <option value="ADM2">ADM2</option>
                <option value="ADM3">ADM3</option>
                <option value="ADM4">ADM4</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                <option value="Numeric">Numeric</option>
                <option value="Categorical">Categorical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abs/Rel/Idx</label>
              <select
                name="absolute_relative_index"
                value={formData.absolute_relative_index}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                <option value="absolute">Absolute</option>
                <option value="relative">Relative</option>
                <option value="index">Index</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtype</label>
              <input
                type="text"
                name="subtype"
                value={formData.subtype}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              name="is_derived"
              checked={formData.is_derived}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label className="text-sm text-gray-700">Derived Dataset</label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
