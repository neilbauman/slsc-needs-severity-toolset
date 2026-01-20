'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Info, Filter } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import DatasetDetailDrawer from '@/components/DatasetDetailDrawer';
import { useCountry } from '@/lib/countryContext';

type CategoryKey = 'CORE' | 'SSC_P1' | 'SSC_P2' | 'SSC_P3' | 'HAZARD' | 'UNDERLYING' | 'OTHER';

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  CORE: 'Core',
  SSC_P1: 'SSC P1',
  SSC_P2: 'SSC P2',
  SSC_P3: 'SSC P3',
  HAZARD: 'Hazard',
  UNDERLYING: 'Underlying Vulnerability',
  OTHER: 'Uncategorized',
};

const mapStringToCategoryKey = (value?: string | null): CategoryKey | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes('core')) return 'CORE';
  if (normalized.includes('p1')) return 'SSC_P1';
  if (normalized.includes('p2')) return 'SSC_P2';
  if (normalized.includes('p3')) return 'SSC_P3';
  if (normalized.includes('hazard')) return 'HAZARD';
  if (normalized.includes('underlying') || normalized.includes('uv')) return 'UNDERLYING';
  return null;
};

const deriveCategoryKey = (dataset: any): CategoryKey => {
  return (
    mapStringToCategoryKey(dataset?.category) ||
    mapStringToCategoryKey(dataset?.metadata?.pillar) ||
    mapStringToCategoryKey(dataset?.metadata?.ssc_component) ||
    mapStringToCategoryKey(dataset?.metadata?.framework_layer) ||
    (dataset?.is_baseline ? 'CORE' : null) ||
    'OTHER'
  );
};

const mapQueryParamToCategoryKey = (param: string | null): CategoryKey | null => {
  return mapStringToCategoryKey(param);
};

const getCategoryLabel = (key?: CategoryKey | null) => CATEGORY_LABELS[key ?? 'OTHER'];

type DataHealthInfo = {
  matched?: number | null;
  total?: number | null;
  percent?: number | null;
  alignment_rate?: number | null;
  coverage?: number | null;
  completeness?: number | null;
  uniqueness?: number | null;
  validation_errors?: number | null;
};

const getDataHealthInfo = (dataset: any): DataHealthInfo | null => {
  const health = dataset?.metadata?.data_health;
  if (!health) return null;
  const rawPercent = health.percent;
  let percent: number | null = null;
  if (typeof rawPercent === 'number') {
    percent = rawPercent > 1 ? rawPercent / 100 : rawPercent;
  }
  const matched = typeof health.matched === 'number' ? health.matched : health.aligned;
  const total = typeof health.total === 'number' ? health.total : health.count;
  if ((percent == null || Number.isNaN(percent)) && typeof matched === 'number' && typeof total === 'number' && total > 0) {
    percent = matched / total;
  }
  // Use alignment_rate if available, otherwise fall back to calculated percent
  const alignmentRate = typeof health.alignment_rate === 'number' ? health.alignment_rate : percent;
  return {
    matched: typeof matched === 'number' ? matched : null,
    total: typeof total === 'number' ? total : null,
    percent: alignmentRate,
    alignment_rate: alignmentRate,
    coverage: typeof health.coverage === 'number' ? health.coverage : null,
    completeness: typeof health.completeness === 'number' ? health.completeness : null,
    uniqueness: typeof health.uniqueness === 'number' ? health.uniqueness : null,
    validation_errors: typeof health.validation_errors === 'number' ? health.validation_errors : null,
  };
};

const formatHealthPercent = (info: DataHealthInfo | null) => {
  if (!info || info.percent == null || Number.isNaN(info.percent)) return null;
  return Math.round(info.percent * 100);
};

const getHealthChip = (dataset: any) => {
  const info = getDataHealthInfo(dataset);
  const percent = formatHealthPercent(info);
  if (percent == null) {
    return { label: '—', color: 'bg-gray-100 text-gray-500', info: null };
  }
  let color = 'bg-green-100 text-green-700';
  if (percent < 60) {
    color = 'bg-red-100 text-red-700';
  } else if (percent < 85) {
    color = 'bg-amber-100 text-amber-700';
  }
  return { label: `${percent}%`, color, info };
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
  in_progress: { label: 'In cleaning', color: 'bg-amber-100 text-amber-700' },
  reviewing: { label: 'In review', color: 'bg-blue-100 text-blue-700' },
  needs_review: { label: 'Needs attention', color: 'bg-red-100 text-red-700' },
  raw: { label: 'Raw import', color: 'bg-gray-200 text-gray-700' },
  archived: { label: 'Archived', color: 'bg-gray-200 text-gray-600' },
};

