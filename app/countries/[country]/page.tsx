'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, AlertTriangle, Database, Layers, MapPinned, RefreshCcw, ArrowLeft } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import type { GeoJSON } from 'geojson';
import { useCountry } from '@/lib/countryContext';
import ProtectedRoute from '@/components/ProtectedRoute';

const DashboardMap = dynamic(() => import('@/components/DashboardMap'), { ssr: false });

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

type Instance = {
  id: string;
  name: string;
  description?: string | null;
  admin_level?: string | null;
  status?: string | null;
  metadata?: Record<string, any> | null;
  updated_at?: string | null;
  created_at?: string | null;
  country_id?: string | null;
};

type InstanceDatasetLink = {
  instance_id: string;
  dataset_id: string;
};

type PillarKey =
  | 'Core'
  | 'SSC Framework - P1'
  | 'SSC Framework - P2'
  | 'SSC Framework - P3'
  | 'Hazard'
  | 'Underlying Vulnerability'
  | 'Other';

const PILLAR_ORDER: { key: PillarKey; label: string; description: string; group: 'ssc' | 'supporting' | 'core' }[] = [
  {
    key: 'Core',
    label: 'Core Baseline',
    description: 'Static national baselines & census data.',
    group: 'core',
  },
  {
    key: 'SSC Framework - P1',
    label: 'The Shelter (P1)',
    description: 'Structural safety & direct exposure of homes.',
    group: 'ssc',
  },
  {
    key: 'SSC Framework - P2',
    label: 'The Living Conditions (P2)',
    description: 'Physical & socioeconomic fragility factors.',
    group: 'ssc',
  },
  {
    key: 'SSC Framework - P3',
    label: 'The Settlement (P3)',
    description: 'Readiness of services, governance & access.',
    group: 'ssc',
  },
  {
    key: 'Hazard',
    label: 'Hazard Layers',
    description: 'Recent hazard footprints & alerts.',
    group: 'supporting',
  },
  {
    key: 'Underlying Vulnerability',
    label: 'Underlying Vulnerability',
    description: 'Chronic structural drivers.',
    group: 'supporting',
  },
  {
    key: 'Other',
    label: 'Uncategorized',
    description: 'Datasets awaiting classification.',
    group: 'supporting',
  },
];

const DEFAULT_PILLAR: PillarKey = 'Underlying Vulnerability';
const PILLAR_FILTER_PARAM: Record<PillarKey, string> = {
  Core: 'core',
  'SSC Framework - P1': 'SSC_P1',
  'SSC Framework - P2': 'SSC_P2',
  'SSC Framework - P3': 'SSC_P3',
  Hazard: 'hazard',
  'Underlying Vulnerability': 'underlying',
  Other: 'other',
};
const ADMIN_LEVELS: Array<'ADM1' | 'ADM2' | 'ADM3' | 'ADM4'> = ['ADM1', 'ADM2', 'ADM3', 'ADM4'];

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
  return DEFAULT_PILLAR;
};

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: typeof Activity;
  accent?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-start gap-4">
      <div
        className={`p-3 rounded-full ${accent || 'bg-amber-100 text-amber-700'}`}
      >
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
        <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
        {sublabel && <p className="text-xs text-gray-500 mt-1">{sublabel}</p>}
      </div>
    </div>
  );
}

function PillarCard({
  label,
  description,
  value,
  percent,
  href,
  linkLabel,
}: {
  label: string;
  description: string;
  value: number;
  percent: number;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <span className="text-lg font-semibold text-gray-900">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-amber-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">{percent.toFixed(0)}% of datasets</p>
      {href && (
        <Link href={href} className="text-xs font-semibold text-amber-600 hover:text-amber-700 mt-2 inline-block">
          {linkLabel || 'Manage datasets'}
        </Link>
      )}
    </div>
  );
}

function ReferenceCard({
  title,
  subtitle,
  stat,
  detail,
  icon: Icon,
  href,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  stat: string;
  detail?: string;
  icon: typeof Database;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm flex items-start gap-4">
      <div className="p-3 rounded-full bg-gray-100 text-gray-600">
        <Icon size={18} />
      </div>
      <div className="space-y-1 flex-1">
        <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold">{subtitle}</p>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-2xl font-semibold text-gray-900">{stat}</p>
        {detail && <p className="text-sm text-gray-600">{detail}</p>}
        {href && (
          <Link href={href} className="text-xs font-semibold text-amber-600 hover:text-amber-700">
            {linkLabel || 'Manage'}
          </Link>
        )}
      </div>
    </div>
  );
}

