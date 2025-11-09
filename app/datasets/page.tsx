'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Panel } from '@/components/Panel';
import Header from '@/components/Header';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);

  useEffect(() => {
    const fetchDatasets = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) setDatasets(data);
    };

    fetchDatasets();
  }, []);

  return (
    <main className="p-6 space-y-8">
      <Header title="Datasets" breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: 'Datasets' }]} />

      <Panel title="Core Datasets">
        <ul className="list-disc list-inside">
          <li>Administrative Boundaries</li>
          <li>Population Data</li>
          <li>GIS Layers</li>
        </ul>
      </Panel>

      <Panel title="Uploaded Datasets">
        {datasets.length === 0 ? (
          <p className="text-gray-500">No datasets uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {datasets.map((d) => (
              <li key={d.id} className="border p-4 rounded-lg hover:bg-gray-50">
                <Link href={`/datasets/${d.id}`} className="text-blue-600 font-semibold hover:underline">
                  {d.name || 'Untitled Dataset'}
                </Link>
                <p className="text-sm text-gray-600">Admin Level: {d.admin_level || 'N/A'}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}