const getCleaningStatusKey = (dataset: any) => {
  const meta = dataset?.metadata || {};
  return meta.cleaning_status || meta.readiness || 'needs_review';
};

const getStatusChip = (dataset: any) => {
  const statusKey = getCleaningStatusKey(dataset);
  return statusChips[statusKey] || statusChips.needs_review;
};

function DatasetsPageContent() {
  const searchParams = useSearchParams();
  const pillarParam = searchParams.get('pillar');
  const focusParam = searchParams.get('focus');
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<any | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey | null>(mapQueryParamToCategoryKey(pillarParam));
  const [focusFilter, setFocusFilter] = useState<string | null>(focusParam);
  const [scopeFilter, setScopeFilter] = useState<string>('all');

  const { currentCountry } = useCountry();

  const loadDatasets = async () => {
    setLoading(true);
    
    // Build query with country filter if country is selected
    let query = supabase
      .from('datasets')
      .select('*');
    
    // Filter by country if one is selected
    if (currentCountry) {
      query = query.eq('country_id', currentCountry.id);
    }
    
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('Error loading datasets:', error);
    } else {
      setDatasets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, [currentCountry]);

  useEffect(() => {
    const mappedCategory = mapQueryParamToCategoryKey(pillarParam);
    setCategoryFilter(mappedCategory);
    setFocusFilter(focusParam);
    if (mappedCategory) {
      if (['SSC_P1', 'SSC_P2', 'SSC_P3'].includes(mappedCategory)) {
        setScopeFilter('ssc');
      } else if (mappedCategory === 'CORE') {
        setScopeFilter('reference');
      } else if (mappedCategory === 'HAZARD') {
        setScopeFilter('hazard');
      } else if (mappedCategory === 'UNDERLYING') {
        setScopeFilter('underlying');
      }
    }
  }, [pillarParam, focusParam]);

  const handleDelete = async (id: string) => {
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
      // Filter out computed hazard scores - these are analysis results from hazard events,
      // not uploaded datasets. They're stored in hazard_event_scores table.
      // Hazard scores should be managed through the instance scoring interface, not here.
      const name = (dataset.name || '').toLowerCase();
      const isComputedHazardScore = 
        (name === 'hazard score' || name === 'hazards/risks score') &&
        (dataset.is_derived || dataset.metadata?.source === 'hazard_event_analysis');
      
      if (isComputedHazardScore) {
        return false; // Hide computed hazard scores from datasets workspace
      }
      
      const categoryKey = deriveCategoryKey(dataset);
      if (categoryFilter && categoryFilter !== categoryKey) {
        return false;
      }
      if (focusFilter === 'population' && !matchesPopulation(dataset)) {
        return false;
      }
      if (focusFilter === 'admin_boundaries') {
        return false;
      }
      if (scopeFilter === 'reference' && categoryKey !== 'CORE') return false;
      if (scopeFilter === 'ssc' && !['SSC_P1', 'SSC_P2', 'SSC_P3'].includes(categoryKey)) return false;
      if (scopeFilter === 'hazard' && categoryKey !== 'HAZARD') return false;
      if (scopeFilter === 'underlying' && categoryKey !== 'UNDERLYING') return false;
      if (scopeFilter === 'instance' && dataset.is_baseline) return false;
      return true;
    });
  }, [datasets, categoryFilter, focusFilter, scopeFilter]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  const sortedDatasets = useMemo(() => {
    const list = [...filteredDatasets];
    list.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      if (sortConfig.key === 'category') {
        aValue = getCategoryLabel(deriveCategoryKey(a));
        bValue = getCategoryLabel(deriveCategoryKey(b));
      } else if (sortConfig.key === 'data_health') {
        aValue = formatHealthPercent(getDataHealthInfo(a)) ?? -1;
        bValue = formatHealthPercent(getDataHealthInfo(b)) ?? -1;
      } else if (sortConfig.key === 'cleaning_status') {
        aValue = getCleaningStatusKey(a);
        bValue = getCleaningStatusKey(b);
      } else {
        aValue = a?.[sortConfig.key] ?? a?.metadata?.[sortConfig.key] ?? '';
        bValue = b?.[sortConfig.key] ?? b?.metadata?.[sortConfig.key] ?? '';
      }
      if (aValue === bValue) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1;
      if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      return sortConfig.direction === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
    return list;
  }, [filteredDatasets, sortConfig]);

  const clearFilters = () => {
    setCategoryFilter(null);
    setFocusFilter(null);
    setScopeFilter('all');
  };

  const filterActive = Boolean(categoryFilter || focusFilter || scopeFilter !== 'all');

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
      <p className="text-xs text-gray-500">
        Data health reflects alignment, coverage, completeness, and uniqueness metrics. Click on a dataset to view
        detailed metrics and start the cleaning workflow.
      </p>
      <div className="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Note: Hazard Scores are computed analysis results</p>
          <p className="text-xs mt-1">
            Hazard scores are generated from hazard event analysis (e.g., earthquake shake maps) and stored in the <code className="bg-white px-1">hazard_event_scores</code> table. 
            They are not uploaded datasets and are managed through the instance scoring interface. 
            To view or manage hazard events, go to an instance page and use the scoring configuration.
          </p>
        </div>
      </div>

      {filterActive && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>
            Showing datasets filtered to{' '}
            {[
              scopeFilter && scopeFilter !== 'all' ? `group "${scopeFilter}"` : null,
              categoryFilter ? `category "${getCategoryLabel(categoryFilter)}"` : null,
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
          {sortedDatasets.length === 0 ? (
            <p className="rounded border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
              No datasets found for the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    {[
                      { key: 'name', label: 'Name' },
                      { key: 'category', label: 'Category' },
                      { key: 'admin_level', label: 'Admin level' },
                      { key: 'type', label: 'Type' },
                      { key: 'data_health', label: 'Alignment' },
                      { key: 'cleaning_status', label: 'Status' },
                      { key: 'updated_at', label: 'Updated' },
                    ].map((col) => (
                      <th key={col.key} className="px-4 py-3">
                        <button
                          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                          onClick={() =>
                            setSortConfig((prev) => ({
                              key: col.key,
                              direction: prev.key === col.key && prev.direction === 'asc' ? 'desc' : 'asc',
                            }))
                          }
                        >
                          {col.label}
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedDatasets.map((dataset) => {
                    const status = getStatusChip(dataset);
                    const categoryKey = deriveCategoryKey(dataset);
                    const categoryLabel = getCategoryLabel(categoryKey);
                    const healthChip = getHealthChip(dataset);
                    return (
                      <tr
                        key={dataset.id}
                        className="hover:bg-amber-50/40 cursor-pointer"
                        onClick={() => {
                          setDrawerMode('view');
                          setSelectedDataset(dataset);
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{dataset.name}</td>
                        <td className="px-4 py-3 text-gray-600">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrawerMode('edit');
                              setSelectedDataset(dataset);
                            }}
                            className="hover:text-amber-600 hover:underline"
                            title="Click to edit category"
                          >
                            {categoryLabel}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{dataset.admin_level || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{dataset.type || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${healthChip.color} w-fit`}>
                              {healthChip.label}
                            </span>
                            {healthChip.info && (
                              <div className="text-xs text-gray-500">
                                {healthChip.info.coverage != null && (
                                  <span>Coverage: {Math.round(healthChip.info.coverage * 100)}%</span>
                                )}
                                {healthChip.info.completeness != null && healthChip.info.coverage != null && ' • '}
                                {healthChip.info.completeness != null && (
                                  <span>Complete: {Math.round(healthChip.info.completeness * 100)}%</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {dataset.updated_at ? new Date(dataset.updated_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrawerMode('view');
                              setSelectedDataset(dataset);
                            }}
                          >
                            View
                          </button>
                          <button
                            className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrawerMode('edit');
                              setSelectedDataset(dataset);
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedDataset && (
        <DatasetDetailDrawer
          dataset={selectedDataset}
          mode={drawerMode}
          onClose={() => setSelectedDataset(null)}
          onSaved={loadDatasets}
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
