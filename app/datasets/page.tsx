'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  PlusCircle,
  Eye,
  Trash2,
  Pencil,
  Wand2,
  Activity,
  RefreshCcw,
} from 'lucide-react';
import UploadDatasetModal from '@/components/UploadDatasetModal';
import DeriveDatasetModal from '@/components/DeriveDatasetModal';
import EditDatasetModal from '@/components/EditDatasetModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
  created_at: string;
  is_cleaned: boolean;
  absolute_relative_index: 'absolute' | 'relative' | 'index';
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [health, setHealth] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deriveOpen, setDeriveOpen] = useState(false);
  const [editDataset, setEditDataset] = useState<Dataset | null>(null);

  // ────────────────────────────────────────────────
  // Load datasets
  // ────────────────────────────────────────────────
  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select(
        'id, name, type, admin_level, created_at, is_cleaned, absolute_relative_index'
      )
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDatasets(data as Dataset[]);
      await fetchHealthForDatasets(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  // ────────────────────────────────────────────────
  // Dynamic Health Calculation
  // ────────────────────────────────────────────────
  const fetchHealthForDatasets = async (list: Dataset[]) => {
    const newHealth: Record<string, number | null> = {};

    for (const ds of list) {
      const pct = await calculateHealth(ds);
      newHealth[ds.id] = pct;
    }

    setHealth(newHealth);
  };

  const calculateHealth = async (ds: Dataset): Promise<number | null> => {
    try {
      // Try all possible dataset tables for this dataset
      const candidates =
        ds.type === 'numeric'
          ? ['dataset_values_numeric', 'dataset_values_numeric_raw']
          : ['dataset_values_categorical', 'dataset_values_categorical_raw'];

      let table: string | null = null;
      let valueCol = 'value';

      for (const t of candidates) {
        const { count } = await supabase
          .from(t)
          .select('*', { count: 'exact', head: true })
          .eq('dataset_id', ds.id);
        if ((count ?? 0) > 0) {
          table = t;
          valueCol = t.includes('_raw') ? 'value_raw' : 'value';
          break;
        }
      }

      if (!table) return null;

      const { count: total } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', ds.id);

      const { count: valid } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', ds.id)
        .not(valueCol, 'is', null)
        .not(valueCol, 'eq', '');

      if (!total || total === 0) return null;
      return Math.round(((valid ?? 0) / total) * 100);
    } catch (err) {
      console.error(`Health calc failed for ${ds.name}`, err);
      return null;
    }
  };

  const recalcSingleHealth = async (ds: Dataset) => {
    const pct = await calculateHealth(ds);
    setHealth((prev) => ({ ...prev, [ds.id]: pct }));
  };

  const recalcAllHealth = async () => {
    setRefreshing(true);
    await fetchHealthForDatasets(datasets);
    setRefreshing(false);
  };

  // ────────────────────────────────────────────────
  // Actions
  // ────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return;
    const { error } = await supabase.from('datasets').delete().eq('id', id);
    if (!error) loadDatasets();
  };

  const handleClean = (id: string, type: string) => {
    window.location.href = `/datasets/raw/${id}${
      type === 'categorical' ? '?type=categorical' : ''
    }`;
  };

  // ────────────────────────────────────────────────
  // UI helpers
  // ────────────────────────────────────────────────
  const badgeColor = (status: string) => {
    switch (status) {
      case 'absolute':
        return 'bg-[var(--ssc-blue-light)] text-[var(--ssc-blue)]';
      case 'relative':
        return 'bg-[var(--ssc-green-light)] text-[var(--ssc-green)]';
      case 'index':
        return 'bg-[var(--ssc-purple-light)] text-[var(--ssc-purple)]';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const cleanedStatus = (isCleaned: boolean) =>
    isCleaned ? (
      <span className="text-[var(--ssc-green)] font-medium">Cleaned</span>
    ) : (
      <span className="text-[var(--ssc-red)] font-medium">Raw</span>
    );

  const healthBadge = (pct: number | null | undefined) => {
    if (pct === null || pct === undefined)
      return (
        <span className="text-gray-400 flex items-center gap-1">
          <Activity size={12} /> –
        </span>
      );

    let colorClass = '';
    if (pct >= 90) colorClass = 'bg-[var(--ssc-green-light)] text-[var(--ssc-green)]';
    else if (pct >= 60) colorClass = 'bg-[var(--ssc-orange-light)] text-[var(--ssc-orange)]';
    else colorClass = 'bg-[var(--ssc-red-light)] text-[var(--ssc-red)]';

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${colorClass} flex items-center gap-1`}
        title="Percentage of non-null, non-empty values in the dataset"
      >
        <Activity size={12} /> {pct}%
      </span>
    );
  };

  // ────────────────────────────────────────────────
  // UI Rendering
  // ────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Datasets</h1>
          <p className="text-gray-500 text-sm">
            Manage raw, cleaned, and derived datasets.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={recalcAllHealth}
            disabled={refreshing}
            className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm font-medium"
          >
            <RefreshCcw
              size={16}
              className={refreshing ? 'animate-spin text-[var(--ssc-blue)]' : ''}
            />
            {refreshing ? 'Recalculating…' : 'Recalculate Health'}
          </button>

          <button
            onClick={() => setDeriveOpen(true)}
            className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm font-medium"
          >
            <PlusCircle size={16} /> Derived Dataset
          </button>

          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1 px-3 py-2 bg-[var(--ssc-blue)] text-white rounded hover:bg-blue-800 text-sm font-medium !opacity-100 !visible"
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
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Admin Level</th>
              <th className="px-3 py-2 text-left">Abs/Rel/Idx</th>
              <th className="px-3 py-2 text-left">Uploaded</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Health</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : datasets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  No datasets found.
                </td>
              </tr>
            ) : (
              datasets.map((ds) => (
                <tr key={ds.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {ds.name}
                  </td>
                  <td className="px-3 py-2 capitalize">{ds.type}</td>
                  <td className="px-3 py-2">{ds.admin_level}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${badgeColor(
                        ds.absolute_relative_index
                      )}`}
                    >
                      {ds.absolute_relative_index}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {new Date(ds.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{cleanedStatus(ds.is_cleaned)}</td>
                  <td className="px-3 py-2">
                    <div className="inline-flex items-center gap-2">
                      {healthBadge(health[ds.id])}
                      <button
                        onClick={() => recalcSingleHealth(ds)}
                        title="Recalculate health"
                        className="text-gray-500 hover:text-[var(--ssc-blue)]"
                      >
                        <RefreshCcw size={14} />
                      </button>
                    </div>
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
                    <button
                      onClick={() =>
                        (window.location.href = `/datasets/raw/${ds.id}`)
                      }
                      className="text-gray-600 hover:text-[var(--ssc-blue)]"
                      title="View dataset"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(ds.id)}
                      className="text-gray-600 hover:text-red-600"
                      title="Delete dataset"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
