// app/datasets/raw/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function RawDatasetsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Count raw rows per dataset
      const { data: numericRaw } = await supabase
        .from('dataset_values_numeric_raw')
        .select('dataset_id', { count: 'exact' })
        .group('dataset_id');

      const { data: categoricalRaw } = await supabase
        .from('dataset_values_categorical_raw')
        .select('dataset_id', { count: 'exact' })
        .group('dataset_id');

      const counts: Record<string, number> = {};

      numericRaw?.forEach((r: any) => {
        counts[r.dataset_id] = (counts[r.dataset_id] || 0) + r.count;
      });

      categoricalRaw?.forEach((r: any) => {
        counts[r.dataset_id] = (counts[r.dataset_id] || 0) + r.count;
      });

      const { data: datasets } = await supabase
        .from('datasets')
        .select('*')
        .order('created_at', { ascending: false });

      const combined = (datasets || []).map((d: any) => ({
        ...d,
        raw_count: counts[d.id] || 0,
      }));

      setRows(combined);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Raw Dataset Uploads</h1>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Category</th>
              <th className="p-2 border">Type</th>
              <th className="p-2 border">Admin Level</th>
              <th className="p-2 border">Raw Rows</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="border p-2">{d.name}</td>
                <td className="border p-2">{d.category}</td>
                <td className="border p-2">{d.type}</td>
                <td className="border p-2">{d.admin_level}</td>
                <td className="border p-2">{d.raw_count}</td>
                <td className="border p-2">
                  {d.raw_count > 0 ? (
                    <Link
                      href={`/datasets/raw/${d.id}`}
                      className="text-blue-600 underline"
                    >
                      View Raw
                    </Link>
                  ) : (
                    <span className="text-gray-400">No raw</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
