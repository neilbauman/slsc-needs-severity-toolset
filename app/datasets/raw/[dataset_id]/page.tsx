'use client';

import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

interface NumericRawRow {
  id: string;
  dataset_id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  value_raw: string | null;
  is_percentage: boolean | null;
  raw_row: any;
}

interface CategoricalRawRow {
  id: string;
  dataset_id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  shape: string | null;
  raw_row: any;
}

export default function RawDatasetDetail({ params }: any) {
  const dataset_id = params.dataset_id;
  const [numeric, setNumeric] = useState<NumericRawRow[]>([]);
  const [categorical, setCategorical] = useState<CategoricalRawRow[]>([]);
  const [mode, setMode] = useState<'numeric' | 'categorical' | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Try numeric table
        const { data: num } = await supabase
          .from('dataset_values_numeric_raw')
          .select('*')
          .eq('dataset_id', dataset_id);

        if (num && num.length > 0) {
          setNumeric(num as NumericRawRow[]);
          setMode('numeric');
          return;
        }

        // Try categorical
        const { data: cat } = await supabase
          .from('dataset_values_categorical_raw')
          .select('*')
          .eq('dataset_id', dataset_id);

        if (cat && cat.length > 0) {
          setCategorical(cat as CategoricalRawRow[]);
          setMode('categorical');
          return;
        }

        setError('No raw data found for this dataset.');
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      }
    };

    load();
  }, [dataset_id]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Raw Dataset: {dataset_id}</h1>

      {error && <p className="text-red-600">{error}</p>}

      {mode === 'numeric' && (
        <>
          <h2 className="text-lg font-semibold mb-2">Numeric Raw Data</h2>
          <table className="border w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Admin PCode (raw)</th>
                <th className="p-2 border">Admin Name (raw)</th>
                <th className="p-2 border">Value (raw)</th>
                <th className="p-2 border">Is Percentage?</th>
                <th className="p-2 border">Raw Row</th>
              </tr>
            </thead>
            <tbody>
              {numeric.map((r) => (
                <tr key={r.id}>
                  <td className="p-2 border">{r.admin_pcode_raw}</td>
                  <td className="p-2 border">{r.admin_name_raw}</td>
                  <td className="p-2 border">{r.value_raw}</td>
                  <td className="p-2 border">
                    {r.is_percentage ? 'Yes' : 'No'}
                  </td>
                  <td className="p-2 border text-xs">
                    {JSON.stringify(r.raw_row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {mode === 'categorical' && (
        <>
          <h2 className="text-lg font-semibold mb-2">Categorical Raw Data</h2>
          <table className="border w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Admin PCode (raw)</th>
                <th className="p-2 border">Admin Name (raw)</th>
                <th className="p-2 border">Shape Column</th>
                <th className="p-2 border">Raw Row</th>
              </tr>
            </thead>
            <tbody>
              {categorical.map((r) => (
                <tr key={r.id}>
                  <td className="p-2 border">{r.admin_pcode_raw}</td>
                  <td className="p-2 border">{r.admin_name_raw}</td>
                  <td className="p-2 border">{r.shape}</td>
                  <td className="p-2 border text-xs">
                    {JSON.stringify(r.raw_row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
