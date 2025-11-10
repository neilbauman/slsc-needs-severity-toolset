'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DatasetTable from '@/components/DatasetTable';
import ViewDatasetModal from '@/components/ViewDatasetModal';
import EditDatasetModal from '@/components/EditDatasetModal';
import DeleteDatasetModal from '@/components/DeleteDatasetModal';
import DeriveDatasetModal from '@/components/DeriveDatasetModal';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [viewDataset, setViewDataset] = useState<any | null>(null);
  const [editDataset, setEditDataset] = useState<any | null>(null);
  const [deleteDataset, setDeleteDataset] = useState<any | null>(null);
  const [deriveDataset, setDeriveDataset] = useState(false);

  const loadDatasets = async () => {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setDatasets(data);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Datasets</h1>
        <button
          onClick={() => setDeriveDataset(true)}
          className="px-3 py-1 bg-green-600 text-white rounded-md text-sm"
        >
          + Derive Dataset
        </button>
      </div>

      <DatasetTable
        datasets={datasets}
        onEdit={setEditDataset}
        onView={setViewDataset}
        onDelete={setDeleteDataset}
      />

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
          onSave={loadDatasets}
        />
      )}

      {deleteDataset && (
        <DeleteDatasetModal
          dataset={deleteDataset}
          onClose={() => setDeleteDataset(null)}
          onDeleted={loadDatasets}
        />
      )}

      {deriveDataset && (
        <DeriveDatasetModal
          datasets={datasets}
          onClose={() => setDeriveDataset(false)}
          onDerived={loadDatasets}
        />
      )}
    </div>
  );
}
