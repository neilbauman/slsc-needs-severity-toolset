'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

export default function InstanceDetailPage() {
  const { id } = useParams();
  const [instance, setInstance] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadInstance() {
    setLoading(true);
    const { data, error } = await supabase.from('instances').select('*').eq('id', id).single();
    if (error) console.error(error);
    else setInstance(data);
    setLoading(false);
  }

  useEffect(() => {
    if (id) loadInstance();
  }, [id]);

  if (loading) return <p className="p-6">Loading...</p>;
  if (!instance) return <p className="p-6 text-red-600">Instance not found.</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">{instance.name}</h1>
      <p className="text-gray-700 mb-4">Created at: {new Date(instance.created_at).toLocaleString()}</p>
      <pre className="bg-gray-100 p-4 rounded-md text-sm">
        {JSON.stringify(instance, null, 2)}
      </pre>
    </div>
  );
}
