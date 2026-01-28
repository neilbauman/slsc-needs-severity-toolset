'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import BaselineConfigPanel from '@/components/BaselineConfigPanel';
import ImportFromInstanceModal from '@/components/ImportFromInstanceModal';

type Baseline = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  computed_at: string | null;
  created_at: string | null;
  slug: string | null;
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
        .select('id, name, description, status, computed_at, created_at, slug');
      
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
    <div className="p-4 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--gsc-green)' }}>
              {baseline.name}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded ${
              baseline.status === 'active' ? 'bg-green-100 text-green-800' :
              baseline.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-600'
            }`}>
              {baseline.status || 'draft'}
            </span>
          </div>
          {baseline.description && (
            <p className="text-sm text-gray-500 mt-1">{baseline.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/responses" className="btn btn-secondary">
            Back
          </Link>
        </div>
      </header>

      {/* Status and Compute Section */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold mb-1">Baseline Status</h3>
            <p className="text-sm text-gray-500">
              {baseline.computed_at 
                ? `Last computed: ${new Date(baseline.computed_at).toLocaleString()}`
                : 'Not yet computed'}
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={baseline.status || 'draft'}
              onChange={(e) => updateStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={computeBaseline}
              disabled={computing}
              className="btn btn-primary"
            >
              {computing ? 'Computing...' : 'Compute Baseline Scores'}
            </button>
          </div>
        </div>
      </div>

      {/* Baseline Scores Summary */}
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold mb-1">Baseline Scores</h3>
            <p className="text-sm text-gray-500">
              {baseline.computed_at ? 'Category-level averages from computed baseline scores.' : 'Compute baseline scores to see results.'}
            </p>
          </div>
          <button
            onClick={() => baseline?.id && loadScoreSummary(baseline.id)}
            disabled={loadingScoreSummary}
            className="btn btn-secondary text-sm"
          >
            {loadingScoreSummary ? 'Refreshing...' : 'Refresh scores'}
          </button>
        </div>

        {!baseline.computed_at ? (
          <div className="mt-3 text-sm text-gray-500">
            No computed scores yet.
          </div>
        ) : scoreSummary.length === 0 ? (
          <div className="mt-3 text-sm text-gray-500">
            No scores found. If you just computed, click “Refresh scores”.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Avg score</th>
                  <th className="py-2 pr-4">ADM3 count</th>
                  <th className="py-2 pr-4">Rows</th>
                </tr>
              </thead>
              <tbody>
                {scoreSummary.map((r) => (
                  <tr key={r.category} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium text-gray-900">{r.category}</td>
                    <td className="py-2 pr-4">{Number.isFinite(r.avg_score) ? r.avg_score.toFixed(2) : '—'}</td>
                    <td className="py-2 pr-4">{r.admin_count}</td>
                    <td className="py-2 pr-4">{r.row_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Baseline Configuration */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Baseline Dataset Configuration</h3>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary text-sm"
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
          <div className="p-4 text-sm text-gray-500">Loading baseline configuration...</div>
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
