// app/datasets/raw/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type DatasetRow = {
  id: string;
  name: string;
  type: string;
  admin_level: string;
};

export default function RawDatasetsPage() {
  const [rows, setRows] = useState<
    { dataset: DatasetRow; rawCount: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // 1. Load datasets
      const { data: datasets } = await supabase
        .from('datasets')
        .select('id, name, type, admin_level')
        .order('name');

      if (!datasets) return setLoading(false);

      // 2. Count raw rows for each dataset
      const results = await Promise.all(
        datasets.map(async (d) => {
          const table =
            d.type === 'numeric'
              ? 'dataset_values_numeric_raw'
              : 'dataset_values_categorical_raw';

          const { count } = await supabase
            .from(table)
            .select('id', { head: true, count: 'exact' })
            .eq('dataset_id', d.id);

          return { dataset: d, rawCount: count ?? 0 };
        })
      );

      // Only show datasets that actually have raw rows
      setRows(results.filter((r) => r.rawCount > 0));
      setLoading(false);
    };

    load();
  }, []);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Raw Dataset Staging</h1>
      <p className="text-sm text-gray-600">
        These datasets contain raw uncleaned rows.
      </p>

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500">No raw datasets found.</p>
      ) : (
        <div className="overflow-x-auto border rounded bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left">Dataset</th>
                <th className="px-2 py-1 text-left">Type</th>
                <th className="px-2 py-1 text-right">Raw rows</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ dataset, rawCount }) => (
                <tr key={dataset.id} className="border-t hover:bg-gray-50">
                  <td className="px-2 py-1">{dataset.name}</td>
                  <td className="px-2 py-1">{dataset.type}</td>
                  <td className="px-2 py-1 text-right">{rawCount}</td>
                  <td className="px-2 py-1">
                    <Link
                      href={`/datasets/raw/${dataset.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
