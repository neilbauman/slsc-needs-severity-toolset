'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Dataset = {
  id: string;
  name: string;
};

export default function DeriveDatasetModal({ onClose, onCreated }: any) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [formula, setFormula] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('datasets')
        .select('id, name')
        .order('created_at', { ascending: false });
      if (!error && data) setDatasets(data);
    };
    load();
  }, []);

  const handleCreate = async () => {
    if (!selected.length || !newName) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('create_derived_dataset', {
      base_dataset_ids: selected,
      formula,
      new_name: newName,
    });
    setLoading(false);
    if (error) {
      console.error('Error creating derived dataset:', error);
    } else {
      onCreated();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 shadow-lg max-w-md w-full">
        <h2 className="text-lg font-semibold mb-3">Create Derived Dataset</h2>

        {/* Dataset Selection */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Base Datasets
        </label>
        <div className="border rounded p-2 max-h-32 overflow-y-auto mb-3">
          {datasets.map((ds) => (
            <label key={ds.id} className="flex items-center text-sm gap-2">
              <input
                type="checkbox"
                value={ds.id}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelected((prev) =>
                    prev.includes(val)
                      ? prev.filter((v) => v !== val)
                      : [...prev, val]
                  );
                }}
                checked={selected.includes(ds.id)}
              />
              {ds.name}
            </label>
          ))}
        </div>

        {/* Formula Input */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Formula (optional)
        </label>
        <input
          type="text"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="e.g., dataset1 + dataset2 / 2"
          className="w-full border rounded p-2 text-sm mb-3"
        />

        {/* New Name */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          New Dataset Name
        </label>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Enter new dataset name"
          className="w-full border rounded p-2 text-sm mb-3"
        />

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-3 py-1.5 rounded text-sm font-medium bg-[var(--ssc-blue)] hover:bg-blue-800 text-white"
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
