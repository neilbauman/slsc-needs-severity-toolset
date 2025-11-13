'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function RawDatasetsPage() {
  const [numericCounts, setNumericCounts] = useState<any[]>([]);
  const [categoricalCounts, setCategoricalCounts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Numeric raw counts
        const { data: num, error: numErr } = await supabase
          .from('dataset_values_numeric_raw')
          .select('dataset_id');

        if (numErr) throw numErr;

        const numericGrouped = Object.entries(
          num.reduce((acc: any, row: any) => {
            acc[row.dataset_id] = (acc[row.dataset_id] || 0) + 1;
            return acc;
          }, {})
        ).map(([dataset_id, count]) => ({ dataset_id, count }));

        // Categorical raw counts
        const { data: cat, error: catErr } = await supabase
          .from('dataset_values_categorical_raw')
          .select('dataset_id');

        if (catErr) throw catErr;

        const categoricalGrouped = Object.entries(
          cat.reduce((acc: any, row: any) => {
            acc[row.dataset_id] = (acc[row.dataset_id] || 0) + 1;
            return acc;
          }, {})
        ).map(([dataset_id, count]) => ({ dataset_id, count }));

        setNumericCounts(numericGrouped);
        setCategoricalCounts(categoricalGrouped);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      }
    };

    load();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Raw Uploaded Datasets</h1>

      {error && <p className="text-red-600">{error}</p>}

      <h2 className="text-lg font-semibold mt-6">Numeric Datasets</h2>
      <table className="border mt-2 text-sm w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Dataset ID</th>
            <th className="p-2 border">Rows</th>
            <th className="p-2 border">View</th>
          </tr>
        </thead>
        <tbody>
          {numericCounts.map((r) => (
            <tr key={r.dataset_id}>
              <td className="p-2 border">{r.dataset_id}</td>
              <td className="p-2 border">{r.count}</td>
              <td className="p-2 border">
                <a
                  className="text-blue-600 underline"
                  href={`/datasets/raw/${r.dataset_id}`}
                >
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-lg font-semibold mt-8">Categorical Datasets</h2>
      <table className="border mt-2 text-sm w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Dataset ID</th>
            <th className="p-2 border">Rows</th>
            <th className="p-2 border">View</th>
          </tr>
        </thead>
        <tbody>
          {categoricalCounts.map((r) => (
            <tr key={r.dataset_id}>
              <td className="p-2 border">{r.dataset_id}</td>
              <td className="p-2 border">{r.count}</td>
              <td className="p-2 border">
                <a
                  className="text-blue-600 underline"
                  href={`/datasets/raw/${r.dataset_id}`}
                >
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
