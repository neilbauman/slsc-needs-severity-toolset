'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import BaselineConfigPanel from '@/components/BaselineConfigPanel';
import ImportFromInstanceModal from '@/components/ImportFromInstanceModal';

const BaselineMap = dynamic(() => import('@/components/BaselineMap'), { ssr: false });

type Baseline = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  computed_at: string | null;
  created_at: string | null;
  slug: string | null;
  country_id: string | null;
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

  useEffect(() => {
    loadBaseline();
  }, [baselineId, retryCount]);

  const loadScoreSummary = async (baselineUuid: string) => {
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
  };

  const loadBaseline = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // Support both UUID and slug in URL
      // Check if it's a UUID (contains hyphens and is 36 chars) or a slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baselineId);
      
      let query = supabase
        .from('country_baselines')
        .select('id, name, description, status, computed_at, created_at, slug, country_id');
      
      if (isUUID) {
        query = query.eq('id', baselineId);
      } else {
        query = query.eq('slug', baselineId);
      }
      
      const { data, error: fetchError } = await query.maybeSingle();

      if (fetchError) {
        console.error('[BaselinePage] Error fetching baseline:', fetchError);
        throw new Error(`Failed to load baseline: ${fetchError.message}`);
      }
      
      if (!data) {
        // maybeSingle() returns null if not found, which is not an error
        throw new Error(`Baseline not found. The slug or ID "${baselineId}" does not exist in the database. Please verify the baseline exists and the slug is correct.`);
      }
      
      // If accessed via UUID but has a slug, redirect to slug URL
      if (isUUID && data.slug && typeof window !== 'undefined') {
        const newUrl = `/baselines/${data.slug}`;
        if (window.location.pathname !== newUrl) {
          window.history.replaceState({}, '', newUrl);
        }
      }
      
      setBaseline(data);
      if (data?.id) {
        await loadScoreSummary(data.id);
      }
    } catch (err: any) {
      console.error('[BaselinePage] Error loading baseline:', err);
      const errorMessage = err?.message || 'Failed to load baseline';
      setError(errorMessage);
      
      // Auto-retry once for transient errors
      if (retryCount === 0 && (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('fetch') || errorMessage.includes('timeout'))) {
        setTimeout(() => setRetryCount(1), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

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
        <div className="w-full md:w-[480px] md:h-[480px] flex-shrink-0 h-[320px] md:h-[480px]">
          <BaselineMap
              baselineId={baseline.id}
              countryId={baseline.country_id}
              adminLevel="ADM3"
              computedAt={baseline.computed_at}
              selectedLayer={selectedMapLayer}
            />
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
            {['P1', 'P2', 'P3', 'Hazard', 'Underlying Vulnerability'].map((group) => {
              const categoriesInGroup = scoreSummary.filter((r) => {
                const c = (r.category || '').trim().toLowerCase();
                if (group === 'P1') {
                  return c.startsWith('p1') && !c.startsWith('p3') && !c.startsWith('p2');
                }
                if (group === 'P2') {
                  return c.startsWith('p2') && !c.startsWith('p3') && !c.startsWith('p1');
                }
                if (group === 'P3') {
                  // P3 only: exclude P3.1.x (UV) and P3.2.x (Hazard)
                  return c.startsWith('p3') && !c.startsWith('p3.1') && !c.startsWith('p3.2') 
                    && !c.includes('hazard') && !c.includes('underlying') && !c.includes('vuln');
                }
                if (group === 'Hazard') {
                  // P3.2.x or contains "hazard", but exclude UV categories
                  return (c.startsWith('p3.2') || c.includes('hazard')) 
                    && !c.startsWith('p3.1') 
                    && !c.includes('underlying') 
                    && !(c.includes('vuln') && !c.includes('hazard'));
                }
                if (group === 'Underlying Vulnerability') {
                  // P3.1.x, UV prefix, or contains "underlying"/"vuln", but exclude Hazard categories
                  return (c.startsWith('p3.1') || c.startsWith('uv') || c.includes('underlying') || (c.includes('vuln') && !c.includes('hazard')))
                    && !c.startsWith('p3.2');
                }
                return false;
              });
              return (
                <div key={group} className="mb-2">
                  <button
                    onClick={() => setSelectedMapLayer(group)}
                    className={`w-full text-left px-3 py-2 rounded text-sm font-medium mb-1 ${selectedMapLayer === group ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-gray-100 border border-transparent'}`}
                  >
                    {group}
                  </button>
                  {categoriesInGroup.length > 0 && (
                    <div className="pl-3 space-y-0.5">
                      {categoriesInGroup.map((r) => (
                        <button
                          key={r.category}
                          onClick={() => setSelectedMapLayer(r.category)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs truncate ${selectedMapLayer === r.category ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'hover:bg-gray-50 border border-transparent'}`}
                          title={r.category}
                        >
                          {r.category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {scoreSummary.filter((r) => {
              const c = (r.category || '').trim().toLowerCase();
              const inGroup = c.startsWith('p1') || c.startsWith('p2') || c.startsWith('p3') || c.includes('hazard') || c.includes('underlying') || c.includes('vuln');
              return !inGroup;
            }).length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 px-2 mb-1">Other categories</p>
                {scoreSummary.filter((r) => {
                  const c = (r.category || '').trim().toLowerCase();
                  return !c.startsWith('p1') && !c.startsWith('p2') && !c.startsWith('p3') && !c.includes('hazard') && !c.includes('underlying') && !c.includes('vuln');
                }).map((r) => (
                  <button
                    key={r.category}
                    onClick={() => setSelectedMapLayer(r.category)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs truncate mb-0.5 ${selectedMapLayer === r.category ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'hover:bg-gray-50 border border-transparent'}`}
                    title={r.category}
                  >
                    {r.category}
                  </button>
                ))}
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
            <div className="overflow-x-auto max-h-32 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-1 pr-2">Category</th>
                    <th className="py-1 pr-2">Avg</th>
                    <th className="py-1 pr-2">#</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreSummary.map((r) => (
                    <tr key={r.category} className="border-b last:border-b-0">
                      <td className="py-1 pr-2 font-medium text-gray-900 truncate max-w-[120px]" title={r.category}>{r.category}</td>
                      <td className="py-1 pr-2">{Number.isFinite(r.avg_score) ? r.avg_score.toFixed(2) : '—'}</td>
                      <td className="py-1 pr-2">{r.admin_count}</td>
                    </tr>
                  ))}
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
