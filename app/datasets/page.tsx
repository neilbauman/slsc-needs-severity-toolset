'use client';

import React, { useEffect, useState } from 'react';
import { Edit, Brush } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import EditDatasetModal from '@/components/EditDatasetModal';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import Link from 'next/link';

interface Dataset {
  id: string;
  name: string;
  description?: string;
  type: string;
  created_at?: string;
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
    if (error) console.error('Error loading datasets:', error);
    else setDatasets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-gray-600 text-center">
        Loading datasets...
      </div>
    );
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
            })
          }
        >
          New Dataset
        </button>
      </div>

      {/* Table */}
      {datasets.length === 0 ? (
        <p className="text-gray-500 text-center mt-10">
          No datasets found.
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2 border-b">Name</th>
                <th className="px-3 py-2 border-b">Type</th>
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
                  <td className="px-3 py-2 border-b capitalize text-gray-700">
                    {dataset.type}
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
                        <Edit size={16} />
                      </button>
                      {dataset.type === 'numeric' && (
                        <button
                          title="Clean dataset"
                          onClick={() => setCleanDataset(dataset)}
                          className="p-1.5 rounded bg-yellow-500 text-white hover:bg-yellow-600"
                        >
                          <Brush size={16} />
                        </button>
                      )}
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
