'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export default function EditDatasetModal({
  dataset,
  onClose,
  onSave,
}: EditDatasetModalProps) {
  const [form, setForm] = useState({
    name: dataset.name || '',
    category: dataset.category || '',
    admin_level: dataset.admin_level || '',
    type: dataset.type || 'numeric',
    description: dataset.description || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from('datasets')
      .update({
        name: form.name,
        category: form.category,
        admin_level: form.admin_level,
        type: form.type,
        description: form.description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dataset.id);

    setSaving(false);
    if (error) {
      alert(`Error updating dataset: ${error.message}`);
    } else {
      await onSave();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Edit Dataset</h2>
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="block text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="Core">Core</option>
              <option value="SSC Framework - P1">SSC Framework - P1</option>
              <option value="SSC Framework - P2">SSC Framework - P2</option>
              <option value="SSC Framework - P3">SSC Framework - P3</option>
              <option value="Hazards">Hazards</option>
              <option value="Underlying Vulnerabilities">
                Underlying Vulnerabilities
              </option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Admin Level</label>
            <select
              value={form.admin_level}
              onChange={(e) => handleChange('admin_level', e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="ADM1">ADM1</option>
              <option value="ADM2">ADM2</option>
              <option value="ADM3">ADM3</option>
              <option value="ADM4">ADM4</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="numeric">Numeric</option>
              <option value="categorical">Categorical</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
