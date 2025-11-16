'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, Wand2 } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import EditDatasetModal from '@/components/EditDatasetModal';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDataset, setEditingDataset] = useState<any | null>(null);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading datasets:', error);
    } else {
      setDatasets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return;
    const { error } = await supabase.from('datasets').delete().eq('id', id);
    if (error) {
      console.error('Error deleting dataset:', error);
      alert('Failed to delete dataset.');
    } else {
      loadDatasets();
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Datasets</h1>
        <Link
          href="/datasets/new"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          New Dataset
        </Link>
      </div>

      {loading ? (
        <p>Loading datasets...</p>
      ) : (
        <div className="bg-white rounded shadow">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-left">
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Source</th>
                <th className="p-3 font-semibold">Description</th>
                <th className="p-3 font-semibold">Created</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <Link
                      href={`/datasets/raw/${d.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {d.name}
                    </Link>
                  </td>
                  <td className="p-3">{d.type}</td>

                  {/* Source column: Raw vs Derived */}
                  <td className="p-3">
                    {d.is_derived ? (
                      <span className="inline-block px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 font-medium">
                        Derived
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 font-medium">
                        Raw
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-gray-700">
                    {d.description || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="p-3 text-gray-500">
                    {d.created_at
                      ? new Date(d.created_at).toLocaleString()
                      : '—'}
                  </td>

                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => setEditingDataset(d)}
                      title="Edit dataset"
                      className="inline-flex items-center justify-center p-2 rounded bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      title="Delete dataset"
                      className="inline-flex items-center justify-center p-2 rounded bg-red-500 hover:bg-red-600 text-white"
                    >
                      <Trash2 size={16} />
                    </button>
                    {d.type === 'numeric' && (
                      <button
                        title="Clean numeric dataset"
                        className="inline-flex items-center justify-center p-2 rounded bg-yellow-400 hover:bg-yellow-500 text-white"
                      >
                        <Wand2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {datasets.length === 0 && (
            <p className="text-gray-500 text-sm p-4 text-center">
              No datasets found.
            </p>
          )}
        </div>
      )}

      {editingDataset && (
        <EditDatasetModal
          dataset={editingDataset}
          onClose={() => setEditingDataset(null)}
          onSaved={loadDatasets}
        />
      )}
    </div>
  );
}
