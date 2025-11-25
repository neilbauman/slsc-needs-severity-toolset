'use client';

import { useEffect, useState } from 'react';
import { X, Pencil, Trash2, Wand2, Layers, MapPinned, Info, Database } from 'lucide-react';
import Link from 'next/link';
import supabase from '@/lib/supabaseClient';

type Dataset = {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  admin_level?: string | null;
  source?: string | null;
  metadata?: Record<string, any> | null;
  is_baseline?: boolean | null;
  is_derived?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Props = {
  dataset: Dataset | null;
  onClose: () => void;
  onEdit: (dataset: Dataset) => void;
  onDelete: (datasetId: string) => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const statusConfig: Record<
  string,
  {
    label: string;
    color: string;
    description: string;
  }
> = {
  ready: {
    label: 'Ready for use',
    color: 'bg-green-100 text-green-700',
    description: 'Aligned with admin boundaries and validated.',
  },
  in_progress: {
    label: 'Cleaning in progress',
    color: 'bg-amber-100 text-amber-700',
    description: 'Cleaning or validation steps are underway.',
  },
  needs_review: {
    label: 'Needs review',
    color: 'bg-red-100 text-red-700',
    description: 'Requires alignment or metadata updates before use.',
  },
  archived: {
    label: 'Archived',
    color: 'bg-gray-200 text-gray-600',
    description: 'Kept for reference but not in active use.',
  },
};

const getDatasetStatus = (dataset: Dataset | null) => {
  if (!dataset) return statusConfig.needs_review;
  const meta = dataset.metadata || {};
  const state = meta.readiness || meta.cleaning_status || 'needs_review';
  return statusConfig[state] || statusConfig.needs_review;
};

export default function DatasetDetailDrawer({ dataset, onClose, onEdit, onDelete }: Props) {
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!dataset) return;
    const fetchSampleData = async () => {
      setLoadingData(true);
      try {
        if (dataset.type === 'numeric') {
          const { data, error } = await supabase
            .from('dataset_values_numeric')
            .select('admin_pcode, value')
            .eq('dataset_id', dataset.id)
            .limit(10)
            .order('admin_pcode', { ascending: true });
          if (!error && data) {
            setSampleData(data);
          }
        } else if (dataset.type === 'categorical') {
          const { data, error } = await supabase
            .from('dataset_values_categorical')
            .select('admin_pcode, category, value')
            .eq('dataset_id', dataset.id)
            .limit(10)
            .order('admin_pcode', { ascending: true });
          if (!error && data) {
            setSampleData(data);
          }
        }
      } catch (err) {
        console.error('Failed to load sample data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchSampleData();
  }, [dataset]);

  if (!dataset) return null;
  const status = getDatasetStatus(dataset);

  const infoRows = [
    { label: 'Type', value: dataset.type || '—' },
    { label: 'Admin level', value: dataset.admin_level || '—' },
    { label: 'Source', value: dataset.source || '—' },
    {
      label: 'Created',
      value: formatDate(dataset.created_at),
    },
    {
      label: 'Updated',
      value: formatDate(dataset.updated_at),
    },
  ];

  const metadataEntries = Object.entries(dataset.metadata || {}).filter(
    ([key]) => !['cleaning_state', 'readiness'].includes(key),
  );

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold">
              Dataset detail
            </p>
            <h2 className="text-xl font-semibold text-gray-900">{dataset.name}</h2>
            <p className="text-sm text-gray-500">{dataset.description || 'No description provided.'}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}>
              {status.label}
            </span>
            {dataset.is_baseline && (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-indigo-100 text-indigo-700">
                Reference layer
              </span>
            )}
            {dataset.is_derived && (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-700">
                Derived
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
            <Info size={14} className="mt-0.5 text-gray-400" />
            {status.description}
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          <section className="px-5 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Layers size={16} className="text-gray-400" />
              Overview
            </h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {infoRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{row.label}</dt>
                  <dd className="font-medium text-gray-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="px-5 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPinned size={16} className="text-gray-400" />
              Metadata & notes
            </h3>
            {metadataEntries.length === 0 ? (
              <p className="text-sm text-gray-500">No additional metadata recorded yet.</p>
            ) : (
              <dl className="space-y-2 text-sm">
                {metadataEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">{key}</dt>
                    <dd className="font-medium text-gray-900 break-words">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="px-5 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Database size={16} className="text-gray-400" />
              Data preview
            </h3>
            {loadingData ? (
              <p className="text-sm text-gray-500">Loading sample data…</p>
            ) : sampleData.length === 0 ? (
              <p className="text-sm text-gray-500">No data values found for this dataset.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Admin PCode</th>
                      {dataset.type === 'categorical' && (
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Category</th>
                      )}
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {sampleData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900 font-mono text-[11px]">{row.admin_pcode}</td>
                        {dataset.type === 'categorical' && (
                          <td className="px-3 py-2 text-gray-700">{row.category || '—'}</td>
                        )}
                        <td className="px-3 py-2 text-gray-900 font-medium">
                          {typeof row.value === 'number' ? row.value.toLocaleString() : row.value || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-500">
              Showing first {sampleData.length} rows. <Link href={`/datasets/raw/${dataset.id}`} className="text-amber-600 hover:text-amber-700 font-semibold">View full dataset</Link>
            </p>
          </section>

          <section className="px-5 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Actions</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onEdit(dataset)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={14} />
                Edit metadata
              </button>
              <button
                onClick={() => onDelete(dataset.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Delete
              </button>
              <Link
                href={`/datasets/raw/${dataset.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
              >
                <Wand2 size={14} />
                Inspect raw data
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

