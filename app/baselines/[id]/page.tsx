'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import BaselineConfigPanel from '@/components/BaselineConfigPanel';
import ImportFromInstanceModal from '@/components/ImportFromInstanceModal';

const BaselineMap = dynamic(() => import('@/components/BaselineMap'), { ssr: false });

type FrameworkSection = { code: string; name: string; level: string };

type Baseline = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  computed_at: string | null;
  created_at: string | null;
  slug: string | null;
  country_id: string | null;
  config?: {
    target_admin_level?: string | null;
  } | null;
};

export default function BaselineDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const baselineId = params.id;
  
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [scoreSummary, setScoreSummary] = useState<{ category: string; avg_score: number; admin_count: number; row_count: number }[]>([]);
  const [loadingScoreSummary, setLoadingScoreSummary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [configKey, setConfigKey] = useState(0); // Force refresh of config panel
  const [retryCount, setRetryCount] = useState(0);
  const [selectedMapLayer, setSelectedMapLayer] = useState<string>('overall');
  const [mapAdminLevel, setMapAdminLevel] = useState<string>('ADM3');
  const [baselineDatasetMap, setBaselineDatasetMap] = useState<Record<string, { id: string; name: string; type: string; admin_level: string }>>({});
  const [frameworkSections, setFrameworkSections] = useState<FrameworkSection[]>([]);

  const loadFrameworkStructure = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_framework_structure');
      if (error || !data || !Array.isArray(data)) return;
      const sections: FrameworkSection[] = [];
      data.forEach((pillar: any) => {
        const pillarKey = pillar.code || '';
        sections.push({ code: pillarKey, name: pillar.name || pillarKey, level: 'pillar' });
        if (pillar.themes && Array.isArray(pillar.themes)) {
          const sortedThemes = [...pillar.themes].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
          sortedThemes.forEach((theme: any, idx: number) => {
            const themeNum = (theme.order_index ?? idx) + 1;
            const themeCode = `${pillarKey}.${themeNum}`;
            sections.push({ code: themeCode, name: theme.name || themeCode, level: 'theme' });
            if (theme.subthemes && Array.isArray(theme.subthemes)) {
              const sortedSub = [...theme.subthemes].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
              sortedSub.forEach((st: any, si: number) => {
                const stNum = (st.order_index ?? si) + 1;
                sections.push({ code: `${themeCode}.${stNum}`, name: st.name || st.code, level: 'subtheme' });
              });
            }
          });
        }
      });
      setFrameworkSections(sections);
    } catch (e) {
      console.warn('[BaselinePage] Failed to load framework structure:', e);
    }
  }, [supabase]);

  const loadScoreSummary = useCallback(async (baselineUuid: string) => {
    setLoadingScoreSummary(true);
    try {
      const { data, error: summaryError } = await supabase.rpc('get_baseline_score_summary', {
        in_baseline_id: baselineUuid,
      });
      if (summaryError) throw summaryError;
      setScoreSummary(
        (data || []).map((r: any) => ({
          category: r.category,
          avg_score: Number(r.avg_score),
          admin_count: Number(r.admin_count),
          row_count: Number(r.row_count),
        }))
      );
    } catch (err: any) {
      console.warn('[BaselinePage] Could not load baseline score summary:', err?.message || err);
      setScoreSummary([]);
    } finally {
      setLoadingScoreSummary(false);
    }
  }, []);

  const loadBaseline = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baselineId);
      let query = supabase
        .from('country_baselines')
        .select('id, name, description, status, computed_at, created_at, slug, country_id, config');
      if (isUUID) query = query.eq('id', baselineId);
      else query = query.eq('slug', baselineId);
      const { data, error: fetchError } = await query.maybeSingle();
      if (fetchError) throw new Error(`Failed to load baseline: ${fetchError.message}`);
      if (!data) throw new Error(`Baseline not found. The slug or ID "${baselineId}" does not exist in the database.`);
      if (isUUID && data.slug && typeof window !== 'undefined') {
        const newUrl = `/baselines/${data.slug}`;
        if (window.location.pathname !== newUrl) window.history.replaceState({}, '', newUrl);
      }
      setBaseline(data);
      const targetLevel = (data?.config?.target_admin_level || 'ADM3').toUpperCase();
      setMapAdminLevel(targetLevel);
      if (data?.id) await loadScoreSummary(data.id);
    } catch (err: any) {
      console.error('[BaselinePage] Error loading baseline:', err);
      const errorMessage = err?.message || 'Failed to load baseline';
      setError(errorMessage);
      if (retryCount === 0 && /network|timeout|fetch/i.test(errorMessage)) {
        setTimeout(() => setRetryCount(1), 2000);
      }
    } finally {
      setLoading(false);
    }
  }, [baselineId, retryCount, loadScoreSummary]);

  useEffect(() => {
    loadBaseline();
  }, [loadBaseline]);

  useEffect(() => {
    loadFrameworkStructure();
  }, [loadFrameworkStructure]);

  useEffect(() => {
    if (!baseline?.id) return;
    let cancelled = false;
    const loadBaselineDatasets = async () => {
      const { data, error: dsError } = await supabase
        .from('baseline_datasets')
        .select('category, dataset:datasets(id, name, type, admin_level)')
        .eq('baseline_id', baseline.id);

      if (dsError || !data || cancelled) return;

      const map: Record<string, { id: string; name: string; type: string; admin_level: string }> = {};
      data.forEach((row: any) => {
        const category = String(row.category || '').trim();
        const dataset = row.dataset;
        if (!category || !dataset) return;
        map[category] = {
          id: dataset.id,
          name: dataset.name,
          type: dataset.type,
          admin_level: dataset.admin_level,
        };
      });
      if (!cancelled) setBaselineDatasetMap(map);
    };
    loadBaselineDatasets();
    return () => { cancelled = true; };
  }, [baseline?.id, supabase]);

  const computeBaseline = async () => {
    if (!baseline) {
      alert('Baseline not loaded');
      return;
    }
    setComputing(true);
    try {
      // Call the scoring function (to be implemented)
      const { data, error } = await supabase.rpc('score_baseline', {
        in_baseline_id: baseline.id
      });

      if (error) throw error;

      // Update computed_at
      await supabase
        .from('country_baselines')
        .update({ computed_at: new Date().toISOString() })
        .eq('id', baseline.id);

      await loadBaseline();
      await loadScoreSummary(baseline.id);
      alert(`Baseline computed: ${data?.total_scores || 0} scores generated`);
    } catch (err: any) {
      console.error('Error computing baseline:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setComputing(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!baseline) {
      alert('Baseline not loaded');
      return;
    }
    try {
      const { error } = await supabase
        .from('country_baselines')
        .update({ status: newStatus })
        .eq('id', baseline.id);

      if (error) throw error;
      await loadBaseline();
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Map section code to get_baseline_map_scores in_layer param (RPC expects these names for themes)
  const sectionToLayerParam = (code: string): string => {
    if (code === 'P1' || code === 'P2' || code === 'P3') return code;
    if (code === 'P3.1') return 'Underlying Vulnerability';
    if (code === 'P3.2') return 'Hazard';
    return code;
  };

  // Score layers + scores summary: use framework structure from DB (pillars + themes), longest-match for category → section
  const { scoreLayersBySection, uncategorizedCategories } = useMemo(() => {
    const getSectionCodeForCategory = (category: string): string => {
      const raw = (category || '').trim();
      if (!raw) return 'Uncategorized';
      const codePart = raw.split(' - ')[0]?.trim() || raw;
      if (!codePart) return 'Uncategorized';
      const matches = frameworkSections.filter(
        (s) => codePart === s.code || codePart.startsWith(s.code + '.')
      );
      if (matches.length === 0) {
        const prefixMatch = frameworkSections.filter((s) => codePart.startsWith(s.code));
        const best = prefixMatch.sort((a, b) => b.code.length - a.code.length)[0];
        return best ? best.code : 'Uncategorized';
      }
      const best = matches.sort((a, b) => b.code.length - a.code.length)[0];
      return best?.code ?? 'Uncategorized';
    };

    const displaySections = frameworkSections;
    const byCode: Record<string, { section: FrameworkSection; categories: typeof scoreSummary }> = {};
    for (const s of displaySections) {
      byCode[s.code] = { section: s, categories: [] };
    }
    byCode['Uncategorized'] = { section: { code: 'Uncategorized', name: 'Other categories', level: 'theme' }, categories: [] };

    for (const r of scoreSummary) {
      const code = getSectionCodeForCategory(r.category);
      if (byCode[code]) byCode[code].categories.push(r);
      else byCode['Uncategorized'].categories.push(r);
    }
    for (const s of displaySections) {
      const list = byCode[s.code]?.categories ?? [];
      list.sort((a, b) => (a.category || '').localeCompare(b.category || '', undefined, { numeric: true }));
    }
    byCode['Uncategorized'].categories.sort((a, b) => (a.category || '').localeCompare(b.category || '', undefined, { numeric: true }));

    const scoreLayersBySection = displaySections.map((section) => ({
      section: {
        code: section.code,
        label: section.name,
        layerParam: sectionToLayerParam(section.code),
      },
      categoriesInSection: byCode[section.code]?.categories ?? [],
    }));
    const uncategorizedCategories = byCode['Uncategorized']?.categories ?? [];
    return { scoreLayersBySection, uncategorizedCategories };
  }, [scoreSummary, frameworkSections]);

  const selectedDataset = useMemo(() => {
    if (!selectedMapLayer) return null;
    return baselineDatasetMap[selectedMapLayer] || null;
  }, [baselineDatasetMap, selectedMapLayer]);

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[BaselinePage] Render state:', { loading, error, hasBaseline: !!baseline, baselineId });
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
            <span>Loading baseline...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || (!loading && !baseline)) {
    return (
      <div className="p-4">
        <div className="card p-4 border-red-300 bg-red-50">
          <h2 className="font-semibold text-red-800 mb-2">Error Loading Baseline</h2>
          <p className="text-sm text-red-700 mb-4">{error || 'Baseline not found'}</p>
          <p className="text-xs text-gray-600 mb-4">Baseline ID/Slug: {baselineId}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setRetryCount(prev => prev + 1);
                setError(null);
                setLoading(true);
              }}
              className="btn btn-primary"
            >
              Retry
            </button>
            <Link href="/responses" className="btn btn-secondary">
              Back to Responses
            </Link>
            <Link href="/" className="btn btn-secondary">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 max-w-7xl mx-auto">
      {/* Header: compact */}
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold" style={{ color: 'var(--gsc-green)' }}>
              {baseline.name}
            </h1>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              baseline.status === 'active' ? 'bg-green-100 text-green-800' :
              baseline.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-600'
            }`}>
              {baseline.status || 'draft'}
            </span>
          </div>
          {baseline.description && (
            <p className="text-xs text-gray-500 mt-0.5">{baseline.description}</p>
          )}
        </div>
        <Link href="/responses" className="btn btn-secondary text-sm py-1.5 px-3">
          Back
        </Link>
      </header>

      {/* Map (square, left) + Layer list (right) */}
      <section className="flex gap-4 flex-wrap md:flex-nowrap">
        <div className="w-full md:w-[480px] md:h-[480px] flex-shrink-0 h-[320px] md:h-[480px] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-800">Map</h2>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Admin level</span>
              <select
                value={mapAdminLevel}
                onChange={(e) => setMapAdminLevel(e.target.value)}
                className="px-2 py-1 border rounded text-xs bg-white"
              >
                <option value="ADM1">ADM1</option>
                <option value="ADM2">ADM2</option>
                <option value="ADM3">ADM3</option>
                <option value="ADM4">ADM4</option>
              </select>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <BaselineMap
              baselineId={baseline.id}
              countryId={baseline.country_id}
              adminLevel={mapAdminLevel}
              computedAt={baseline.computed_at}
              selectedLayer={selectedMapLayer}
            datasetLayer={selectedDataset}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0 border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-800">Score layers</h2>
            <p className="text-xs text-gray-500 mt-0.5">Click a layer to show it on the map.</p>
          </div>
          <div className="p-2 overflow-y-auto max-h-[480px]">
            <button
              onClick={() => setSelectedMapLayer('overall')}
              className={`w-full text-left px-3 py-2 rounded text-sm font-medium mb-1 ${selectedMapLayer === 'overall' ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-gray-100 border border-transparent'}`}
            >
              Overall (avg all)
            </button>
            {scoreLayersBySection.map(({ section, categoriesInSection }) => (
              <div key={section.code} className="mb-2">
                <button
                  onClick={() => setSelectedMapLayer(section.layerParam || section.code)}
                  className={`w-full text-left px-3 py-2 rounded text-sm font-medium mb-1 ${selectedMapLayer === (section.layerParam || section.code) ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-gray-100 border border-transparent'}`}
                >
                  {section.label}
                </button>
                {categoriesInSection.length > 0 && (
                  <div className="pl-3 space-y-0.5">
                    {categoriesInSection.map((r) => {
                      const datasetName = baselineDatasetMap[r.category]?.name;
                      return (
                        <button
                          key={r.category}
                          onClick={() => setSelectedMapLayer(r.category)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between gap-2 ${selectedMapLayer === r.category ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'hover:bg-gray-50 border border-transparent'}`}
                          title={datasetName ? `${r.category} · ${datasetName}` : r.category}
                        >
                          <div className="min-w-0 flex flex-col">
                            <span className="truncate font-medium text-gray-900">{r.category}</span>
                            {datasetName && (
                              <span className="truncate text-[10px] text-gray-500">{datasetName}</span>
                            )}
                          </div>
                          <span className="shrink-0 text-gray-500 tabular-nums">
                            {Number.isFinite(r.avg_score) ? r.avg_score.toFixed(2) : '—'} <span className="text-gray-400">({r.row_count})</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {uncategorizedCategories.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 px-2 mb-1">Other categories</p>
                {uncategorizedCategories.map((r) => {
                  const datasetName = baselineDatasetMap[r.category]?.name;
                  return (
                    <button
                      key={r.category}
                      onClick={() => setSelectedMapLayer(r.category)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between gap-2 mb-0.5 ${selectedMapLayer === r.category ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'hover:bg-gray-50 border border-transparent'}`}
                      title={datasetName ? `${r.category} · ${datasetName}` : r.category}
                    >
                      <div className="min-w-0 flex flex-col">
                        <span className="truncate font-medium text-gray-900">{r.category}</span>
                        {datasetName && (
                          <span className="truncate text-[10px] text-gray-500">{datasetName}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-gray-500 tabular-nums">
                        {Number.isFinite(r.avg_score) ? r.avg_score.toFixed(2) : '—'} <span className="text-gray-400">({r.row_count})</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Status + Scores: two columns compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <h3 className="text-sm font-semibold mb-1">Status</h3>
          <p className="text-xs text-gray-500 mb-2">
            {baseline.computed_at
              ? `Last computed: ${new Date(baseline.computed_at).toLocaleString()}`
              : 'Not yet computed'}
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              value={baseline.status || 'draft'}
              onChange={(e) => updateStatus(e.target.value)}
              className="px-2 py-1.5 border rounded text-sm"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={computeBaseline}
              disabled={computing}
              className="btn btn-primary text-sm py-1.5 px-3"
            >
              {computing ? 'Computing...' : 'Compute Baseline Scores'}
            </button>
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h3 className="text-sm font-semibold">Scores summary</h3>
            <button
              onClick={() => baseline?.id && loadScoreSummary(baseline.id)}
              disabled={loadingScoreSummary}
              className="btn btn-secondary text-xs py-1 px-2"
            >
              {loadingScoreSummary ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {!baseline.computed_at ? (
            <p className="text-xs text-gray-500">No computed scores yet.</p>
          ) : scoreSummary.length === 0 ? (
            <p className="text-xs text-gray-500">No scores found. Click Refresh after compute.</p>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-1 pr-2">Category</th>
                    <th className="py-1 pr-2 text-right">Avg</th>
                    <th className="py-1 pr-2 text-right">#</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreLayersBySection.flatMap(({ section, categoriesInSection }) =>
                    categoriesInSection.length === 0
                      ? []
                      : [
                          <tr key={`h-${section.code}`}>
                            <td colSpan={3} className="py-1.5 pr-2 font-semibold text-gray-700 bg-gray-50 border-b">
                              {section.label}
                            </td>
                          </tr>,
                          ...categoriesInSection.map((r) => {
                            const dsName = baselineDatasetMap[r.category]?.name;
                            return (
                              <tr key={r.category} className="border-b last:border-b-0">
                                <td className="py-1 pr-2 pl-3 max-w-[200px]" title={dsName ? `${r.category} · ${dsName}` : r.category}>
                                  <span className="font-medium text-gray-900 truncate block">{r.category}</span>
                                  {dsName && <span className="text-[10px] text-gray-500 truncate block">{dsName}</span>}
                                </td>
                                <td className="py-1 pr-2 text-right tabular-nums">{Number.isFinite(r.avg_score) ? r.avg_score.toFixed(2) : '—'}</td>
                                <td className="py-1 pr-2 text-right tabular-nums">{r.row_count}</td>
                              </tr>
                            );
                          }),
                        ]
                  )}
                  {uncategorizedCategories.length > 0 && (
                    <>
                      <tr key="h-uncategorized">
                        <td colSpan={3} className="py-1.5 pr-2 font-semibold text-gray-700 bg-gray-50 border-b">
                          Other categories
                        </td>
                      </tr>
                      {uncategorizedCategories.map((r) => {
                        const dsName = baselineDatasetMap[r.category]?.name;
                        return (
                          <tr key={r.category} className="border-b last:border-b-0">
                            <td className="py-1 pr-2 pl-3 max-w-[200px]" title={dsName ? `${r.category} · ${dsName}` : r.category}>
                              <span className="font-medium text-gray-900 truncate block">{r.category}</span>
                              {dsName && <span className="text-[10px] text-gray-500 truncate block">{dsName}</span>}
                            </td>
                            <td className="py-1 pr-2 text-right tabular-nums">{Number.isFinite(r.avg_score) ? r.avg_score.toFixed(2) : '—'}</td>
                            <td className="py-1 pr-2 text-right tabular-nums">{r.row_count}</td>
                          </tr>
                        );
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Baseline Configuration: compact card */}
      <div className="border border-gray-200 rounded-lg p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Baseline Dataset Configuration</h3>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary text-xs py-1.5 px-2"
          >
            Import from Instance
          </button>
        </div>
        {baseline ? (
          <BaselineConfigPanel
            key={configKey}
            baselineId={baseline.id}
            onUpdate={loadBaseline}
          />
        ) : (
          <div className="p-2 text-sm text-gray-500">Loading...</div>
        )}
      </div>

      {/* Import Modal */}
      <ImportFromInstanceModal
        baselineId={baselineId}
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={() => {
          setConfigKey(k => k + 1); // Force refresh
          loadBaseline();
        }}
      />
    </div>
  );
}
