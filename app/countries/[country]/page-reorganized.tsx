'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, AlertTriangle, Database, Layers, MapPinned, RefreshCcw, ArrowLeft, Settings, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import { useCountry } from '@/lib/countryContext';
import { getAdminLevelName, getAdminLevelNamesMap } from '@/lib/adminLevelNames';
import ProtectedRoute from '@/components/ProtectedRoute';
import CountryDashboardMap from '@/components/CountryDashboardMap';

const DatasetDetailDrawer = dynamic(() => import('@/components/DatasetDetailDrawer'), { ssr: false });

type Dataset = {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  admin_level?: string | null;
  source?: string | null;
  is_baseline?: boolean | null;
  is_derived?: boolean | null;
  metadata?: Record<string, any> | null;
  updated_at?: string | null;
  created_at?: string | null;
  country_id?: string | null;
};

type PillarKey = 'Core' | 'SSC Framework - P1' | 'SSC Framework - P2' | 'SSC Framework - P3' | 'Hazard' | 'Underlying Vulnerability' | 'Other';

const PILLAR_ORDER: { key: PillarKey; label: string; description: string; color: string }[] = [
  { key: 'Core', label: 'Core Baseline', description: 'Static national baselines & census data', color: 'bg-gray-100 text-gray-700' },
  { key: 'SSC Framework - P1', label: 'The Shelter (P1)', description: 'Structural safety & direct exposure of homes', color: 'bg-blue-100 text-blue-700' },
  { key: 'SSC Framework - P2', label: 'The Living Conditions (P2)', description: 'Physical & socioeconomic fragility factors', color: 'bg-green-100 text-green-700' },
  { key: 'SSC Framework - P3', label: 'The Settlement (P3)', description: 'Readiness of services, governance & access', color: 'bg-purple-100 text-purple-700' },
  { key: 'Hazard', label: 'Hazard Layers', description: 'Recent hazard footprints & alerts', color: 'bg-red-100 text-red-700' },
  { key: 'Underlying Vulnerability', label: 'Underlying Vulnerability', description: 'Chronic structural drivers', color: 'bg-amber-100 text-amber-700' },
];

const determinePillar = (dataset: Dataset): PillarKey => {
  const meta = dataset.metadata || {};
  const raw = (meta.pillar || meta.category || meta.ssc_component || meta.framework_layer || '').toString().trim();
  if (raw) {
    const normalized = raw.toLowerCase();
    if (normalized.includes('core')) return 'Core';
    if (normalized.includes('p1')) return 'SSC Framework - P1';
    if (normalized.includes('p2')) return 'SSC Framework - P2';
    if (normalized.includes('p3')) return 'SSC Framework - P3';
    if (normalized.includes('hazard')) return 'Hazard';
    if (normalized.includes('uv') || normalized.includes('underlying')) return 'Underlying Vulnerability';
  }
  if (dataset.is_baseline) return 'Core';
  return 'Other';
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
};

const getHealthChip = (dataset: Dataset) => {
  const health = dataset?.metadata?.data_health;
  if (!health || health.alignment_rate === undefined) {
    return { label: '—', color: 'bg-gray-100 text-gray-500', percent: null };
  }
  const percent = Math.round((health.alignment_rate || 0) * 100);
  let color = 'bg-green-100 text-green-700';
  if (percent < 60) {
    color = 'bg-red-100 text-red-700';
  } else if (percent < 85) {
    color = 'bg-amber-100 text-amber-700';
  }
  return { label: `${percent}%`, color, percent };
};

const getStatusChip = (dataset: Dataset) => {
  const status = dataset?.metadata?.cleaning_status || dataset?.metadata?.readiness || 'needs_review';
  const statusMap: Record<string, { label: string; color: string }> = {
    ready: { label: 'Ready', color: 'bg-green-100 text-green-700' },
    in_progress: { label: 'In cleaning', color: 'bg-amber-100 text-amber-700' },
    reviewing: { label: 'In review', color: 'bg-blue-100 text-blue-700' },
    needs_review: { label: 'Needs attention', color: 'bg-red-100 text-red-700' },
  };
  return statusMap[status] || statusMap.needs_review;
};

