'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    null
  );

  useEffect(() => {
    if (!dataset) return;
    loadDatasetData();
  }, [dataset]);

  const loadDatasetData = async () => {
    setLoading(true);
    setError(null);

    try {
      const table =
        dataset.type === 'numeric' ? 'dataset_values_numeric' : 'dataset_values_categorical';

      const { data: values, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('dataset_id', dataset.id)
        .limit(1000);

      if (fetchError) throw fetchError;

      // Fetch all boundaries (ADM2–4)
      const { data: boundaries, error: boundaryError } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name');

      if (boundaryError) throw boundaryError;

      const nameMap = new Map(boundaries.map((b: any) => [b.admin_pcode, b.name]));

      // ADM3 Fix: try removing trailing zeros to match ADM4 codes
      const enriched = (values || []).map((v: any) => {
        let adminName = nameMap.get(v.admin_pcode);
        if (!adminName && v.admin_pcode?.length === 11) {
          const trimmed = v.admin_pcode.replace(/0+$/, ''); // drop trailing zeros
          adminName = nameMap.get(trimmed);
        }
        if (!adminName && v.admin_pcode?.length > 7) {
          adminName = nameMap.get(v.admin_pcode.slice(0, 7));
        }
        return { ...v, admin_name: adminName || '—' };
      });

      setData(enriched);
    } catch (err: any) {
      console.error('Error loading dataset:', err);
      setError(err.message || 'Error loading dataset preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    const sorted = [...data].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setData(sorted);
  };

  if (!dataset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl relative max-h-[75vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start p-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-800">{dataset.name}</h2>
            {dataset.description && (
              <p className="text-xs text-gray-500">{dataset.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-x-4 text-[11px] text-gray-600 px-4 py-2 border-b">
          <div>
            <p>
              <span className="font-semibold text-gray-700">Type:</span> {dataset.type}
            </p>
            <p>
              <span className="font-semibold text-gray-700">Category:</span>{' '}
              {dataset.category || '—'}
            </p>
            <p>
              <span className="font-semibold text-gray-700">Created:</span>{' '}
              {new Date(dataset.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <p>
              <span className="font-semibold text-gray-700">Admin Level:</span>{' '}
              {dataset.admin_level}
            </p>
            <p>
              <span className="font-semibold text-gray-700">Source:</span>{' '}
              {dataset.source || '—'}
            </p>
          </div>
        </div>

        {/* Dataset Preview */}
        <div className="flex-grow overflow-y-auto p-3 text-[11px] max-h-[55vh]">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Dataset Preview</h3>

          {loading ? (
            <p className="text-gray-500 text-center py-6 text-sm">Loading data…</p>
          ) : error ? (
            <p className="text-red-600 text-center py-4">{error}</p>
          ) : data.length === 0 ? (
            <p className="text-gray-500 text-center py-6 text-sm">
              No records found for this dataset.
            </p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full border-collapse text-[11px]">
                <thead className="bg-gray-50 border-b text-gray-700">
                  <tr>
                    <th
                      onClick={() => handleSort('admin_pcode')}
                      className="text-left py-1 px-2 border-b cursor-pointer hover:bg-gray-100"
                    >
                      Admin PCode
                    </th>
                    <th
                      onClick={() => handleSort('admin_name')}
                      className="text-left py-1 px-2 border-b cursor-pointer hover:bg-gray-100"
                    >
                      Admin Name
                    </th>
                    <th
                      onClick={() => handleSort('value')}
                      className="text-left py-1 px-2 border-b cursor-pointer hover:bg-gray-100"
                    >
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr
                      key={i}
                      className={`${
                        i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } hover:bg-gray-100`}
                    >
                      <td className="py-1 px-2 border-b">{row.admin_pcode}</td>
                      <td className="py-1 px-2 border-b">{row.admin_name}</td>
                      <td className="py-1 px-2 border-b">{row.value ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
