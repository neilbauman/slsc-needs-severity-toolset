'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const table = dataset.type === 'categorical' ? 'dataset_values_categorical' : 'dataset_values_numeric';
    const { data: datasetValues, error: dataErr } = await supabase
      .from(table)
      .select('admin_pcode, value')
      .eq('dataset_id', dataset.id)
      .limit(5000);

    if (dataErr) {
      console.error('Dataset fetch error:', dataErr);
      setLoading(false);
      return;
    }

    const adminCodes = (datasetValues ?? []).map((r) => r.admin_pcode);

    // Fetch all matching admin names — no level filtering
    const { data: admins, error: adminErr } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name');

    if (adminErr) {
      console.error('Admin boundaries fetch error:', adminErr);
      setLoading(false);
      return;
    }

    // Create lookup map using flexible matching
    const adminMap = new Map<string, string>();
    admins?.forEach((a) => {
      // normalize both sides (trim and uppercase)
      adminMap.set(a.admin_pcode.trim().toUpperCase(), a.name);
    });

    const combined = datasetValues?.map((r) => {
      const code = r.admin_pcode?.trim().toUpperCase();
      // try direct match, or prefix-based (for ADM3 codes stored as ADM4-compatible)
      const name =
        adminMap.get(code) ||
        adminMap.get(code.slice(0, 9)) || // e.g. PH083746000 → PH083746
        'Unknown';
      return { ...r, name };
    });

    setRows(combined ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [dataset]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl p-5 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">{dataset.name}</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900 text-sm font-medium">
            ✕ Close
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading data...</p>
        ) : (
          <div className="overflow-y-auto border rounded-md flex-1 text-sm">
            <table className="min-w-full">
              <thead className="bg-gray-100 sticky top-0 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">PCode</th>
                  <th className="px-3 py-2 text-left">Admin Name</th>
                  <th className="px-3 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.admin_pcode} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-1.5">{r.admin_pcode}</td>
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="px-3 py-1.5 text-right">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