export default function CountryDashboardPageReorganized() {
  const params = useParams();
  const router = useRouter();
  const { currentCountry, availableCountries, setCurrentCountry, adminLevels } = useCountry();
  const countryCode = (params.country as string)?.toUpperCase();
  
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boundaryCounts, setBoundaryCounts] = useState<Record<string, number>>({});
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view');

  // Set current country based on URL
  useEffect(() => {
    if (countryCode && availableCountries.length > 0) {
      const country = availableCountries.find(c => c.iso_code === countryCode);
      if (country && country.id !== currentCountry?.id) {
        setCurrentCountry(country);
      } else if (!country) {
        router.push('/');
      }
    }
  }, [countryCode, availableCountries, currentCountry, setCurrentCountry, router]);

  const loadDashboard = useCallback(async () => {
    if (!countryCode || !availableCountries.length) return;
    
    const targetCountry = availableCountries.find(c => c.iso_code === countryCode);
    if (!targetCountry) return;
    
    try {
      setLoading(true);
      setError(null);

      const [
        { data: datasetData, error: datasetError },
        { data: instanceData, error: instanceError },
      ] = await Promise.all([
        supabase.from('datasets').select('*').eq('country_id', targetCountry.id).order('name'),
        supabase.from('instances').select('*').eq('country_id', targetCountry.id),
      ]);

      if (datasetError) throw datasetError;
      if (instanceError) throw instanceError;

      setDatasets(datasetData || []);
      setInstances(instanceData || []);

      // Count boundaries by level
      const levelCounts: Record<string, number> = {};
      for (const level of ['ADM1', 'ADM2', 'ADM3', 'ADM4']) {
        const { count } = await supabase
          .from('admin_boundaries')
          .select('*', { count: 'exact', head: true })
          .eq('admin_level', level)
          .eq('country_id', targetCountry.id);
        levelCounts[level] = count || 0;
      }
      setBoundaryCounts(levelCounts);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setError(err?.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [countryCode, availableCountries]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const datasetsByPillar = useMemo(() => {
    const grouped = new Map<PillarKey, Dataset[]>();
    PILLAR_ORDER.forEach(pillar => grouped.set(pillar.key, []));
    grouped.set('Other', []);
    
    datasets.forEach(dataset => {
      const pillar = determinePillar(dataset);
      const group = grouped.get(pillar) || [];
      group.push(dataset);
      grouped.set(pillar, group);
    });
    
    return grouped;
  }, [datasets]);

  const coreDatasets = useMemo(() => {
    return datasets.filter(d => {
      const text = `${d.name} ${d.description || ''}`.toLowerCase();
      return text.includes('population') || text.includes('boundary') || d.is_baseline;
    });
  }, [datasets]);

  const adminLevelNamesMap = useMemo(() => {
    return getAdminLevelNamesMap(adminLevels);
  }, [adminLevels]);

  if (!currentCountry) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Loading country...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft size={16} />
                All Countries
              </Link>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                {currentCountry.iso_code}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-amber-600 font-semibold">SLSC Needs Severity Toolset</p>
                <h1 className="text-3xl font-semibold text-gray-900 mt-1">Country Dashboard</h1>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
              Overview of datasets, framework architecture, and administrative structure for {currentCountry.name}.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/datasets"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Database size={16} />
              Manage Datasets
            </Link>
            <Link
              href="/instances"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-sm font-semibold text-white shadow hover:bg-amber-600"
            >
              <Layers size={16} />
              View Instances
            </Link>
          </div>
        </header>

        {error && (
          <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-4 text-sm flex items-center gap-3">
            <AlertTriangle size={16} />
            <span>{error}</span>
            <button className="ml-auto inline-flex items-center gap-1 text-xs font-semibold underline" onClick={loadDashboard}>
              <RefreshCcw size={12} />
              Retry
            </button>
          </div>
        )}

        {/* MAP SECTION - At the top */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Country Map</h2>
            <p className="text-sm text-gray-600">
              Toggle admin levels and dataset overlays to explore geographic data coverage
            </p>
          </div>
          {currentCountry && (
            <CountryDashboardMap
              countryId={currentCountry.id}
              countryCode={currentCountry.iso_code}
              adminLevels={adminLevels}
            />
          )}
        </section>

        {/* ADMIN LEVEL NAMING SECTION */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Administrative Structure</p>
              <h2 className="text-lg font-semibold text-gray-900">Admin Level Naming</h2>
            </div>
            <Link
              href="/datasets?focus=admin_boundaries"
              className="text-xs font-semibold text-amber-600 hover:text-amber-700"
            >
              Manage boundaries
            </Link>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {['ADM1', 'ADM2', 'ADM3', 'ADM4'].map(level => {
              const levelNum = parseInt(level.replace('ADM', ''));
              const levelName = getAdminLevelName(adminLevels, levelNum, false);
              const count = boundaryCounts[level] || 0;
              
              return (
                <div key={level} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500">{level}</span>
                    <span className="text-xs text-gray-400">{count} boundaries</span>
                  </div>
                  <p className="text-base font-semibold text-gray-900">{levelName}</p>
                  {count === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No boundaries imported</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* CORE DATASETS SECTION */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Reference Layers</p>
              <h2 className="text-lg font-semibold text-gray-900">Core Datasets</h2>
              <p className="text-sm text-gray-600 mt-1">Population, boundaries, and baseline reference data</p>
            </div>
            <Link href="/datasets?focus=population" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
              Manage core datasets
            </Link>
          </div>

          {coreDatasets.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8 border border-dashed border-gray-200 rounded-lg">
              No core datasets yet. Upload population and boundary data to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {coreDatasets.map(dataset => {
                const healthChip = getHealthChip(dataset);
                const statusChip = getStatusChip(dataset);
                
                return (
                  <div
                    key={dataset.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                    onClick={() => {
                      setDrawerMode('view');
                      setSelectedDataset(dataset);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-semibold text-gray-900">{dataset.name}</h3>
                          {dataset.is_baseline && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-50 text-green-700">
                              Baseline
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {dataset.type || '—'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                            {dataset.admin_level || '—'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${healthChip.color}`}>
                            Alignment: {healthChip.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${statusChip.color}`}>
                            {statusChip.label}
                          </span>
                        </div>
                        {dataset.description && (
                          <p className="text-xs text-gray-600 mt-2">{dataset.description}</p>
                        )}
                      </div>
                      <Link
                        href={`/datasets/raw/${dataset.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-semibold text-amber-600 hover:text-amber-700 ml-4"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SSC FRAMEWORK ARCHITECTURE */}
        <section className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">SSC Framework</p>
            <h2 className="text-xl font-semibold text-gray-900">Framework Architecture</h2>
            <p className="text-sm text-gray-600 mt-1">
              Datasets organized by SSC pillars and supporting analyses
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* SSC Pillars */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">SSC Pillars</h3>
              {PILLAR_ORDER.filter(p => p.key.startsWith('SSC Framework')).map(pillar => {
                const pillarDatasets = datasetsByPillar.get(pillar.key) || [];
                return (
                  <div key={pillar.key} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${pillar.color}`}>
                            {pillar.key.replace('SSC Framework - ', '')}
                          </span>
                          <h4 className="text-sm font-semibold text-gray-900">{pillar.label}</h4>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{pillar.description}</p>
                      </div>
                      <span className="text-lg font-semibold text-gray-900">{pillarDatasets.length}</span>
                    </div>
                    {pillarDatasets.length > 0 ? (
                      <div className="space-y-2 mt-3">
                        {pillarDatasets.slice(0, 3).map(dataset => {
                          const healthChip = getHealthChip(dataset);
                          return (
                            <div
                              key={dataset.id}
                              className="flex items-center justify-between text-xs p-2 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                setDrawerMode('view');
                                setSelectedDataset(dataset);
                              }}
                            >
                              <span className="text-gray-700 truncate flex-1">{dataset.name}</span>
                              <span className={`px-2 py-0.5 rounded font-semibold ml-2 ${healthChip.color}`}>
                                {healthChip.label}
                              </span>
                            </div>
                          );
                        })}
                        {pillarDatasets.length > 3 && (
                          <Link
                            href={`/datasets?pillar=${pillar.key === 'SSC Framework - P1' ? 'SSC_P1' : pillar.key === 'SSC Framework - P2' ? 'SSC_P2' : 'SSC_P3'}`}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-700 block mt-2"
                          >
                            View all {pillarDatasets.length} datasets →
                          </Link>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No datasets yet</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Supporting Analyses */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Supporting Analyses</h3>
              {PILLAR_ORDER.filter(p => p.key === 'Hazard' || p.key === 'Underlying Vulnerability').map(pillar => {
                const pillarDatasets = datasetsByPillar.get(pillar.key) || [];
                return (
                  <div key={pillar.key} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${pillar.color}`}>
                            {pillar.key === 'Hazard' ? 'H' : 'UV'}
                          </span>
                          <h4 className="text-sm font-semibold text-gray-900">{pillar.label}</h4>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{pillar.description}</p>
                      </div>
                      <span className="text-lg font-semibold text-gray-900">{pillarDatasets.length}</span>
                    </div>
                    {pillarDatasets.length > 0 ? (
                      <div className="space-y-2 mt-3">
                        {pillarDatasets.slice(0, 3).map(dataset => {
                          const healthChip = getHealthChip(dataset);
                          return (
                            <div
                              key={dataset.id}
                              className="flex items-center justify-between text-xs p-2 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                setDrawerMode('view');
                                setSelectedDataset(dataset);
                              }}
                            >
                              <span className="text-gray-700 truncate flex-1">{dataset.name}</span>
                              <span className={`px-2 py-0.5 rounded font-semibold ml-2 ${healthChip.color}`}>
                                {healthChip.label}
                              </span>
                            </div>
                          );
                        })}
                        {pillarDatasets.length > 3 && (
                          <Link
                            href={`/datasets?pillar=${pillar.key === 'Hazard' ? 'hazard' : 'underlying'}`}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-700 block mt-2"
                          >
                            View all {pillarDatasets.length} datasets →
                          </Link>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No datasets yet</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* DATA HEALTH SUMMARY */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Data Quality</p>
              <h2 className="text-lg font-semibold text-gray-900">Dataset Health Summary</h2>
            </div>
            <Link href="/datasets" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
              View detailed audit
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {(() => {
              const ready = datasets.filter(d => {
                const status = d.metadata?.cleaning_status || d.metadata?.readiness;
                return status === 'ready';
              }).length;
              const inProgress = datasets.filter(d => {
                const status = d.metadata?.cleaning_status || d.metadata?.readiness;
                return status === 'in_progress';
              }).length;
              const needsAttention = datasets.filter(d => {
                const status = d.metadata?.cleaning_status || d.metadata?.readiness;
                return !status || status === 'needs_review';
              }).length;
              const total = datasets.length;

              return (
                <>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="text-xs font-semibold text-gray-600">Ready</span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900">{ready}</p>
                    <p className="text-xs text-gray-500 mt-1">{total > 0 ? Math.round((ready / total) * 100) : 0}% of datasets</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={16} className="text-amber-600" />
                      <span className="text-xs font-semibold text-gray-600">In Progress</span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900">{inProgress}</p>
                    <p className="text-xs text-gray-500 mt-1">{total > 0 ? Math.round((inProgress / total) * 100) : 0}% of datasets</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle size={16} className="text-red-600" />
                      <span className="text-xs font-semibold text-gray-600">Needs Attention</span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900">{needsAttention}</p>
                    <p className="text-xs text-gray-500 mt-1">{total > 0 ? Math.round((needsAttention / total) * 100) : 0}% of datasets</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Database size={16} className="text-gray-600" />
                      <span className="text-xs font-semibold text-gray-600">Total Datasets</span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900">{total}</p>
                    <p className="text-xs text-gray-500 mt-1">Across all categories</p>
                  </div>
                </>
              );
            })()}
          </div>
        </section>

        {/* MANAGEMENT SECTION */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Administration</p>
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/datasets/new"
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition flex items-center gap-3"
            >
              <div className="p-2 rounded bg-green-100 text-green-700">
                <Database size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Upload Dataset</p>
                <p className="text-xs text-gray-600">Add new baseline data</p>
              </div>
            </Link>

            <Link
              href="/instances/new"
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition flex items-center gap-3"
            >
              <div className="p-2 rounded bg-blue-100 text-blue-700">
                <Layers size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Create Instance</p>
                <p className="text-xs text-gray-600">Start new response scenario</p>
              </div>
            </Link>

            <Link
              href="/datasets"
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition flex items-center gap-3"
            >
              <div className="p-2 rounded bg-amber-100 text-amber-700">
                <Settings size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Manage Datasets</p>
                <p className="text-xs text-gray-600">Review and clean data</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Dataset Detail Drawer */}
        {selectedDataset && (
          <DatasetDetailDrawer
            dataset={selectedDataset}
            mode={drawerMode}
            onClose={() => setSelectedDataset(null)}
            onSaved={loadDashboard}
            onDelete={async (id: string) => {
              await supabase.from('datasets').delete().eq('id', id);
              loadDashboard();
              setSelectedDataset(null);
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
