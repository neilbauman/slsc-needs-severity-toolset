'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Wand2, Eye, Trash2, PlusCircle } from 'lucide-react';
import CleanDatasetModal from '@/components/CleanDatasetModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
  created_at: string;
  is_cleaned: boolean;
  absolute_relative_index?: string | null;
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select(
        'id, name, type, admin_level, created_at, is_cleaned, absolute_relative_index'
      )
      .order('created_at', { ascending: false });

    if (!error && data) setDatasets(data);
    else console.error('Error loading datasets:', error);

    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Datasets
          </h1>
          <p className="text-sm text-gray-500">
            Manage raw, cleaned, and derived datasets.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/datasets/derive"
            className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
          >
            <PlusCircle className="w-4 h-4" /> Derived Dataset
          </Link>
          <Link
            href="/datasets/upload"
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <PlusCircle className="w-4 h-4" /> Upload Dataset
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Admin Level</th>
              <th className="px-3 py-2 text-left">Abs/Rel/Idx</th>
              <th className="px-3 py-2 text-left">Uploaded</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-gray-500"
                >
                  Loading datasets…
                </td>
              </tr>
            )}

            {!loading && datasets.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-gray-500"
                >
                  No datasets found.
                </td>
              </tr>
            )}

            {!loading &&
              datasets.map((ds) => (
                <tr
                  key={ds.id}
                  className="border-t hover:bg-gray-50 transition"
                >
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {ds.name}
                  </td>
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
                    {ds.absolute_relative_index || '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {new Date(ds.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    {ds.is_cleaned ? (
                      <span className="text-green-700 font-medium">
                        Cleaned
                      </span>
                    ) : (
                      <span className="text-red-700 font-medium">Raw</span>
                    )}
                  </td>
                  <td className="px-3 py-2 flex gap-3 items-center">
                    {!ds.is_cleaned && (
                      <button
                        onClick={() => setSelectedDataset(ds)}
                        className="text-amber-600 hover:text-amber-800"
                        title="Clean"
                      >
                        <Wand2 className="w-4 h-4" />
                      </button>
                    )}
                    <Link
                      href={`/datasets/raw/${ds.id}`}
                      className="text-blue-600 hover:text-blue-800"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
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
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
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
