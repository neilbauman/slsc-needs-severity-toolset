'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';

export default function RawDatasetPage() {
  const { dataset_id } = useParams();
  const datasetId = Array.isArray(dataset_id) ? dataset_id[0] : dataset_id;

  const [dataset, setDataset] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState(false);

  const loadDataset = async () => {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();
    if (error) console.error(error);
    else setDataset(data);
  };

  const loadValues = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('dataset_values_numeric')
      .select('*')
      .eq('dataset_id', datasetId)
      .limit(100);
    if (error) console.error(error);
    else setRows(data);
    setLoading(false);
  };

  const loadAll = async () => {
    await loadDataset();
    await loadValues();
  };

  useEffect(() => {
    if (datasetId) loadAll();
  }, [datasetId]);

  return (
    <div className="p-6">
      {dataset ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold">
              Raw Dataset: {dataset.name}
            </h1>
            <button
              onClick={() => setShowNumericModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Clean Dataset
            </button>
          </div>

          <div className="text-sm mb-6">
            <p>
              <strong>Admin Level:</strong> {dataset.admin_level}
            </p>
            <p>
              <strong>Type:</strong> {dataset.type}
            </p>
            <p>
              <strong>Rows:</strong> {rows.length}
            </p>
          </div>

          {loading ? (
            <p>Loading data…</p>
          ) : (
            <table className="w-full border text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-1">Admin Pcode</th>
                  <th className="border px-2 py-1">Admin Name</th>
                  <th className="border px-2 py-1">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="border px-2 py-1">{r.admin_pcode}</td>
                    <td className="border px-2 py-1">{r.admin_name}</td>
                    <td className="border px-2 py-1">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {showNumericModal && (
            <CleanNumericDatasetModal
              open={showNumericModal}
              dataset={dataset}
              onClose={() => setShowNumericModal(false)}
              onSaved={loadAll}
            />
          )}
        </>
      ) : (
        <p>Loading dataset metadata…</p>
      )}
    </div>
  );
}
