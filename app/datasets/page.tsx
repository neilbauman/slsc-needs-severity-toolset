'use client';

import React, { useEffect, useState } from 'react';
import { Pencil, Broom, Trash2 } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import Link from 'next/link';
import EditDatasetModal from '@/components/EditDatasetModal';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';

interface Dataset {
  id: string;
  name: string;
  type: string;
  description?: string;
  created_at?: string;
  admin_level?: string;
  absolute_relative_index?: string;
  is_derived?: boolean;
  is_cleaned?: boolean;
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDataset, setEditDataset] = useState<Dataset | null>(null);
  const [cleanDataset, setCleanDataset] = useState<Dataset | null>(null);

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

  const handleDelete = async (dataset: Dataset) => {
    if (!confirm(`Delete dataset "${dataset.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('datasets').delete().eq('id', dataset.id);
    if (error) {
      console.error('Error deleting dataset:', error);
      alert('Failed to delete dataset.');
    } else {
      setDatasets((prev) => prev.filter((d) => d.id !== dataset.id));
    }
  };

  const badge = (text?: string, color?: string) => {
    if (!text) return null;
    const colors: Record<string, string> = {
      indigo: 'bg-indigo-100 text-indigo-700',
      green: 'bg-green-100 text-green-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      blue: 'bg-blue-100 text-blue-700',
      gray: 'bg-gray-100 text-gray-700',
      violet: 'bg-violet-100 text-violet-700',
      emerald: 'bg-emerald-100 text-emerald-700',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${colors[color || 'gray']}`}
      >
        {text}
      </span>
    );
  };

  if (loading) {
    return <div className="p-6 text-gray-600 text-center">Loading datasets...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Datasets</h1>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          onClick={() =>
            setEditDataset({
              id: '',
              name: '',
              type: 'numeric',
              description: '',
              admin_level: '',
              absolute_relative_index: '',
            })
          }
        >
          New Dataset
        </button>
      </div>

      {/* Table */}
      {datasets.length === 0 ? (
        <p className="text-gray-500 text-center mt-10">No datasets found.</p>
      ) : (
        <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2 border-b">Name</th>
                <th className="px-3 py-2 border-b">Type</th>
                <th className="px-3 py-2 border-b">Admin Level</th>
                <th className="px-3 py-2 border-b">Index Type</th>
                <th className="px-3 py-2 border-b">Description</th>
                <th className="px-3 py-2 border-b">Created</th>
                <th className="px-3 py-2 border-b text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((dataset) => (
                <tr key={dataset.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border-b font-medium text-blue-700">
                    <Link
                      href={`/datasets/${dataset.id}`}
                      className="hover:underline"
                    >
                      {dataset.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 border-b text-gray-700 capitalize">
                    {dataset.type}
                  </td>
                  <td className="px-3 py-2 border-b">
                    {badge(dataset.admin_level?.toUpperCase(), 'indigo')}
                  </td>
                  <td className="px-3 py-2 border-b">
                    {dataset.absolute_relative_index === 'absolute' &&
                      badge('Absolute', 'green')}
                    {dataset.absolute_relative_index === 'relative' &&
                      badge('Relative', 'yellow')}
                    {dataset.absolute_relative_index === 'index' &&
                      badge('Index', 'blue')}
                  </td>
                  <td className="px-3 py-2 border-b text-gray-600">
                    {dataset.description || '—'}
                  </td>
                  <td className="px-3 py-2 border-b text-gray-500 text-xs">
                    {dataset.created_at
                      ? new Date(dataset.created_at).toLocaleString()
                      : ''}
                  </td>
                  <td className="px-3 py-2 border-b text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        title="Edit dataset"
                        onClick={() => setEditDataset(dataset)}
                        className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Pencil size={16} />
                      </button>
                      {dataset.type === 'numeric' && (
                        <button
                          title="Clean dataset"
                          onClick={() => setCleanDataset(dataset)}
                          className="p-1.5 rounded bg-yellow-500 text-white hover:bg-yellow-600"
                        >
                          <Broom size={16} />
                        </button>
                      )}
                      <button
                        title="Delete dataset"
                        onClick={() => handleDelete(dataset)}
                        className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {editDataset && (
        <EditDatasetModal
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSaved={loadDatasets}
        />
      )}

      {cleanDataset && (
        <CleanNumericDatasetModal
          dataset={cleanDataset}
          onClose={() => setCleanDataset(null)}
          onCleaned={loadDatasets}
        />
      )}
    </div>
  );
}
