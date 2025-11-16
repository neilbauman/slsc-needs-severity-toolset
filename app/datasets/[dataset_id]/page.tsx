'use client';

import React, { useState, useEffect } from 'react';
import supabase from '@/lib/supabaseClient';
import EditDatasetModal from '@/components/EditDatasetModal';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';

interface Dataset {
  id: string;
  name: string;
  description?: string;
  type: string;
  source?: string;
  license?: string;
  tags?: string;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function DatasetDetailPage({ params }: { params: { dataset_id: string } }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showClean, setShowClean] = useState(false);
  const [values, setValues] = useState<any[]>([]);

  const datasetId = params.dataset_id;

  const loadDataset = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (error) {
      console.error('Error loading dataset:', error);
      setDataset(null);
    } else {
      setDataset(data);
    }

    setLoading(false);
  };

  const loadValues = async () => {
    if (!dataset) return;
    const table =
      dataset.type === 'numeric'
        ? 'dataset_values_numeric'
        : 'dataset_values_categorical';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('dataset_id', dataset.id)
      .limit(100);

    if (error) console.error('Error loading values:', error);
    else setValues(data || []);
  };

  useEffect(() => {
    loadDataset();
  }, [datasetId]);

  useEffect(() => {
    if (dataset) loadValues();
  }, [dataset]);

  if (loading) {
    return (
      <div className="p-6 text-gray-600 text-center">
        Loading dataset details...
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="p-6 text-red-600 text-center">
        Failed to load dataset.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{dataset.name}</h1>
        <div className="space-x-2">
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Edit
          </button>
          {dataset.type === 'numeric' && (
            <button
              onClick={() => setShowClean(true)}
              className="px-4 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600"
            >
              Clean Data
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-2">
        <p>
          <strong>Description:</strong>{' '}
          {dataset.description || 'No description'}
        </p>
        <p>
          <strong>Type:</strong> {dataset.type}
        </p>
        <p>
          <strong>Source:</strong> {dataset.source || 'Unknown'}
        </p>
        <p>
          <strong>License:</strong> {dataset.license || 'Not specified'}
        </p>
        <p>
          <strong>Tags:</strong> {dataset.tags || 'None'}
        </p>
        <p>
          <strong>Visibility:</strong>{' '}
          {dataset.is_public ? 'Public' : 'Private'}
        </p>
        <p className="text-sm text-gray-500">
          Created at: {dataset.created_at}
        </p>
        <p className="text-sm text-gray-500">
          Updated at: {dataset.updated_at}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Sample Data</h2>
        {values.length > 0 ? (
          <div className="overflow-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  {Object.keys(values[0]).map((key) => (
                    <th key={key} className="px-3 py-2 border-b">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {values.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="px-3 py-2 border-b">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No values found.</p>
        )}
      </div>

      {showEdit && (
        <EditDatasetModal
          dataset={dataset}
          onClose={() => setShowEdit(false)}
          onSaved={loadDataset}
        />
      )}

      {showClean && dataset.type === 'numeric' && (
        <CleanNumericDatasetModal
          dataset={dataset}
          onClose={() => setShowClean(false)}
          onCleaned={loadDataset}
        />
      )}
    </div>
  );
}
