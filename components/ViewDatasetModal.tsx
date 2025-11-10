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

  // Normalize PCode — remove 3 trailing zeros if ADM3 pattern (11 chars ending in 000)
  const normalizePCode = (code?: string): string => {
    if (!code) return '';
    let cleaned = code.trim().toUpperCase();
    if (cleaned.length === 11 && cleaned.endsWith('000')) {
      cleaned = cleaned.slice(0, 8); // remove last 3 zeros (PH051705000 → PH051705)
    }
    return cleaned;
  };

  const loadData = async () => {
    setLoading(true);

    // Detect table based on dataset type
    const table =
      dataset.type === 'categorical'
        ? 'dataset_values_categorical'
        : 'dataset_values_numeric';

    // Fetch dataset values
    const { data: datasetValues, error: datasetErr } = await supabase
      .from(table)
      .select('admin_pcode, value')
      .eq('dataset_id', dataset.id)
      .limit(5000);

    if (datasetErr) {
      console.error('Dataset fetch error:', datasetErr);
      setLoading(false);
      return;
    }

    // Fetch boundaries
    const { data: admins, error: adminErr } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name, admin_level');

    if (adminErr) {
      console.error('Admin boundaries fetch error:', adminErr);
      setLoading(false);
      return;
    }

    // Map all possible codes (with and without trailing zeros)
    const adminMap = new Map<string, string>();
    admins?.forEach((a) => {
      const full = a.admin_pcode.trim().toUpperCase();
      adminMap.set(full, a.name);
      if (full.length === 8) adminMap.set(full + '000', a.name); // map both ADM3/ADM4 forms
    });

    const combined =
      datasetValues?.map((r) => {
        const raw = r.admin_pcode?.trim().toUpperCase();
        const normalized = normalizePCode(raw);
        const name =
          adminMap.get(raw) ||
          adminMap.get(normalized) ||
          'Unknown';
        return { ...r, name };
      }) ?? [];

    setRows(combined);
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
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
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