const numberFormatter = new Intl.NumberFormat('en-PH');

export default function CountryDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { currentCountry, availableCountries, setCurrentCountry } = useCountry();
  const countryCode = (params.country as string)?.toUpperCase();
  
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instanceDatasets, setInstanceDatasets] = useState<InstanceDatasetLink[]>([]);
  const [adminBoundaryGeo, setAdminBoundaryGeo] = useState<GeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boundaryCounts, setBoundaryCounts] = useState<Record<string, number>>({
    ADM1: 0,
    ADM2: 0,
    ADM3: 0,
    ADM4: 0,
  });

  // Set current country based on URL
  useEffect(() => {
    if (countryCode && availableCountries.length > 0) {
      const country = availableCountries.find(c => c.iso_code === countryCode);
      if (country && country.id !== currentCountry?.id) {
        setCurrentCountry(country);
      } else if (!country) {
        // Country not found or no access
        router.push('/');
      }
    }
  }, [countryCode, availableCountries, currentCountry, setCurrentCountry, router]);

  const loadDashboard = useCallback(async () => {
    if (!currentCountry) return;
    
    try {
      setLoading(true);
      setError(null);

      // Get filtered datasets and instances first
      const [
        { data: datasetData, error: datasetError },
        { data: instanceData, error: instanceError },
      ] =
        await Promise.all([
          supabase.from('datasets').select('*').eq('country_id', currentCountry.id).order('name', { ascending: true }),
          supabase.from('instances').select('*').eq('country_id', currentCountry.id),
        ]);

      if (datasetError) throw datasetError;
      if (instanceError) throw instanceError;

      // Filter instance_datasets to only include links where both instance and dataset belong to this country
      const datasetIds = (datasetData || []).map(d => d.id);
      const instanceIds = (instanceData || []).map(i => i.id);
      
      let instanceDatasetData: any[] = [];
      if (instanceIds.length > 0 && datasetIds.length > 0) {
        const { data: linkData, error: linkError } = await supabase
          .from('instance_datasets')
          .select('instance_id,dataset_id')
          .in('instance_id', instanceIds)
          .in('dataset_id', datasetIds);
        
        if (linkError) throw linkError;
        instanceDatasetData = linkData || [];
      }

      setDatasets(datasetData || []);
      const sortedInstances = (instanceData || []).slice().sort((a, b) => {
        const aTime = a?.updated_at || a?.created_at;
        const bTime = b?.updated_at || b?.created_at;
        const aMsRaw = aTime ? new Date(aTime).getTime() : NaN;
        const bMsRaw = bTime ? new Date(bTime).getTime() : NaN;
        const aMs = Number.isFinite(aMsRaw) ? aMsRaw : 0;
        const bMs = Number.isFinite(bMsRaw) ? bMsRaw : 0;
        return bMs - aMs;
      });
      setInstances(sortedInstances);
      setInstanceDatasets(instanceDatasetData || []);

      // Try to load admin boundaries - gracefully handle if function doesn't exist
      try {
        const { data: geojsonData, error: geoError } = await supabase.rpc('get_admin_boundaries_geojson', {
          admin_level: 'ADM1',
          country_id: currentCountry.id,
        });
        if (geoError) {
          // Function might not exist yet - that's okay, just log it
          if (geoError.code === 'PGRST202') {
            console.info('Admin boundaries RPC function not found - skipping map data');
          } else {
            console.warn('Failed to load admin boundaries:', geoError);
          }
        } else {
          setAdminBoundaryGeo(geojsonData as GeoJSON);
        }
      } catch (err) {
        // Silently handle errors - map is optional
        console.info('Admin boundaries not available');
      }

      // Count admin boundaries by level
      const levelCounts = await Promise.all(
        ADMIN_LEVELS.map(async (level) => {
          try {
            const result = await supabase
              .from('admin_boundaries')
              .select('admin_pcode', { count: 'exact', head: true })
              .eq('admin_level', level)
              .eq('country_id', currentCountry.id);
            return result;
          } catch (err) {
            console.warn(`Failed to count ${level}:`, err);
            return { count: 0, error: null };
          }
        }),
      );
      const nextCounts: Record<string, number> = {
        ADM1: 0,
        ADM2: 0,
        ADM3: 0,
        ADM4: 0,
      };
      levelCounts.forEach((result, idx) => {
        const level = ADMIN_LEVELS[idx];
        if (result.error) {
          console.warn(`Failed to count ${level}`, result.error);
          nextCounts[level] = 0;
        } else {
          nextCounts[level] = result.count ?? 0;
        }
      });
      setBoundaryCounts(nextCounts);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setError(err?.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [currentCountry]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const datasetUsageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    instanceDatasets.forEach((row) => {
      counts.set(row.dataset_id, (counts.get(row.dataset_id) || 0) + 1);
    });
    return counts;
  }, [instanceDatasets]);

  const instanceDatasetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    instanceDatasets.forEach((row) => {
      counts.set(row.instance_id, (counts.get(row.instance_id) || 0) + 1);
    });
    return counts;
  }, [instanceDatasets]);

  const datasetStats = useMemo(() => {
    const baseline = datasets.filter((d) => d.is_baseline).length;
    const derived = datasets.filter((d) => d.is_derived).length;
    const linked = datasets.filter((d) => (datasetUsageCounts.get(d.id) || 0) > 0).length;
    const singleUse = datasets.filter((d) => datasetUsageCounts.get(d.id) === 1).length;
    const shared = datasets.filter((d) => (datasetUsageCounts.get(d.id) || 0) > 1).length;

    return {
      total: datasets.length,
      baseline,
      derived,
      linked,
      singleUse,
      shared,
      unlinked: datasets.length - linked,
      readinessPct: datasets.length > 0 ? (linked / datasets.length) * 100 : 0,
    };
  }, [datasets, datasetUsageCounts]);

  const pillarSummary = useMemo(() => {
    const totals = new Map<PillarKey, number>();
    datasets.forEach((dataset) => {
      const key = determinePillar(dataset);
      totals.set(key, (totals.get(key) || 0) + 1);
    });
    const totalDatasets = datasets.length || 1;

    return PILLAR_ORDER.map((pillar) => {
      const value = totals.get(pillar.key) || 0;
      return {
        ...pillar,
        value,
        percent: (value / totalDatasets) * 100,
      };
    });
  }, [datasets]);

  const sscPillars = useMemo(
    () => pillarSummary.filter((pillar) => pillar.key === 'SSC Framework - P1' || pillar.key === 'SSC Framework - P2' || pillar.key === 'SSC Framework - P3'),
    [pillarSummary],
  );
  const supportingPillars = useMemo(
    () =>
      pillarSummary.filter(
        (pillar) => pillar.key === 'Hazard' || pillar.key === 'Underlying Vulnerability' || pillar.key === 'Other',
      ),
    [pillarSummary],
  );

  const datasetById = useMemo(() => {
    const map = new Map<string, Dataset>();
    datasets.forEach((d) => map.set(d.id, d));
    return map;
  }, [datasets]);

  const instanceCards = useMemo(() => {
    return instances.map((instance) => {
      const linkedDatasets = instanceDatasets
        .filter((row) => row.instance_id === instance.id)
        .map((row) => datasetById.get(row.dataset_id))
        .filter(Boolean) as Dataset[];

      const pillarBreakdown = linkedDatasets.reduce<Record<PillarKey, number>>((acc, dataset) => {
        const pillar = determinePillar(dataset);
        acc[pillar] = (acc[pillar] || 0) + 1;
        return acc;
      }, {} as Record<PillarKey, number>);

      return {
        ...instance,
        datasetCount: instanceDatasetCounts.get(instance.id) || 0,
        primaryHazard: instance.metadata?.hazard_focus || instance.metadata?.primary_hazard || '—',
        pillarBreakdown,
      };
    });
  }, [instances, instanceDatasets, datasetById, instanceDatasetCounts]);

  const populationDatasets = useMemo(() => {
    return datasets.filter((dataset) => {
      const text = `${dataset.name ?? ''} ${dataset.description ?? ''} ${JSON.stringify(dataset.metadata ?? {})}`.toLowerCase();
      return text.includes('population');
    });
  }, [datasets]);

  const primaryPopulation = useMemo(() => {
    return (
      populationDatasets.find((dataset) => {
        const meta = dataset.metadata || {};
        return Boolean(meta.is_active_baseline ?? meta.active_baseline ?? meta.is_primary);
      }) || populationDatasets[0]
    );
  }, [populationDatasets]);

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
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={16} />
                All Countries
              </Link>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                {currentCountry.iso_code}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-amber-600 font-semibold">
                  SLSC Needs Severity Toolset
                </p>
                <h1 className="text-3xl font-semibold text-gray-900 mt-1">Country Dashboard</h1>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
              Track how national baseline layers, SSC framework pillars, and live response instances connect.
              This space will evolve into the template for any country-wide deployment.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/datasets"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <Database size={16} />
              Manage Datasets
            </Link>
            <Link
              href="/instances"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-sm font-semibold text-white shadow hover:bg-amber-600 transition"
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
            <button
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold underline"
              onClick={loadDashboard}
            >
              <RefreshCcw size={12} />
              Retry
            </button>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total datasets"
            value={loading ? '—' : datasetStats.total}
            sublabel={`${datasetStats.baseline} baseline • ${datasetStats.derived} derived`}
            icon={Database}
            accent="bg-amber-100 text-amber-700"
          />
          <StatCard
            label="Datasets linked to instances"
            value={loading ? '—' : datasetStats.linked}
            sublabel={`${datasetStats.singleUse} single-use • ${datasetStats.shared} shared`}
            icon={Layers}
            accent="bg-blue-100 text-blue-700"
          />
          <StatCard
            label="Active instances"
            value={loading ? '—' : (instances.length || 0)}
            sublabel={loading ? 'Loading...' : `${datasetStats.unlinked} datasets awaiting assignment`}
            icon={Activity}
            accent="bg-green-100 text-green-700"
          />
          <StatCard
            label="Readiness"
            value={
              loading
                ? '—'
                : (datasetStats.total > 0 ? `${Math.round(datasetStats.readinessPct)}%` : '0%')
            }
            sublabel="Baseline layers connected to response analyses"
            icon={MapPinned}
            accent="bg-purple-100 text-purple-700"
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <ReferenceCard
            title="Admin boundaries"
            subtitle="Reference layers"
            stat={`${numberFormatter.format(boundaryCounts.ADM3)} ADM3 • ${numberFormatter.format(boundaryCounts.ADM4)} ADM4`}
            detail={`ADM1 ${numberFormatter.format(boundaryCounts.ADM1)} • ADM2 ${numberFormatter.format(boundaryCounts.ADM2)}`}
            icon={MapPinned}
            href="/datasets?focus=admin_boundaries"
            linkLabel="View guidance"
          />
          <ReferenceCard
            title="Population baselines"
            subtitle="Reference layers"
            stat={`${populationDatasets.length} dataset${populationDatasets.length === 1 ? '' : 's'}`}
            detail={
              primaryPopulation
                ? `Primary: ${primaryPopulation.name}`
                : 'No active population baseline is flagged yet.'
            }
            icon={Database}
            href={
              primaryPopulation ? `/datasets/raw/${primaryPopulation.id}` : '/datasets?focus=population'
            }
            linkLabel={primaryPopulation ? 'Open active dataset' : 'Review candidates'}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                  SSC Framework coverage
                </p>
                <h2 className="text-lg font-semibold text-gray-900">The Shelter · The Living Conditions · The Settlement</h2>
                <p className="text-sm text-gray-600">
                  Keep the shelter-centric pillars balanced—the place where shelter-specific datasets should live. Hazard and underlying vulnerability layers support but do not replace SSC framing.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {sscPillars.map((pillar) => {
                const pillarMeta = PILLAR_ORDER.find((item) => item.key === pillar.key);
                const pillarHref = pillarMeta ? `/datasets?pillar=${encodeURIComponent(PILLAR_FILTER_PARAM[pillarMeta.key as PillarKey])}` : undefined;
                return (
                  <PillarCard
                    key={pillar.key}
                    label={pillarMeta?.label || pillar.label}
                    description={pillarMeta?.description || pillar.description}
                    value={pillar.value}
                    percent={pillar.percent}
                    href={pillarHref}
                  />
                );
              })}
            </div>
          </div>
          <DashboardMap
            featureCollection={adminBoundaryGeo}
            headline="National footprint"
            description="ADM1 boundaries shown as the base canvas for layering SSC instances."
          />
        </section>
        {supportingPillars.length > 0 && (
          <section className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Supporting analyses
              </p>
              <h2 className="text-lg font-semibold text-gray-900">Hazards & underlying vulnerabilities</h2>
              <p className="text-sm text-gray-600">
                These layers complement SSC results: hazard footprints for current events and chronic vulnerability datasets that sit outside the shelter pillars.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {supportingPillars.map((pillar) => {
                const pillarMeta = PILLAR_ORDER.find((item) => item.key === pillar.key);
                const pillarHref = pillarMeta ? `/datasets?pillar=${encodeURIComponent(PILLAR_FILTER_PARAM[pillarMeta.key as PillarKey])}` : undefined;
                return (
                  <PillarCard
                    key={pillar.key}
                    label={pillarMeta?.label || pillar.label}
                    description={pillarMeta?.description || pillar.description}
                    value={pillar.value}
                    percent={pillar.percent}
                    href={pillarHref}
                  />
                );
              })}
            </div>
          </section>
        )}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Instances & responses
              </p>
              <h2 className="text-lg font-semibold text-gray-900">Active analyses layered on the baseline</h2>
              <p className="text-sm text-gray-600 max-w-2xl">
                Each instance contextualizes the national baseline for a specific crisis or scenario. Keep them aligned so lessons can be reused in other countries.
              </p>
            </div>
            <Link
              href="/instances"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <Layers size={16} />
              Open instances workspace
            </Link>
          </div>
          {instanceCards.length === 0 ? (
            <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl p-5 text-center">
              No instances yet. Create one from the Instances workspace to start layering on the baseline.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {instanceCards.map((instance) => (
                <div
                  key={instance.id}
                  className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{instance.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Admin focus: {instance.admin_level || '—'} • Updated {formatDate(instance.updated_at || instance.created_at)}
                      </p>
                    </div>
                    <Link
                      href={`/instances/${instance.id}`}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                    >
                      View
                    </Link>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Datasets linked</dt>
                      <dd className="font-semibold text-gray-900">{instance.datasetCount}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Primary hazard</dt>
                      <dd className="font-semibold text-gray-900">{instance.primaryHazard}</dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                      Pillar emphasis
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PILLAR_ORDER.filter((pillar) => (instance.pillarBreakdown[pillar.key] || 0) > 0).map((pillar) => (
                        <span
                          key={pillar.key}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold"
                        >
                          {pillar.label}
                          <span className="text-[10px] text-amber-600">
                            ({instance.pillarBreakdown[pillar.key]})
                          </span>
                        </span>
                      ))}
                      {Object.keys(instance.pillarBreakdown).length === 0 && (
                        <span className="text-xs text-gray-500">Awaiting dataset linkage</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 border border-gray-200 rounded-2xl shadow-sm bg-white">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                  Dataset catalog
                </p>
                <h2 className="text-lg font-semibold text-gray-900">Most recent or high-priority datasets</h2>
                <p className="text-sm text-gray-600">
                  Review alignment before promoting datasets into other country contexts.
                </p>
              </div>
              <Link href="/datasets" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
                Go to catalog
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {(datasets.slice(0, 6) || []).map((dataset) => (
                <div key={dataset.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{dataset.name}</p>
                    <p className="text-xs text-gray-500">
                      {dataset.source || 'Unknown source'} • Last updated {formatDate(dataset.updated_at || dataset.created_at)}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-gray-100 text-gray-700">
                        {dataset.type || '—'}
                      </span>
                      {dataset.admin_level && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-indigo-50 text-indigo-700">
                          {dataset.admin_level}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-700">
                        {PILLAR_ORDER.find((p) => p.key === determinePillar(dataset))?.label || 'Uncategorized'}
                      </span>
                      {dataset.is_baseline && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-green-50 text-green-700">
                          Baseline
                        </span>
                      )}
                      {dataset.is_derived && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700">
                          Derived
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/datasets/raw/${dataset.id}`}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                  >
                    Open
                  </Link>
                </div>
              ))}
              {datasets.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-gray-500">
                  No datasets yet. Use "Manage Datasets" to start building the baseline.
                </div>
              )}
            </div>
          </div>
          <div className="border border-gray-200 rounded-2xl shadow-sm bg-white p-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Cleaning & alignment</p>
            <h2 className="text-lg font-semibold text-gray-900">Keep data aligned with admin boundaries</h2>
            <p className="text-sm text-gray-600">
              Cleaning workflows ensure names, parent-child relationships, PCodes, and geometry remain aligned with
              <code className="mx-1 px-1 rounded bg-gray-100 text-[11px]">admin_boundaries</code> — crucial before scaling to other countries.
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>&bull; Spot mismatched PCodes before scoring.</li>
              <li>&bull; Compare cleaned geometry area (sqkm) with the source of truth.</li>
              <li>&bull; Flag datasets that only exist inside a single instance.</li>
            </ul>
            <Link
              href="/datasets"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
            >
              <Database size={14} />
              Review cleaning queues
            </Link>
          </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}
