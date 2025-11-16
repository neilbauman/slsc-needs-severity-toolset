'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';

export default function RawDatasetsPage() {
  // Explicitly type datasets as an array of objects with at least `id`, `name`, `type`
  const [datasets, setDatasets] = useState<{ id: string; name: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDatasets() {
      setLoading(true);
      const { data, error } = await supabase.from('datasets').select('*');
      if (error) {
        console.error('Error loading datasets:', error);
      } else {
        setDatasets(data || []);
      }
      setLoading(false);
    }
    loadDatasets();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Raw Dataset Viewer</h1>
      {loading ? (
        <p>Loading datasets...</p>
      ) : (
        datasets.map((d) => {
          const table =
            d.type === 'numeric'
              ? 'dataset_values_numeric_raw'
              : 'dataset_values_categorical_raw';
          return (
            <div key={d.id} className="mb-4 border p-3 rounded">
              <h2 className="text-lg font-semibold">{d.name}</h2>
              <p>Type: {d.type}</p>
              <p>Table: {table}</p>
            </div>
          );
        })
      )}
    </div>
  );
}
