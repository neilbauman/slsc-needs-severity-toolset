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

  // ──────────────────────────────
  // Load datasets
  // ──────────────────────────────
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
    } else {
      console.error('Failed to load datasets', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  // ──────────────────────────────
  // Health calculation
  // ──────────────────────────────
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
      let table: string | null = null;

      // Detect which table the dataset exists in
      const { count: numCount } = await supabase
        .from('dataset_values_numeric')
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', ds.id);
      const { count: catCount } = await supabase
        .from('dataset_values_categorical')
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', ds.id);

      if ((numCount ?? 0) > 0) table = 'dataset_values_numeric';
      else if ((catCount ?? 0) > 0) table = 'dataset_values_categorical';
      if (!table) return null;

      // Count total and valid
      const { count: total } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', ds.id);

      const { count: valid } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', ds.id)
        .filter('value', 'not.is', null)
        .filter('value', 'neq', '');

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

  // ──────────────────────────────
  // Actions
  // ──────────────────────────────
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

  // ──────────────────────────────
  // UI helpers
  // ──────────────────────────────
  const badgeColor = (status: string) => {
    switch (status) {
      case 'absolute':
        return 'bg-blue-100 text-blue-800';
      case 'relative':
        return 'bg-green-100 text-green-800';
      case 'index':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const cleanedStatus = (isCleaned: boolean) =>
    isCleaned ? (
      <span className="text-green-700 font-medium">Cleaned</span>
    ) : (
      <span className="text-red-700 font-medium">Raw</span>
    );

  const healthBadge = (pct: number | null | undefined) => {
    if (pct === null || pct === undefined)
      return (
        <span className="text-gray-400 flex items-center gap-1">
          <Activity size={12} /> –
        </span>
      );

    const color =
      pct >= 90
        ? 'bg-green-100 text-green-800'
        : pct >= 60
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-800';

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${color} flex items-center gap-1`}
      >
        <Activity size={12} /> {pct}%
      </span>
    );
  };

  // ──────────────────────────────
  // UI Rendering
  // ──────────────────────────────
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
            className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text
