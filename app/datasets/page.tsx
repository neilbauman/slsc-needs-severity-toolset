'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PlusCircle, Eye, Trash2, Pencil, Wand2 } from 'lucide-react';
import UploadDatasetModal from '@/components/UploadDatasetModal';
import DeriveDatasetModal from '@/components/DeriveDatasetModal';
import EditDatasetModal from '@/components/EditDatasetModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
  created_at: string;
  is_cleaned: boolean;
  absolute_relative_index: 'absolute' | 'relative' | 'index';
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deriveOpen, setDeriveOpen] = useState(false);
  const [editDataset, setEditDataset] = useState<Dataset | null>(null);

  const loadDatasets = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('datasets')
      .select(
        'id, name, type, admin_level, created_at, is_cleaned, absolute_relative_index'
      )
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDatasets(data as Dataset[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return;
    const { error } = await supabase.from('datasets').delete().eq('id', id);
    if (error) alert('Failed to delete dataset');
    else loadDatasets();
  };

  const handleClean = (id: string, type: string) => {
    if (type === 'numeric') {
      window.location.href = `/datasets/raw/${id}`;
    } else {
      window.location.href = `/datasets/raw/${id}?type=categorical`;
    }
  };

  const badgeColor = (status: string) => {
    switch (status) {
      case 'absolute':
        return 'bg-blue-100 text-blue-800';
      case 'relative':
        return 'bg-green-100 text-green-800';
      case 'index':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const cleanedStatus = (isCleaned: boolean) =>
    isCleaned ? (
      <span className="text-green-700 font-medium">Cleaned</span>
    ) : (
      <span className="text-red-700 font-medium">Raw</span>
    );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Datasets</h1>
          <p className="text-gray-500 text-sm">
            Manage raw, cleaned, and derived datasets.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setDeriveOpen(true)}
            className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm font-medium"
          >
            <PlusCircle size={16} /> Derived Dataset
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1 px-3 py-2 bg-[var(--ssc-blue)] text-white rounded hover:bg-blue-800 text-sm font-medium"
          >
            <PlusCircle size={16} /> Upload Dataset
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

      {/* Derived Modal */}
      {deriveOpen && (
        <DeriveDatasetModal
          onClose={() => setDeriveOpen(false)}
          onCreated={loadDatasets}
        />
      )}

      {/* Edit Modal */}
      {editDataset && (
        <EditDatasetModal
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSave={loadDatasets}
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-3 py-2 border-b text-left">Name</th>
              <th className="px-3 py-2 border-b text-left">Type</th>
              <th className="px-3 py-2 border-b text-left">Admin Level</th>
              <th className="px-3 py-2 border-b text-left">Abs/Rel/Idx</th>
              <th className="px-3 py-2 border-b text-left">Uploaded</th>
              <th className="px-3 py-2 border-b text-left">Status</th>
              <th className="px-3 py-2 border-b text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && datasets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  No datasets found.
                </td>
              </tr>
            )}

            {!loading &&
              datasets.map((ds) => (
                <tr key={ds.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {ds.name}
                  </td>
                  <td className="px-3 py-2 capitalize">{ds.type}</td>
                  <td className="px-3 py-2">{ds.admin_level}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${badgeColor(
                        ds.absolute_relative_index
                      )}`}
                    >
                      {ds.absolute_relative_index}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {new Date(ds.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{cleanedStatus(ds.is_cleaned)}</td>
                  <td className="px-3 py-2 flex gap-2 items-center">
                    <button
                      onClick={() => setEditDataset(ds)}
                      className="text-gray-600 hover:text-[var(--ssc-blue)]"
                      title="Edit metadata"
                    >
                      <Pencil size={16} />
                    </button>
                    {!ds.is_cleaned && (
                      <button
                        onClick={() => handleClean(ds.id, ds.type)}
                        className="text-gray-600 hover:text-amber-600"
                        title="Clean dataset"
                      >
                        <Wand2 size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => (window.location.href = `/datasets/raw/${ds.id}`)}
                      className="text-gray-600 hover:text-[var(--ssc-blue)]"
                      title="View dataset"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(ds.id)}
                      className="text-gray-600 hover:text-red-600"
                      title="Delete dataset"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
