'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [sortKey, setSortKey] = useState<'admin_pcode' | 'admin_name' | 'value'>('admin_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!dataset) return;
    const fetchData = async () => {
      const table =
        dataset.type === 'categorical'
          ? 'dataset_values_categorical'
          : 'dataset_values_numeric';

      const { data, error } = await supabase
        .from(table)
        .select('admin_pcode, value, admin_boundaries(name)')
        .eq('dataset_id', dataset.id)
        .limit(5000);

      if (error) {
        console.error('Error loading dataset values:', error);
      } else {
        const mapped = data.map((row: any) => ({
          admin_pcode: row.admin_pcode,
          admin_name: row.admin_boundaries?.name ?? '',
          value: row.value,
        }));
        setRows(mapped);
      }
    };
    fetchData();
  }, [dataset]);

  const sortData = (key: 'admin_pcode' | 'admin_name' | 'value') => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (a[sortKey] < b[sortKey]) return -1 * dir;
    if (a[sortKey] > b[sortKey]) return 1 * dir;
    return 0;
  });

  const header = (key: any, label: string) => (
    <th
      onClick={() => sortData(key)}
      className="cursor-pointer px-3 py-2 text-left font-medium text-gray-700 hover:text-gray-900"
    >
      {label} {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-md w-full max-w-3xl p-5 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-800">{dataset.name}</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900 text-sm">
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Admin Level: {dataset.admin_level} • Type: {dataset.type}
        </p>

        <table className="w-full text-sm border border-gray-200 rounded-md">
          <thead className="bg-gray-100">
            <tr>
              {header('admin_pcode', 'Admin PCode')}
              {header('admin_name', 'Admin Name')}
              {header('value', 'Value')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                <td className="px-3 py-1.5">{row.admin_pcode}</td>
                <td className="px-3 py-1.5">{row.admin_name}</td>
                <td className="px-3 py-1.5">{row.value}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={3} className="text-gray-400 italic px-3 py-2 text-center">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
