'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getNumericCleaningPreview } from '@/lib/supabasePreview';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
  created_at: string;
  is_cleaned: boolean;
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, type, admin_level, created_at, is_cleaned')
      .order('created_at', { ascending: false });

    if (!error && data) setDatasets(data);
    setLoading(false);
  };

  const showPreview = async (id: string) => {
    setPreviewLoading(true);
    try {
      const result = await getNumericCleaningPreview(id);
      setPreview(result);
    } catch (e) {
      alert('Preview failed. Check console.');
    }
    setPreviewLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800">
          Datasets
        </h1>
        <Link href="/datasets/upload" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Upload Dataset
        </Link>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-3 py-2 border-b text-left">Name</th>
              <th className="px-3 py-2 border-b text-left">Type</th>
              <th className="px-3 py-2 border-b text-left">Admin Level</th>
              <th className="px-3 py-2 border-b text-left">Uploaded</th>
              <th className="px-3 py-2 border-b text-left">Status</th>
              <th className="px-3 py-2 border-b text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((ds) => (
              <tr key={ds.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{ds.name}</td>
                <td className="px-3 py-2 capitalize">{ds.type}</td>
                <td className="px-3 py-2">{ds.admin_level}</td>
                <td className="px-3 py-2">
                  {new Date(ds.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  {ds.is_cleaned ? (
                    <span className="text-green-700 font-medium">Cleaned</span>
                  ) : (
                    <span className="text-red-700 font-medium">Raw</span>
                  )}
                </td>
                <td className="px-3 py-2 space-x-2">
                  <button
                    onClick={() => showPreview(ds.id)}
                    className="px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600"
                  >
                    Check Health
                  </button>
                  <Link
                    href={`/datasets/raw/${ds.id}`}
                    className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View / Clean
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewLoading && <p className="text-gray-600">Analyzing dataset...</p>}

      {preview && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h2 className="text-lg font-semibold mb-2">Dataset Health</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Match Status</th>
                <th className="text-left">Count</th>
                <th className="text-left">%</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.match_status}>
                  <td>{row.match_status}</td>
                  <td>{row.count}</td>
                  <td>{row.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
