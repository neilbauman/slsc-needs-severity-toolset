'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

export default function DatasetDetailPage() {
  const { dataset_id } = useParams();
  const [dataset, setDataset] = useState<any>(null);
  const [dataRows, setDataRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadDataset() {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', dataset_id)
      .single();

    if (error) {
      console.error('Failed to load dataset:', error);
      setLoading(false);
      return;
    }

    setDataset(data);
    await loadDataValues(data);
    setLoading(false);
  }

  async function loadDataValues(ds: any) {
    if (!ds) return;
    let cleanedTable =
      ds.type === 'numeric'
        ? 'dataset_values_numeric'
        : 'dataset_values_categorical';
    let rawTable =
      ds.type === 'numeric'
        ? 'dataset_values_numeric_raw'
        : 'dataset_values_categorical_raw';

    // Try cleaned first
    let { data: cleaned, error: cleanedErr } = await supabase
      .from(cleanedTable)
      .select('*')
      .eq('dataset_id', ds.id);

    if (cleanedErr) console.error(cleanedErr);

    if (cleaned && cleaned.length > 0) {
      setDataRows(cleaned);
      return;
    }

    // Fallback to raw
    let { data: raw, error: rawErr } = await supabase
      .from(rawTable)
      .select('*')
      .eq('dataset_id', ds.id);

    if (rawErr) console.error(rawErr);
    setDataRows(raw || []);
  }

  useEffect(() => {
    loadDataset();
  }, [dataset_id]);

  if (loading) return <div className="p-4 text-gray-600">Loading dataset...</div>;
  if (!dataset) return <div className="p-4 text-red-500">Dataset not found.</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">{dataset.name}</h1>
        <p className="text-sm text-gray-600">
          {dataset.description || 'No description provided.'}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        <div>
          <strong>Admin Level:</strong> {dataset.admin_level || '—'}
        </div>
        <div>
          <strong>Type:</strong> {dataset.type}
        </div>
        <div>
          <strong>Subtype:</strong> {dataset.subtype || '—'}
        </div>
        <div>
          <strong>Abs/Rel/Idx:</strong> {dataset.absolute_relative_index || '—'}
        </div>
        <div>
          <strong>Category:</strong> {dataset.category || '—'}
        </div>
        <div>
          <strong>Baseline:</strong> {dataset.is_baseline ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Derived:</strong> {dataset.is_derived ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Cleaned:</strong> {dataset.is_cleaned ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Source:</strong> {dataset.source || '—'}
        </div>
      </div>

      <h2 className="text-lg font-semibold mt-6 mb-2">Data Preview</h2>
      {dataRows.length === 0 ? (
        <div className="text-gray-500">No data available for this dataset.</div>
      ) : (
        <div className="overflow-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                {Object.keys(dataRows[0]).map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  {Object.keys(row).map((col) => (
                    <td key={col} className="px-3 py-2 whitespace-nowrap">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
