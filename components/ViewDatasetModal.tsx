'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const table = dataset.type === 'categorical' ? 'dataset_values_categorical' : 'dataset_values_numeric';
    const { data, error } = await supabase
      .from(table)
      .select('admin_pcode, value')
      .eq('dataset_id', dataset.id)
      .limit(2000);
    if (error) console.error(error);

    // Join admin names
    const adminCodes = data?.map((r) => r.admin_pcode) || [];
    const { data: admins } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name')
      .in('admin_pcode', adminCodes);

    const combined =
      data?.map((r) => ({
        ...r,
        name: admins?.find((a) => a.admin_pcode === r.admin_pcode)?.name || 'Unknown',
      })) || [];

    setRows(combined);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [dataset]);

  const sortedRows = (() => {
    if (!sortConfig) return rows;
    const { key, direction } = sortConfig;
    return [...rows].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  })();

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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
                  <th
                    onClick={() => requestSort('admin_pcode')}
                    className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200"
                  >
                    PCode {sortConfig?.key === 'admin_pcode' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th
                    onClick={() => requestSort('name')}
                    className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200"
                  >
                    Admin Name {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th
                    onClick={() => requestSort('value')}
                    className="px-3 py-2 text-right cursor-pointer hover:bg-gray-200"
                  >
                    Value {sortConfig?.key === 'value' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.admin_pcode} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-1.5">{row.admin_pcode}</td>
                    <td className="px-3 py-1.5">{row.name}</td>
                    <td className="px-3 py-1.5 text-right">{row.value}</td>
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
