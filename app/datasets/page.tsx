// app/datasets/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type DatasetRow = {
  id: string;
  name: string;
  category: string | null;
  type: string; // 'numeric' | 'categorical' (from DB)
  admin_level: string;
  created_at: string;
};

type DatasetWithCounts = DatasetRow & {
  rawCount: number;
  cleanCount: number;
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      // 1. Load all datasets
      const { data, error } = await supabase
        .from('datasets')
        .select('id, name, category, type, admin_level, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading datasets:', error);
        setError(error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as DatasetRow[];

      // 2. For each dataset, fetch raw + cleaned row counts
      const enriched: DatasetWithCounts[] = await Promise.all(
        rows.map(async (d) => {
          const isNumeric = d.type === 'numeric';

          const rawTable = isNumeric
            ? 'dataset_values_numeric_raw'
            : 'dataset_values_categorical_raw';

          const finalTable = isNumeric
            ? 'dataset_values_numeric'
            : 'dataset_values_categorical';

          // Count raw rows
          const { count: rawCount, error: rawError } = await supabase
            .from(rawTable)
            .select('id', { count: 'exact', head: true })
            .eq('dataset_id', d.id);

          if (rawError) {
            console.warn(`Error counting raw rows for ${d.name}:`, rawError);
          }

          // Count cleaned rows
          const { count: cleanCount, error: cleanError } = await supabase
            .from(finalTable)
            .select('id', { count: 'exact', head: true })
            .eq('dataset_id', d.id);

          if (cleanError) {
            console.warn(`Error counting cleaned rows for ${d.name}:`, cleanError);
          }

          return {
            ...d,
            rawCount: rawCount ?? 0,
            cleanCount: cleanCount ?? 0,
          };
        })
      );

      setDatasets(enriched);
      setLoading(false);
    };

    load();
  }, []);

  const getStatus = (d: DatasetWithCounts) => {
    if (d.cleanCount > 0) return { label: 'Cleaned', className: 'bg-green-100 text-green-700' };
    if (d.rawCount > 0) return { label: 'Raw only', className: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Empty', className: 'bg-gray-100 text-gray-600' };
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Datasets</h1>
          <p className="text-xs md:text-sm text-gray-600">
            Each dataset may have <strong>raw</strong> rows in staging tables and/or
            <strong> cleaned</strong> rows in the main dataset tables.
          </p>
        </div>
        <Link
          href="/datasets/upload"
          className="inline-flex items-center px-3 py-1.5 rounded bg-blue-600 text-white text-xs md:text-sm hover:bg-blue-700"
        >
          + Upload Dataset
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-50 text-red-700 text-sm border border-red-100">
          Error loading datasets: {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Loading datasets…</div>
      ) : datasets.length === 0 ? (
        <div className="text-sm text-gray-600">
          No datasets yet. Use <strong>Upload Dataset</strong> to add one.
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-md bg-white">
          <table className="min-w-full text-xs md:text-sm border-collapse">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-2 py-2 border-b text-left">Dataset</th>
                <th className="px-2 py-2 border-b text-left">Category</th>
                <th className="px-2 py-2 border-b text-left">Type</th>
                <th className="px-2 py-2 border-b text-left">Admin level</th>
                <th className="px-2 py-2 border-b text-right">Raw rows</th>
                <th className="px-2 py-2 border-b text-right">Cleaned rows</th>
                <th className="px-2 py-2 border-b text-left">Status</th>
                <th className="px-2 py-2 border-b text-left">Raw staging</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => {
                const status = getStatus(d);
                const isNumeric = d.type === 'numeric';

                const rawLink = isNumeric
                  ? `/datasets/raw/${d.id}?type=numeric`
                  : `/datasets/raw/${d.id}?type=categorical`;

                return (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="px-2 py-2 align-top">
                      <Link
                        href={rawLink}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {d.name}
                      </Link>
                      <div className="text-[11px] text-gray-500">
                        Created {new Date(d.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top">
                      {d.category || <span className="text-gray-400 italic">Uncategorized</span>}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <span className="inline-flex items-center rounded px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px]">
                        {d.type || 'unknown'}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-top">{d.admin_level}</td>
                    <td className="px-2 py-2 text-right align-top">
                      {d.rawCount.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right align-top">
                      {d.cleanCount.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Link
                        href={rawLink}
                        className="text-[11px] text-blue-700 hover:underline"
                      >
                        View raw →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[11px] text-gray-500">
        <p>
          <strong>Raw rows</strong> live in <code>dataset_values_numeric_raw</code> or{' '}
          <code>dataset_values_categorical_raw</code>.
        </p>
        <p>
          <strong>Cleaned rows</strong> live in <code>dataset_values_numeric</code> or{' '}
          <code>dataset_values_categorical</code> after you run cleaning/promotion.
        </p>
      </div>
    </div>
  );
}
