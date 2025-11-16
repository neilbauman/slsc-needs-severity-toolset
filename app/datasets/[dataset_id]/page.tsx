'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import EditDatasetModal from '@/components/EditDatasetModal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DatasetDetailPage({ params }) {
  const { dataset_id } = params;
  const [dataset, setDataset] = useState(null);
  const [dataPreview, setDataPreview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    loadDataset();
  }, [dataset_id]);

  const loadDataset = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', dataset_id)
      .single();

    if (!error && data) {
      setDataset(data);
      if (data.is_derived || data.is_cleaned) await loadPreview(data.id);
    }
    setLoading(false);
  };

  const loadPreview = async (id: string) => {
    const { data } = await supabase
      .from('dataset_values_numeric')
      .select('admin_pcode, admin_name, value')
      .eq('dataset_id', id)
      .limit(50);
    setDataPreview(data || []);
  };

  if (loading) return <div className="p-6 text-gray-600">Loading dataset…</div>;
  if (!dataset) return <div className="p-6 text-red-600">Dataset not found.</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">{dataset.name}</h1>
        <button
          onClick={() => setShowEdit(true)}
          className="bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
        >
          Edit
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p><span className="font-medium">Admin Level:</span> {dataset.admin_level}</p>
          <p><span className="font-medium">Type:</span> {dataset.type}</p>
          <p><span className="font-medium">Derived:</span> {dataset.is_derived ? 'Yes' : 'No'}</p>
          <p><span className="font-medium">Cleaned:</span> {dataset.is_cleaned ? 'Yes' : 'No'}</p>
        </div>
        <div>
          <p><span className="font-medium">Created At:</span> {new Date(dataset.created_at).toLocaleString()}</p>
          <p><span className="font-medium">Description:</span> {dataset.description || '—'}</p>
        </div>
      </div>

      {(dataset.is_derived || dataset.is_cleaned) && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Data Preview</h2>
          <table className="w-full border text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-3 py-2 text-left">Admin Pcode</th>
                <th className="border px-3 py-2 text-left">Admin Name</th>
                <th className="border px-3 py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {dataPreview.map((r) => (
                <tr key={r.admin_pcode}>
                  <td className="border px-3 py-2">{r.admin_pcode}</td>
                  <td className="border px-3 py-2">{r.admin_name}</td>
                  <td className="border px-3 py-2 text-right">{r.value?.toLocaleString()}</td>
                </tr>
              ))}
              {dataPreview.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-gray-500">
                    No preview data found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <EditDatasetModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        dataset={dataset}
        onSaved={loadDataset}
      />
    </div>
  );
}
