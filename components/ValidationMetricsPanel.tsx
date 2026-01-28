'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface Props {
  responseId: string;
  legacyInstanceId: string | null;
}

type CategoryMetric = {
  category: string;
  n_areas: number;
  avg_new: number;
  avg_legacy: number;
  avg_delta: number;
  mae: number;
  rmse: number;
  min_delta: number;
  max_delta: number;
  std_delta: number;
  correlation: number;
  significant_changes: number;
};

type ValidationResult = {
  response_id: string;
  legacy_instance_id: string;
  computed_at: string;
  overall: {
    total_score_pairs: number;
    avg_delta: number;
    mae: number;
    rmse: number;
    correlation: number;
    significant_changes: number;
    exact_matches: number;
    match_rate: number;
  };
  by_category: CategoryMetric[];
  error?: string;
};

export default function ValidationMetricsPanel({ responseId, legacyInstanceId }: Props) {
  const supabase = createClient();
  
  const [metrics, setMetrics] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (legacyInstanceId) {
      loadMetrics();
    }
  }, [responseId, legacyInstanceId]);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('compute_validation_metrics', {
        in_response_id: responseId
      });

      if (rpcError) throw rpcError;
      
      if (data?.error) {
        setError(data.error);
        return;
      }

      setMetrics(data as ValidationResult);
    } catch (err: any) {
      console.error('Error loading validation metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!legacyInstanceId) {
    return (
      <div className="bg-gray-50 border rounded-lg p-4 text-center text-gray-500">
        <p>No legacy instance linked for comparison</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-50 border rounded-lg p-4 text-center">
        <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
        <p className="text-gray-500">Computing validation metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
        <button onClick={loadMetrics} className="btn btn-secondary mt-2 text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-gray-50 border rounded-lg p-4 text-center">
        <button onClick={loadMetrics} className="btn btn-primary">
          Compute Validation Metrics
        </button>
      </div>
    );
  }

  const getCorrelationColor = (corr: number) => {
    if (corr >= 0.95) return 'text-green-600';
    if (corr >= 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCorrelationLabel = (corr: number) => {
    if (corr >= 0.99) return 'Excellent';
    if (corr >= 0.95) return 'Very Good';
    if (corr >= 0.9) return 'Good';
    if (corr >= 0.8) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="space-y-4">
      {/* Overall Summary */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 size={18} />
            Validation Summary
          </h3>
          <button 
            onClick={loadMetrics}
            className="text-gray-400 hover:text-gray-600"
            title="Refresh metrics"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Correlation */}
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className={`text-2xl font-bold ${getCorrelationColor(metrics.overall.correlation)}`}>
              {(metrics.overall.correlation * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Correlation</div>
            <div className={`text-xs ${getCorrelationColor(metrics.overall.correlation)}`}>
              {getCorrelationLabel(metrics.overall.correlation)}
            </div>
          </div>

          {/* MAE */}
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {metrics.overall.mae.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Mean Abs. Error</div>
            <div className="text-xs text-gray-400">
              on 1-5 scale
            </div>
          </div>

          {/* Match Rate */}
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {metrics.overall.match_rate?.toFixed(0) || 0}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Exact Matches</div>
            <div className="text-xs text-gray-400">
              {metrics.overall.exact_matches} of {metrics.overall.total_score_pairs}
            </div>
          </div>

          {/* Significant Changes */}
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className={`text-2xl font-bold ${metrics.overall.significant_changes > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {metrics.overall.significant_changes}
            </div>
            <div className="text-xs text-gray-500 mt-1">Score Changes &gt;0.5</div>
            <div className="text-xs text-gray-400">
              {((metrics.overall.significant_changes / metrics.overall.total_score_pairs) * 100).toFixed(1)}% of scores
            </div>
          </div>
        </div>

        {/* Interpretation */}
        <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
          metrics.overall.correlation >= 0.99 
            ? 'bg-green-50 text-green-800' 
            : metrics.overall.correlation >= 0.9
            ? 'bg-yellow-50 text-yellow-800'
            : 'bg-red-50 text-red-800'
        }`}>
          {metrics.overall.correlation >= 0.99 ? (
            <>
              <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Excellent Agreement:</span> The new layered scoring 
                produces nearly identical results to the legacy system. Safe to use for production.
              </div>
            </>
          ) : metrics.overall.correlation >= 0.9 ? (
            <>
              <TrendingUp size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Good Agreement:</span> Scores are highly correlated 
                but show some differences. Review the category breakdown below for details.
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Significant Differences:</span> The new scoring shows 
                meaningful divergence from legacy. This may be due to layer adjustments or methodology changes.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      {metrics.by_category && metrics.by_category.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-semibold">Metrics by Category</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2 text-right">Areas</th>
                  <th className="px-4 py-2 text-right">Correlation</th>
                  <th className="px-4 py-2 text-right">MAE</th>
                  <th className="px-4 py-2 text-right">Avg Δ</th>
                  <th className="px-4 py-2 text-right">Min Δ</th>
                  <th className="px-4 py-2 text-right">Max Δ</th>
                  <th className="px-4 py-2 text-right">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {metrics.by_category.map((cat) => (
                  <tr key={cat.category} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{cat.category}</td>
                    <td className="px-4 py-2 text-right">{cat.n_areas}</td>
                    <td className={`px-4 py-2 text-right font-medium ${getCorrelationColor(cat.correlation)}`}>
                      {(cat.correlation * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right">{cat.mae.toFixed(3)}</td>
                    <td className={`px-4 py-2 text-right ${
                      cat.avg_delta > 0.01 ? 'text-red-600' : 
                      cat.avg_delta < -0.01 ? 'text-blue-600' : ''
                    }`}>
                      {cat.avg_delta >= 0 ? '+' : ''}{cat.avg_delta.toFixed(3)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">{cat.min_delta.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{cat.max_delta.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right ${cat.significant_changes > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                      {cat.significant_changes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Technical Details */}
      <details className="bg-gray-50 border rounded-lg">
        <summary className="px-4 py-2 cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          Technical Details
        </summary>
        <div className="px-4 py-3 border-t text-xs space-y-1 text-gray-600">
          <p><strong>Response ID:</strong> {metrics.response_id}</p>
          <p><strong>Legacy Instance ID:</strong> {metrics.legacy_instance_id}</p>
          <p><strong>Computed:</strong> {new Date(metrics.computed_at).toLocaleString()}</p>
          <p><strong>Total Score Pairs:</strong> {metrics.overall.total_score_pairs}</p>
          <p><strong>RMSE:</strong> {metrics.overall.rmse.toFixed(4)}</p>
          <p><strong>Average Delta:</strong> {metrics.overall.avg_delta.toFixed(4)}</p>
        </div>
      </details>
    </div>
  );
}
