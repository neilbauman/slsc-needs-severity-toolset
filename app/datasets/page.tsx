'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DeriveDatasetModal from '@/components/DeriveDatasetModal';
import EditDatasetModal from '@/components/EditDatasetModal';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deriveOpen, setDeriveOpen] = useState(false);
  const [editDataset, setEditDataset] = useState<any | null>(null);
  const [cleanDataset, setCleanDataset] = useState<any | null>(null);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setDatasets(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Datasets</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setDeriveOpen(true)}
            className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600"
          >
            + Derived Dataset
          </button>
          <button
            onClick={() => (window.location.href = '/upload')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Upload Dataset
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading datasets...</p>
      ) : (
        <table className="w-full border text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Type</th>
              <th className="border px-2 py-1">Admin Level</th>
              <th className="border px-2 py-1">Abs/Rel/Idx</th>
              <th className="border px-2 py-1">Uploaded</th>
              <th className="border px-2 py-1">Status</th>
              <th className="border px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((d) => (
              <tr key={d.id}>
                <td className="border px-2 py-1 font-medium">{d.name}</td>
                <td className="border px-2 py-1 capitalize">{d.type}</td>
                <td className="border px-2 py-1">{d.admin_level}</td>
                <td className="border px-2 py-1 text-center">
                  {d.absolute_relative_index || '-'}
                </td>
                <td className="border px-2 py-1">
                  {new Date(d.created_at).toLocaleDateString()}
                </td>
                <td
                  className={`border px-2 py-1 font-medium ${
                    d.is_cleaned ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {d.is_cleaned ? 'Cleaned' : 'Raw'}
                </td>
                <td className="border px-2 py-1 text-center">
                  <button
                    onClick={() => setEditDataset(d)}
                    className="text-blue-600 hover:underline mr-2"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => setCleanDataset(d)}
                    className="text-amber-600 hover:underline mr-2"
                  >
                    🧹
                  </button>
                  <button
                    onClick={() => alert('Delete not implemented')}
                    className="text-red-600 hover:underline"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {deriveOpen && (
        <DeriveDatasetModal
          open={deriveOpen}
          onOpenChange={setDeriveOpen}
          onSaved={loadDatasets}
        />
      )}

      {editDataset && (
        <EditDatasetModal
          open={!!editDataset}
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSaved={loadDatasets}
        />
      )}

      {cleanDataset && (
        <CleanNumericDatasetModal
          open={!!cleanDataset}
          dataset={cleanDataset}
          onClose={() => setCleanDataset(null)}
          onSaved={loadDatasets}
        />
      )}
    </div>
  );
}
