'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import { Loader2 } from 'lucide-react';

export default function RawDatasetPage({ params }: { params: { dataset_id: string } }) {
  const datasetId = params.dataset_id;
  const [dataset, setDataset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [showNumericModal, setShowNumericModal] = useState(false);

  // Load dataset + raw data preview
  const loadAll = async () => {
    setLoading(true);
    const { data: ds } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    setDataset(ds || null);

    const { data: raw } = await supabase
      .from('dataset_values_numeric_raw')
      .select('*')
      .eq('dataset_id', datasetId)
      .limit(20);

    setRows(raw || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [datasetId]);

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

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-gray-800 mb-2">
        {dataset.name}
      </h1>
      <p className="text-gray-500 text-sm">
        Admin Level: {dataset.admin_level} | Type: {dataset.type}
      </p>

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
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  No rows found.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{r.admin_pcode_raw}</td>
                  <td className="px-3 py-2">{r.admin_name_raw}</td>
                  <td className="px-3 py-2">{r.value_raw}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowNumericModal(true)}
          className="px-4 py-2 bg-[var(--ssc-blue)] hover:bg-blue-800 text-white rounded-md text-sm font-medium"
        >
          Clean Dataset
        </button>
      </div>

      {/* ✅ Updated Modal Call */}
      {showNumericModal && (
        <CleanNumericDatasetModal
          datasetId={datasetId}
          datasetName={dataset.name}
          open={showNumericModal}
          onOpenChange={setShowNumericModal}
          onCleaned={loadAll}
        />
      )}
    </div>
  );
}
