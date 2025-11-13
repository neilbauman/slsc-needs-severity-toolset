'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import UploadDatasetModal from '@/components/UploadDatasetModal';

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
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadDatasets = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, type, admin_level, created_at, is_cleaned')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDatasets(data as Dataset[]);
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

        <button
          onClick={() => setUploadOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Upload Dataset
        </button>
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

      {/* Table */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-3 py-2 border-b text-left">Name</th>
              <th className="px-3 py-2 border-b text-left">Type</th>
              <th className="px-3 py-2 border-b text-left">Admin Level</th>
              <th className="px-3 py-2 border-b text-left">Uploaded</th>
              <th className="px-3 py-2 border-b text-left">Cleaned?</th>
              <th className="px-3 py-2 border-b text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center">
                  Loading…
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
                  <td className="px-3 py-2 capitalize">{ds.type}</td>
                  <td className="px-3 py-2">{ds.admin_level}</td>
                  <td className="px-3 py-2">
                    {new Date(ds.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    {ds.is_cleaned ? (
                      <span className="text-green-700 font-medium">Yes</span>
                    ) : (
                      <span className="text-red-700 font-medium">No</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/datasets/raw/${ds.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View Raw →
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
