'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Info, Layers3, ShieldCheck, AlertTriangle, Filter } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import EditDatasetModal from '@/components/EditDatasetModal';
import DatasetDetailDrawer from '@/components/DatasetDetailDrawer';

const determinePillar = (dataset: any) => {
  const meta = dataset?.metadata || {};
  const raw = (meta.pillar || meta.category || meta.ssc_component || meta.framework_layer || '').toString().trim();
  if (raw) {
    const normalized = raw.toLowerCase();
    if (normalized.includes('p1')) return 'SSC_P1';
    if (normalized.includes('p2')) return 'SSC_P2';
    if (normalized.includes('p3')) return 'SSC_P3';
    if (normalized.includes('hazard')) return 'hazard';
    if (normalized.includes('underlying') || normalized.includes('uv')) return 'underlying';
  }
  if (dataset?.is_baseline) return 'reference';
  return 'other';
};

const matchesPopulation = (dataset: any) => {
  const haystack = `${dataset?.name ?? ''} ${dataset?.description ?? ''} ${JSON.stringify(dataset?.metadata ?? {})}`.toLowerCase();
  return haystack.includes('population');
};

const FILTERS = [
  { id: 'all', label: 'All datasets' },
  { id: 'reference', label: 'Reference layers' },
  { id: 'ssc', label: 'SSC pillars' },
  { id: 'hazard', label: 'Hazard layers' },
  { id: 'underlying', label: 'Underlying vulnerability' },
  { id: 'instance', label: 'Instance-only' },
];

const statusChips: Record<string, { label: string; color: string }> = {
  ready: { label: 'Ready', color: 'bg-green-100 text-green-700' },
  in_progress: { label: 'Cleaning', color: 'bg-amber-100 text-amber-700' },
  needs_review: { label: 'Needs review', color: 'bg-red-100 text-red-700' },
  archived: { label: 'Archived', color: 'bg-gray-200 text-gray-600' },
};

const getStatusChip = (dataset: any) => {
  const meta = dataset?.metadata || {};
  const statusKey = meta.readiness || meta.cleaning_status || 'needs_review';
  return statusChips[statusKey] || statusChips.needs_review;
};

function DatasetsPageContent() {
  const searchParams = useSearchParams();
  const pillarParam = searchParams.get('pillar');
  const focusParam = searchParams.get('focus');
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDataset, setEditingDataset] = useState<any | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<any | null>(null);
  const [pillarFilter, setPillarFilter] = useState<string | null>(pillarParam);
  const [focusFilter, setFocusFilter] = useState<string | null>(focusParam);
  const [scopeFilter, setScopeFilter] = useState<string>('all');

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading datasets:', error);
    } else {
      setDatasets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    setPillarFilter(pillarParam);
    setFocusFilter(focusParam);
    if (pillarParam) {
      setScopeFilter('ssc');
    }
  }, [pillarParam, focusParam]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return;
    const { error } = await supabase.from('datasets').delete().eq('id', id);
    if (error) {
      console.error('Error deleting dataset:', error);
      alert('Failed to delete dataset.');
    } else {
      setSelectedDataset(null);
      loadDatasets();
    }
  };

  const filteredDatasets = useMemo(() => {
    return datasets.filter((dataset) => {
      const pillar = determinePillar(dataset);
      if (pillarFilter && pillarFilter !== pillar && pillarFilter !== dataset.metadata?.pillar) {
        return false;
      }
      if (focusFilter === 'population' && !matchesPopulation(dataset)) {
        return false;
      }
      if (focusFilter === 'admin_boundaries') {
        return false;
      }
      if (scopeFilter === 'reference' && pillar !== 'reference') return false;
      if (scopeFilter === 'ssc' && !['SSC_P1', 'SSC_P2', 'SSC_P3'].includes(pillar)) return false;
      if (scopeFilter === 'hazard' && pillar !== 'hazard') return false;
      if (scopeFilter === 'underlying' && pillar !== 'underlying') return false;
      if (scopeFilter === 'instance' && dataset.is_baseline) return false;
      return true;
    });
  }, [datasets, pillarFilter, focusFilter, scopeFilter]);

  const clearFilters = () => {
    setPillarFilter(null);
    setFocusFilter(null);
    setScopeFilter('all');
  };

  const filterActive = Boolean(pillarFilter || focusFilter || scopeFilter !== 'all');

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold">Catalog</p>
          <h1 className="text-3xl font-semibold text-gray-900">Datasets workspace</h1>
          <p className="text-sm text-gray-600 max-w-2xl">
            Review, categorize, and clean datasets before wiring them into SSC instances. Use the filters to focus on
            reference layers, SSC pillars, or supporting analyses.
          </p>
        </div>
        <Link
          href="/datasets/new"
          className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700"
        >
          + New dataset
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setScopeFilter(filter.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
              scopeFilter === filter.id
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <Filter size={12} />
            {filter.label}
          </button>
        ))}
      </div>

      {filterActive && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>
            Showing datasets filtered to{' '}
            {[
              scopeFilter && scopeFilter !== 'all' ? `group "${scopeFilter}"` : null,
              pillarFilter ? `pillar "${pillarFilter}"` : null,
              focusFilter ? `focus "${focusFilter}"` : null,
            ]
              .filter(Boolean)
              .join(' and ')}
          </span>
          <button
            onClick={clearFilters}
            className="rounded bg-white/80 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-white"
          >
            Clear filters
          </button>
        </div>
      )}

      {focusFilter === 'admin_boundaries' && (
        <div className="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <Info size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Admin boundaries live in the reference table.</p>
            <p>
              Use the Supabase table <code className="bg-white px-1">admin_boundaries</code> or the RPCs to update PCodes,
              place names, relationships, and geometry.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading datasets…</p>
      ) : (
        <>
          {filteredDatasets.length === 0 ? (
            <p className="rounded border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
              No datasets found for the current filters.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDatasets.map((dataset) => {
                const status = getStatusChip(dataset);
                const isPopulation = matchesPopulation(dataset);
                return (
                  <button
                    key={dataset.id}
                    onClick={() => setSelectedDataset(dataset)}
                    className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {dataset.is_baseline ? 'Reference layer' : 'Dataset'}
                        </p>
                        <h3 className="text-lg font-semibold text-gray-900">{dataset.name}</h3>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                      {dataset.description || 'No description yet.'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-gray-600">
                      {dataset.admin_level && (
                        <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
                          {dataset.admin_level}
                        </span>
                      )}
                      {dataset.type && (
                        <span className="rounded-full bg-gray-100 px-2 py-1">{dataset.type}</span>
                      )}
                      {dataset.is_derived && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">Derived</span>
                      )}
                      {isPopulation && (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">Population</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {editingDataset && (
        <EditDatasetModal
          dataset={editingDataset}
          onClose={() => setEditingDataset(null)}
          onSaved={loadDatasets}
        />
      )}

      {selectedDataset && (
        <DatasetDetailDrawer
          dataset={selectedDataset}
          onClose={() => setSelectedDataset(null)}
          onEdit={(dataset) => {
            setEditingDataset(dataset);
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

export default function DatasetsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading datasets…</div>}>
      <DatasetsPageContent />
    </Suspense>
  );
}
