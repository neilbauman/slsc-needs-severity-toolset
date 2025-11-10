'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import UploadDatasetModal from '@/components/UploadDatasetModal';
import DeriveDatasetModal from '@/components/DeriveDatasetModal';
import EditDatasetModal from '@/components/EditDatasetModal';
import ViewDatasetModal from '@/components/ViewDatasetModal';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeriveModal, setShowDeriveModal] = useState(false);
  const [viewDataset, setViewDataset] = useState<any | null>(null);
  const [editDataset, setEditDataset] = useState<any | null>(null);

  // Load all datasets
  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    else setDatasets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const grouped = datasets.reduce((acc: any, ds: any) => {
    const cat = ds.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ds);
    return acc;
  }, {});

  const orderedCategories = [
    'Core',
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Hazards',
    'Underlying Vulnerabilities',
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Datasets</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
            >
              Upload Dataset
            </button>
            <button
              onClick={() => setShowDeriveModal(true)}
              className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-green-700"
            >
              Derive Dataset
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading datasets...</p>
        ) : datasets.length === 0 ? (
          <p className="text-gray-500 text-sm">No datasets available.</p>
        ) : (
          orderedCategories.map((cat) => {
            const items = grouped[cat] || [];
            if (items.length === 0) return null;
            return (
              <div key={cat} className="mb-8">
                <h2 className="text-lg font-semibold mb-3">{cat}</h2>
                <div className="overflow-x-auto border rounded-md bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Admin Level</th>
                        <th className="px-3 py-2 text-left">Created</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((ds: any) => (
                        <tr
                          key={ds.id}
                          className="border-t hover:bg-gray-50 transition"
                        >
                          <td className="px-3 py-2">{ds.name}</td>
                          <td className="px-3 py-2 capitalize">{ds.type}</td>
                          <td className="px-3 py-2">{ds.admin_level}</td>
                          <td className="px-3 py-2">
                            {new Date(ds.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => setViewDataset(ds)}
                              className="text-blue-600 hover:underline text-sm mr-3"
                            >
                              View
                            </button>
                            <button
                              onClick={() => setEditDataset(ds)}
                              className="text-yellow-600 hover:underline text-sm mr-3"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showUploadModal && (
        <UploadDatasetModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={loadDatasets}
        />
      )}

      {showDeriveModal && (
        <DeriveDatasetModal
          datasets={datasets}
          onClose={() => setShowDeriveModal(false)}
          onDerived={loadDatasets}
        />
      )}

      {viewDataset && (
        <ViewDatasetModal
          dataset={viewDataset}
          onClose={() => setViewDataset(null)}
        />
      )}

      {editDataset && (
        <EditDatasetModal
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSaved={loadDatasets}
        />
      )}
    </div>
  );
}
