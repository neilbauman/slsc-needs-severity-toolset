'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onSave: () => void;
}

export default function EditDatasetModal({
  dataset,
  onClose,
  onSave,
}: EditDatasetModalProps) {
  const [name, setName] = useState(dataset.name || '');
  const [category, setCategory] = useState(dataset.category || '');
  const [type, setType] = useState(dataset.type || 'numeric');
  const [adminLevel, setAdminLevel] = useState(dataset.admin_level || '');
  const [description, setDescription] = useState(dataset.description || '');
  const [saving, setSaving] = useState(false);

  const categories = [
    'Core',
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Hazards',
    'Underlying Vulnerability',
  ];

  const adminLevels = ['ADM2', 'ADM3', 'ADM4'];
  const types = ['numeric', 'categorical'];

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('datasets')
      .update({
        name,
        category,
        type,
        admin_level: adminLevel,
        description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dataset.id);

    setSaving(false);

    if (error) {
      console.error('Error updating dataset:', error);
      alert('Failed to update dataset.');
    } else {
      onSave();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Edit Dataset
        </h2>

        <div className="space-y-4">
          {/* Dataset Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-blue-200"
              placeholder="Dataset name"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-blue-200"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-blue-200"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Admin Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Level
            </label>
            <select
              value={adminLevel}
              onChange={(e) => setAdminLevel(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-blue-200"
            >
              <option value="">Select admin level</option>
              {adminLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-blue-200"
              placeholder="Describe the dataset..."
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
