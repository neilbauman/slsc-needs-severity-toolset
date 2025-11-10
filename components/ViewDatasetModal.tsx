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

  const normalizePCode = (code?: string, level?: string): string => {
    if (!code) return '';
    const cleaned = code.trim().toUpperCase();
    // Strip trailing zeros only if code length > expected for level
    if (level === 'ADM3' && cleaned.length >= 11) return cleaned.slice(0, 9);
    if (level === 'ADM2' && cleaned.length >= 9) return cleaned.slice(0, 7);
    if (level === 'ADM4' && cleaned.length >= 13) return cleaned.slice(0, 11);
    return cleaned;
  };

  const loadData = async () => {
    setLoading(true);
    const table =
      dataset.type === 'categorical'
        ? 'dataset_values_categorical'
        : 'dataset_values_numeric';

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

    const { data: admins, error: adminErr } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name, admin_level');

    if (adminErr) {
      console.error('Admin fetch error:', adminErr);
      setLoading(false);
      return;
    }

    const adminMap = new Map<string, string>();
    admins?.forEach((a) => {
      const full = a.admin_pcode.trim().toUpperCase();
      const sliced9 = full.slice(0, 9);
      const sliced7 = full.slice(0, 7);
      adminMap.set(full, a.name);
      adminMap.set(sliced9, a.name);
      adminMap.set(sliced7, a.name);
    });

    const combined =
      datasetValues?.map((r) => {
        const raw = r.admin_pcode?.trim().toUpperCase();
        const normalized = normalizePCode(raw, dataset.admin_level);
        const name =
          adminMap.get(normalized) ||
          adminMap.get(raw.slice(0, 9)) || // fallback for ADM3
          adminMap.get(raw) ||
          'Unknown';

        return {
          ...r,
          name,
        };
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
