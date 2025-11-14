'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import UploadDatasetModal from '@/components/UploadDatasetModal';
import DeriveDatasetModal from '@/components/DeriveDatasetModal';
import { PlusCircleIcon } from 'lucide-react';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
  created_at: string;
  is_cleaned: boolean;
  is_derived?: boolean;
  value_type: 'absolute' | 'relative';
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deriveOpen, setDeriveOpen] = useState(false);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select(
        'id, name, type, admin_level, created_at, is_cleaned, is_derived, value_type'
      )
      .order('created_at', { ascending: false });

    if (!error && data) setDatasets(data as Dataset[]);
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">
          Manage Datasets
        </h1>

        <div className="flex gap-2">
          <button
            onClick={() => setUploadOpen(true)}
            className="bg-[var(--ssc-blue)] hover:bg-blue-800 text-white text-sm font-medium px-3 py-1.5 rounded flex items-center gap-1"
          >
            <PlusCircleIcon className="w-4 h-4" /> Upload Dataset
          </button>

          <button
            onClick={() => setDeriveOpen(true)}
            className="bg-[var(--ssc-yellow)] hover:bg-yellow-500 text-black text-sm font-medium px-3 py-1.5 rounded flex items-center gap-1"
          >
            <PlusCircleIcon className="w-4 h-4" /> Create Derived Dataset
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {uploadOpen && (
        <UploadDatasetModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            loadDatasets();
          }}
        />
      )}

      {/* Derived Dataset Modal */}
      {deriveOpen && (
        <DeriveDatasetModal
          onClose={() => setDeriveOpen(false)}
          onCreated={() => {
            setDeriveOpen(false);
            loadDatasets();
          }}
        />
      )}

      {/* Dataset Table */}
      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-3 py-2 border-b text-left">Name</th>
              <th className="px-3 py-2 border-b text-left">Type</th>
              <th className="px-3 py-2 border-b text-left">Value Type</th>
              <th className="px-3 py-2 border-b text-left">Admin Level</th>
              <th className="px-3 py-2 border-b text-left">Cleaned?</th>
              <th className="px-3 py-2 border-b text-left">Origin</th>
              <th className="px-3 py-2 border-b text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  Loading datasets…
                </td>
              </tr>
            )}

            {!loading && datasets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  No datasets uploaded yet.
                </td>
              </tr>
            )}

            {!loading &&
              datasets.map((ds) => (
                <tr key={ds.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {ds.name}
                  </td>

                  {/* Type */}
                  <td className="px-3 py-2 capitalize">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ds.type === 'numeric'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {ds.type}
                    </span>
                  </td>

                  {/* Value Type */}
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ds.value_type === 'absolute'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {ds.value_type}
                    </span>
                  </td>

                  {/* Admin Level */}
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                      {ds.admin_level || 'N/A'}
                    </span>
                  </td>

                  {/* Cleaned */}
                  <td className="px-3 py-2">
                    {ds.is_cleaned ? (
                      <span className="text-green-700 font-medium">Yes</span>
                    ) : (
                      <span className="text-red-700 font-medium">No</span>
                    )}
                  </td>

                  {/* Origin */}
                  <td className="px-3 py-2">
                    {ds.is_derived ? (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                        Derived
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        Raw
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2 space-x-2">
                    <Link
                      href={`/datasets/${ds.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </Link>
                    {!ds.is_cleaned && (
                      <Link
                        href={`/datasets/raw/${ds.id}`}
                        className="text-yellow-700 hover:text-yellow-900 font-medium"
                      >
                        Clean
                      </Link>
                    )}
                    <Link
                      href={`/datasets/delete/${ds.id}`}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
