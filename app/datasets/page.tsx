'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import CleanDatasetModal from '@/components/CleanDatasetModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
  created_at: string;
  is_cleaned: boolean;
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, type, admin_level, created_at, is_cleaned')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDatasets(data as Dataset[]);
    } else {
      console.error('Error loading datasets:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800">
          Datasets
        </h1>
        <Link
          href="/datasets/upload"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Upload Dataset
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-3 py-2 border-b text-left">Name</th>
              <th className="px-3 py-2 border-b text-left">Type</th>
              <th className="px-3 py-2 border-b text-left">Admin Level</th>
              <th className="px-3 py-2 border-b text-left">Uploaded</th>
              <th className="px-3 py-2 border-b text-left">Status</th>
              <th className="px-3 py-2 border-b text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  Loading datasets…
                </td>
              </tr>
            )}

            {!loading && datasets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  No datasets uploaded yet.
                </td>
              </tr>
            )}

            {!loading &&
              datasets.map((ds) => (
                <tr key={ds.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{ds.name}</td>
                  <td className="px-3 py-2 capitalize">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        ds.type === 'numeric'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {ds.type}
                    </span>
                  </td>
                  <td className="px-3 py-2">{ds.admin_level}</td>
                  <td className="px-3 py-2">
                    {new Date(ds.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    {ds.is_cleaned ? (
                      <span className="text-green-700 font-medium">Cleaned</span>
                    ) : (
                      <span className="text-red-700 font-medium">Raw</span>
                    )}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    {!ds.is_cleaned && (
                      <button
                        onClick={() => setSelectedDataset(ds)}
                        className="px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600"
                      >
                        Clean
                      </button>
                    )}
                    <Link
                      href={`/datasets/raw/${ds.id}`}
                      className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      View
                    </Link>
                    <button
                      onClick={async () => {
                        if (
                          confirm(
                            `Are you sure you want to delete dataset "${ds.name}"?`
                          )
                        ) {
                          const { error } = await supabase
                            .from('datasets')
                            .delete()
                            .eq('id', ds.id);
                          if (!error) loadDatasets();
                        }
                      }}
                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selectedDataset && (
        <CleanDatasetModal
          dataset={selectedDataset}
          onClose={() => setSelectedDataset(null)}
          onCleaned={loadDatasets}
        />
      )}
    </div>
  );
}
