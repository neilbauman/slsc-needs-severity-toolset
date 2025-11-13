// app/datasets/raw/[dataset_id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
};

export default function RawDatasetDetail({ params }: any) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // 1. Load dataset metadata
      const { data: ds } = await supabase
        .from('datasets')
        .select('id, name, type, admin_level')
        .eq('id', datasetId)
        .single();

      if (!ds) {
        setLoading(false);
        return;
      }

      setDataset(ds);

      // 2. Pick correct raw table
      const table =
        ds.type === 'numeric'
          ? 'dataset_values_numeric_raw'
          : 'dataset_values_categorical_raw';

      // 3. Load raw rows
      const { data: raw } = await supabase
        .from(table)
        .select('*')
        .eq('dataset_id', datasetId)
        .limit(200); // prevent huge screens

      if (!raw) {
        setLoading(false);
        return;
      }

      setRows(raw);

      // Determine column headers dynamically:
      // - raw_row JSON keys
      // - plus admin_pcode_raw / admin_name_raw / shape / value_raw / is_percentage
      const allKeys = new Set<string>();

      raw.forEach((r) => {
        Object.keys(r).forEach((k) => allKeys.add(k));
        if (r.raw_row) {
          Object.keys(r.raw_row).forEach((k) => allKeys.add(`raw:${k}`));
        }
      });

      setColumns([...allKeys]);
      setLoading(false);
    };

    load();
  }, [datasetId]);

  return (
    <div className="p-4 space-y-4">
      <Link href="/datasets/raw" className="text-blue-600 text-sm hover:underline">
        ← Back to raw datasets
      </Link>

      {loading ? (
        <p>Loading…</p>
      ) : !dataset ? (
        <p className="text-red-600">Dataset not found.</p>
      ) : (
        <>
          <h1 className="text-xl font-semibold">{dataset.name}</h1>
          <p className="text-sm text-gray-600">
            Raw staging table for a <strong>{dataset.type}</strong> dataset at{' '}
            <strong>{dataset.admin_level}</strong>.
          </p>

          <div className="overflow-x-auto border rounded bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="px-2 py-1 border-b text-left">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    {columns.map((c) => {
                      let value = null;

                      if (c.startsWith('raw:')) {
                        const key = c.replace('raw:', '');
                        value = r.raw_row?.[key];
                      } else {
                        value = r[c];
                      }

                      return (
                        <td key={c} className="px-2 py-1 border-b">
                          {value === null || value === undefined ? '' : String(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
