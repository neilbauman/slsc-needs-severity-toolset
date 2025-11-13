// app/datasets/raw/[dataset_id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function RawDatasetDetail() {
  const params = useParams();
  const datasetId = params.dataset_id as string;

  const [dataset, setDataset] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: ds } = await supabase
        .from('datasets')
        .select('*')
        .eq('id', datasetId)
        .single();

      setDataset(ds);

      const table =
        ds.type === 'numeric'
          ? 'dataset_values_numeric_raw'
          : 'dataset_values_categorical_raw';

      const { data: rawRows } = await supabase
        .from(table)
        .select('*')
        .eq('dataset_id', datasetId)
        .limit(200);

      setRows(rawRows || []);
      setLoading(false);
    }

    load();
  }, [datasetId]);

  if (loading) return <p className="p-6">Loading…</p>;
  if (!dataset) return <p className="p-6">Dataset not found.</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">{dataset.name}</h1>

      <p className="text-gray-700 text-sm">
        <strong>Category:</strong> {dataset.category} <br />
        <strong>Type:</strong> {dataset.type} <br />
        <strong>Admin Level:</strong> {dataset.admin_level} <br />
      </p>

      <h2 className="text-lg font-semibold mt-4">Raw Rows (first 200)</h2>

      <div className="overflow-x-auto border rounded text-sm">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">admin_pcode_raw</th>
              <th className="p-2 border">admin_name_raw</th>
              <th className="p-2 border">shape</th>
              <th className="p-2 border">raw_row (JSON)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="border p-2">{r.admin_pcode_raw}</td>
                <td className="border p-2">{r.admin_name_raw}</td>
                <td className="border p-2">{r.shape}</td>
                <td className="border p-2 whitespace-pre text-xs">
                  {JSON.stringify(r.raw_row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
