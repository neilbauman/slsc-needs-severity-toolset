'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import DatasetTable from '@/components/DatasetTable';
import ViewDatasetModal from '@/components/ViewDatasetModal';
import EditDatasetModal from '@/components/EditDatasetModal';
import DeleteDatasetModal from '@/components/DeleteDatasetModal';
import UploadDatasetModal from '@/components/UploadDatasetModal';
import DeriveDatasetModal from '@/components/DeriveDatasetModal';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [viewDataset, setViewDataset] = useState<any>(null);
  const [editDataset, setEditDataset] = useState<any>(null);
  const [deleteDataset, setDeleteDataset] = useState<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeriveModal, setShowDeriveModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setDatasets(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  // Group datasets by category
  const grouped = datasets.reduce((acc: any, d) => {
    const key = d.category || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Datasets</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              Upload Dataset
            </button>
            <button
              onClick={() => setShowDeriveModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Derive Dataset
            </button>
          </div>
        </div>

        {/* Dataset Groups */}
        {loading ? (
          <p className="text-gray-500">Loading datasets...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-gray-500 italic">No datasets found.</p>
        ) : (
          Object.keys(grouped).map((cat) => (
            <div key={cat} className="mb-6">
              <h2 className="text-lg font-medium mb-2 border-b pb-1">{cat}</h2>
              <DatasetTable
                datasets={grouped[cat]}
                onEdit={setEditDataset}
                onView={setViewDataset}
                onDelete={setDeleteDataset}
              />
            </div>
          ))
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadDatasetModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={loadDatasets}
        />
      )}

      {/* Derive Modal */}
      {showDeriveModal && (
        <DeriveDatasetModal
          onClose={() => setShowDeriveModal(false)}
          onDerived={loadDatasets}
        />
      )}

      {/* Edit Modal */}
      {editDataset && (
        <EditDatasetModal
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSaved={loadDatasets}
        />
      )}

      {/* View Modal */}
      {viewDataset && (
        <ViewDatasetModal
          dataset={viewDataset}
          onClose={() => setViewDataset(null)}
        />
      )}

      {/* Delete Modal */}
      {deleteDataset && (
        <DeleteDatasetModal
          dataset={deleteDataset}
          onClose={() => setDeleteDataset(null)}
          onDeleted={loadDatasets}
        />
      )}
    </div>
  );
}
