'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import EditDatasetModal from '@/components/EditDatasetModal';
import DeriveDatasetModal from '@/components/DeriveDatasetModal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDataset, setEditDataset] = useState<any | null>(null);
  const [deriveOpen, setDeriveOpen] = useState(false);

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setDatasets(data);
    setLoading(false);
  };

  const handleView = (dataset: any) => {
    if (dataset.is_cleaned || dataset.is_derived) {
      window.location.href = `/datasets/${dataset.id}`;
    } else {
      window.location.href = `/datasets/raw/${dataset.id}`;
    }
  };

  if (loading) return <div className="p-6 text-gray-600">Loading datasets…</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Datasets</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setDeriveOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + New Derived Dataset
          </button>
        </div>
      </div>

      <table className="w-full border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="border px-3 py-2 text-left">Name</th>
            <th className="border px-3 py-2 text-left">Admin Level</th>
            <th className="border px-3 py-2 text-left">Type</th>
            <th className="border px-3 py-2 text-left">Status</th>
            <th className="border px-3 py-2 text-left">Created At</th>
            <th className="border px-3 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50">
              <td className="border px-3 py-2">{d.name}</td>
              <td className="border px-3 py-2">{d.admin_level}</td>
              <td className="border px-3 py-2">{d.type || '—'}</td>
              <td className="border px-3 py-2">
                {d.is_derived
                  ? 'Derived'
                  : d.is_cleaned
                  ? 'Cleaned'
                  : 'Raw'}
              </td>
              <td className="border px-3 py-2">
                {new Date(d.created_at).toLocaleString()}
              </td>
              <td className="border px-3 py-2 text-center space-x-2">
                <button
                  onClick={() => handleView(d)}
                  className="px-3 py-1 bg-blue-100 rounded hover:bg-blue-200"
                >
                  View
                </button>
                <button
                  onClick={() => setEditDataset(d)}
                  className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
          {datasets.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="text-center py-4 text-gray-500"
              >
                No datasets found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editDataset && (
        <EditDatasetModal
          open={!!editDataset}
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSaved={loadDatasets}
        />
      )}

      {deriveOpen && (
        <DeriveDatasetModal
          open={deriveOpen}
          onOpenChange={setDeriveOpen}
          onSaved={loadDatasets}
        />
      )}
    </div>
  );
}
