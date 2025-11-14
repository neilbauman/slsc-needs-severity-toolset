'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  Eye,
  Pencil,
  Trash2,
  Wand2,
  RefreshCcw,
  PlusCircle,
  Layers,
} from 'lucide-react';
import UploadDatasetModal from '@/components/UploadDatasetModal';
import EditDatasetModal from '@/components/EditDatasetModal';
import DeriveDatasetModal from '@/components/DeriveDatasetModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
  is_cleaned: boolean;
  value_type: 'absolute' | 'relative' | 'index';
};

type HealthInfo = {
  table: string | null;
  total: number | null;
  valid: number | null;
  percent: number | null;
  label: string;
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDataset, setEditDataset] = useState<Dataset | null>(null);
  const [deriveOpen, setDeriveOpen] = useState(false);
  const [health, setHealth] = useState<Record<string, HealthInfo>>({});

  // Load datasets
  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, type, admin_level, is_cleaned, value_type')
      .order('created_at', { ascending: false });
    if (!error && data) setDatasets(data as Dataset[]);
    setLoading(false);
  };

  // Detect which table holds data
  const detectTable = async (ds: Dataset): Promise<string | null> => {
    const tables = ds.is_cleaned
      ? ['dataset_values_numeric', 'dataset_values_categorical']
      : ['dataset_values_numeric_raw', 'dataset_values_categorical_raw'];

    for (const t of tables) {
      const { count } = await supabase
        .from(t)
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', ds.id);
      if ((count ?? 0) > 0) return t;
    }
    return null;
  };

  // Calculate health for a single dataset
  const calculateHealth = async (ds: Dataset): Promise<HealthInfo> => {
    try {
      const table = await detectTable(ds);
      if (!table) {
        return { table: null, total: null, valid: null, percent: null, label: '– no data' };
      }

      const { count: total } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', ds.id);

      const { count: valid } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', ds.id)
        .not('value', 'is', null)
        .not('value', 'eq', '');

      if (!total || total === 0) {
        return { table, total: 0, valid: 0, percent: 0, label: '– no data' };
      }

      const percent = Math.round(((valid ?? 0) / total) * 100);
      const label = ds.is_cleaned
        ? `✓ ${total} cleaned rows (${percent}%)`
        : `⚠ ${total} raw rows (${percent}%)`;

      return { table, total, valid, percent, label };
    } catch (err) {
      console.error('Health calc error for', ds.name, err);
      return { table: null, total: null, valid: null, percent: null, label: '– error' };
    }
  };

  const recalcSingleHealth = async (ds: Dataset) => {
    const info = await calculateHealth(ds);
    setHealth((prev) => ({ ...prev, [ds.id]: info }));
  };

  // Initial load
  useEffect(() => {
    loadDatasets();
  }, []);

  // Compute health after load
  useEffect(() => {
    if (datasets.length > 0) {
      datasets.forEach(async (ds) => {
        const info = await calculateHealth(ds);
        setHealth((prev) => ({ ...prev, [ds.id]: info }));
      });
    }
  }, [datasets]);

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this dataset?')) return;
    await supabase.from('datasets').delete().eq('id', id);
    loadDatasets();
  };

  // Clean
  const handleClean = async (id: string, type: string) => {
    const rpcName =
      type === 'numeric' ? 'clean_numeric_dataset' : 'clean_categorical_dataset';
    const { error } = await supabase.rpc(rpcName, { _dataset_id: id });
    if (error) alert(`Cleaning failed: ${error.message}`);
    else {
      alert('Dataset cleaned successfully');
      loadDatasets();
    }
  };

  // Render badge for value_type
  const valueBadge = (val: string) => {
    const colorVar =
      val === 'absolute'
        ? 'var(--ssc-blue)'
        : val === 'relative'
        ? 'var(--ssc-orange)'
        : 'var(--ssc-gray)';
    return (
      <span
        className="px-2 py-0.5 rounded text-xs font-medium text-white"
        style={{ backgroundColor: colorVar }}
      >
        {val}
      </span>
    );
  };

  const healthBadge = (info: HealthInfo | undefined) => {
    if (!info || !info.percent)
      return <span className="text-gray-400 text-sm">– no data</span>;

    const color =
      info.percent > 95
        ? 'var(--ssc-blue)'
        : info.percent > 50
        ? 'var(--ssc-orange)'
        : 'var(--ssc-gray)';

    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {info.label}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800">
          Datasets
        </h1>

        <div className="flex gap-3 items-center">
          <button
            onClick={() => setDeriveOpen(true)}
            style={{ backgroundColor: 'var(--ssc-blue)', color: 'white' }}
            className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium hover:opacity-90"
          >
            <Layers size={16} /> Derived Dataset
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            style={{ backgroundColor: 'var(--ssc-blue)', color: 'white' }}
            className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium hover:opacity-90"
          >
            <PlusCircle size={16} /> Upload Dataset
          </button>
        </div>
      </div>

      {/* Modals */}
      {uploadOpen && (
        <UploadDatasetModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            loadDatasets();
          }}
        />
      )}
      {deriveOpen && (
        <DeriveDatasetModal
          onClose={() => setDeriveOpen(false)}
          onCreated={loadDatasets}
        />
      )}
      {editDataset && (
        <EditDatasetModal
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSave={loadDatasets}
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-3 py-2 border-b text-left">Name</th>
              <th className="px-3 py-2 border-b text-left">Type</th>
              <th className="px-3 py-2 border-b text-left">Value Type</th>
              <th className="px-3 py-2 border-b text-left">Admin Level</th>
              <th className="px-3 py-2 border-b text-left">Health</th>
              <th className="px-3 py-2 border-b text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && datasets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  No datasets available.
                </td>
              </tr>
            )}

            {!loading &&
              datasets.map((ds) => (
                <tr key={ds.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{ds.name}</td>
                  <td className="px-3 py-2 capitalize">{ds.type}</td>
                  <td className="px-3 py-2">{valueBadge(ds.value_type)}</td>
                  <td className="px-3 py-2">{ds.admin_level}</td>
                  <td className="px-3 py-2 flex items-center gap-2">
                    {healthBadge(health[ds.id])}
                    <button
                      onClick={() => recalcSingleHealth(ds)}
                      title="Recalculate health"
                      className="text-gray-500 hover:text-[var(--ssc-blue)]"
                    >
                      <RefreshCcw size={14} />
                    </button>
                  </td>
                  <td className="px-3 py-2 flex gap-3 items-center">
                    <button
                      onClick={() => setEditDataset(ds)}
                      className="text-gray-600 hover:text-[var(--ssc-blue)]"
                      title="Edit metadata"
                    >
                      <Pencil size={16} />
                    </button>
                    {!ds.is_cleaned && (
                      <button
                        onClick={() => handleClean(ds.id, ds.type)}
                        className="text-gray-600 hover:text-amber-600"
                        title="Clean dataset"
                      >
                        <Wand2 size={16} />
                      </button>
                    )}
                    <Link
                      href={`/datasets/raw/${ds.id}`}
                      className="text-gray-600 hover:text-[var(--ssc-blue)]"
                      title="View dataset"
                    >
                      <Eye size={16} />
                    </Link>
                    <button
                      onClick={() => handleDelete(ds.id)}
                      className="text-gray-600 hover:text-red-600"
                      title="Delete dataset"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
