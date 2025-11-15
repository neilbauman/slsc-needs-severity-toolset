'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';
import { Loader2 } from 'lucide-react';

export default function RawDatasetPage({ params }: { params: { dataset_id: string } }) {
  const datasetId = params.dataset_id;
  const [dataset, setDataset] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState(false);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);

  // ────────────────────────────────────────────────
  // Load dataset and its raw rows
  // ────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);

    const { data: ds, error: dsErr } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (dsErr) {
      console.error('Error loading dataset:', dsErr);
      setDataset(null);
      setRows([]);
      setLoading(false);
      return;
    }

    setDataset(ds);

    const table =
      ds.type === 'categorical'
        ? 'dataset_values_categorical_raw'
        : 'dataset_values_numeric_raw';

    const { data: rawRows, error: rowErr } = await supabase
      .from(table)
      .select('*')
      .eq('dataset_id', datasetId)
      .limit(50);

    if (rowErr) console.error('Error loading raw values:', rowErr);

    setRows(rawRows || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [datasetId]);

  // ────────────────────────────────────────────────
  // UI RENDERING
  // ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-600">
        <Loader2 className="animate-spin mr-2" /> Loading dataset…
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="text-center text-gray-500 mt-10">
        Dataset not found.
      </div>
    );
  }

  const isCategorical = dataset.type === 'categorical';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800">
          {dataset.name}
        </h1>
        <p className="text-gray-500 text-sm">
          Admin Level: {dataset.admin_level} | Type: {dataset.type}
        </p>
      </div>

      {/* Raw Values Table */}
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Admin Code</th>
              <th className="px-3 py-2 text-left">Admin Name</th>
              <th className="px-3 py-2 text-left">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-4 text-center text-gray-500"
                >
                  No rows found.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={i}
                  className="border-t hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2">{r.admin_pcode_raw}</td>
                  <td className="px-3 py-2">{r.admin_name_raw}</td>
                  <td className="px-3 py-2">{r.value_raw}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clean / Status Controls */}
      <div className="flex justify-end items-center gap-4 mt-4">
        {!dataset.is_cleaned ? (
          <button
            onClick={() =>
              isCategorical
                ? setShowCategoricalModal(true)
                : setShowNumericModal(true)
            }
            className="px-4 py-2 bg-[var(--ssc-blue)] hover:bg-blue-800 text-white rounded-md text-sm font-medium"
          >
            Clean Dataset
          </button>
        ) : (
          <span className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded">
            ✅ Already Cleaned
          </span>
        )}
      </div>

      {/* ─────────────────────────────── */}
      {/* Cleaning Modals */}
      {/* ─────────────────────────────── */}
      {showNumericModal && (
  <CleanNumericDatasetModal
    datasetId={datasetId}
    datasetName={dataset?.name || ''}
    open={showNumericModal}
    onOpenChange={setShowNumericModal}
    onCleaned={loadAll}
  />
)}

      {showCategoricalModal && (
        <CleanCategoricalDatasetModal
          datasetId={datasetId}
          datasetName={dataset.name}
          open={showCategoricalModal}
          onOpenChange={setShowCategoricalModal}
          onCleaned={loadAll}
        />
      )}
    </div>
  );
}
