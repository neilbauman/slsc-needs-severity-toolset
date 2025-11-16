'use client';

import React, { useState, useEffect } from 'react';
import supabase from '@/lib/supabaseClient';

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function EditDatasetModal({ dataset, onClose, onSaved }: EditDatasetModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source: '',
    license: '',
    tags: '',
    is_public: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dataset) {
      setFormData({
        name: dataset.name || '',
        description: dataset.description || '',
        source: dataset.source || '',
        license: dataset.license || '',
        tags: dataset.tags || '',
        is_public: dataset.is_public || false,
      });
    }
  }, [dataset]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const { name, value, type } = target;
    const checked = (target as HTMLInputElement).checked ?? false;

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('datasets')
      .update({
        name: formData.name,
        description: formData.description,
        source: formData.source,
        license: formData.license,
        tags: formData.tags,
        is_public: formData.is_public,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dataset.id);

    setLoading(false);

    if (error) {
      console.error(error);
      alert('Failed to update dataset.');
    } else {
      await onSaved();
      onClose();
    }
  };

  if (!dataset) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Edit Dataset</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="source">
              Source
            </label>
            <input
              id="source"
              name="source"
              value={formData.source}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="license">
              License
            </label>
            <input
              id="license"
              name="license"
              value={formData.license}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="tags">
              Tags
            </label>
            <input
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="is_public"
              name="is_public"
              type="checkbox"
              checked={formData.is_public}
              onChange={handleChange}
            />
            <label htmlFor="is_public" className="text-sm">
              Publicly Visible
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
