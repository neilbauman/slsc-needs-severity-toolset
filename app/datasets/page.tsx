'use client';

import React, { useEffect, useState } from 'react';
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Datasets</h1>
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

      {datasets.length === 0 ? (
        <p className="text-gray-500 text-center mt-10">
          No datasets found.
        </p>
      ) : (
        <table className="w-full border rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-100 text-left">
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
                  <Link href={`/datasets/${dataset.id}`}>
                    {dataset.name}
                  </Link>
                </td>
                <td className="px-3 py-2 border-b capitalize">
                  {dataset.type}
                </td>
                <td className="px-3 py-2 border-b">
                  {dataset.description || '—'}
                </td>
                <td className="px-3 py-2 border-b text-gray-500 text-xs">
                  {dataset.created_at
                    ? new Date(dataset.created_at).toLocaleString()
                    : ''}
                </td>
                <td className="px-3 py-2 border-b text-right space-x-2">
                  <button
                    onClick={() => setEditDataset(dataset)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  {dataset.type === 'numeric' && (
                    <button
                      onClick={() => setCleanDataset(dataset)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      Clean
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
