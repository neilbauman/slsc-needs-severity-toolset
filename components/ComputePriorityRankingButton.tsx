'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

type Props = {
  instanceId: string;
  onComplete?: () => void;
};

/**
 * Computes relative priority ranking (1-5) from absolute severity scores.
 * Highest severity → priority 5, lowest → priority 1, others distributed proportionally.
 * 
 * Note: This creates a relative ranking for prioritization.
 * Use 'Overall' scores (absolute severity) for PIN calculations.
 */
export default function ComputePriorityRankingButton({ instanceId, onComplete }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ 
    status?: string; 
    upserted_rows?: number; 
    min_severity?: number;
    max_severity?: number;
    message?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error } = await supabase.rpc('score_priority_ranking', {
        in_instance_id: instanceId,
      });

      if (error) throw error;

      if (data && typeof data === 'object') {
        setResult({
          status: data.status || 'done',
          upserted_rows: data.upserted_rows || 0,
          min_severity: data.min_severity,
          max_severity: data.max_severity,
          message: data.message,
        });
      } else {
        setResult({ status: 'done', upserted_rows: 0 });
      }

      onComplete?.();
    } catch (err: any) {
      setError(err?.message ?? 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 border rounded-lg p-4 bg-white shadow-sm w-full max-w-md">
      <h3 className="text-lg font-semibold text-gray-800">Compute Priority Ranking</h3>
      <p className="text-sm text-gray-600 text-center">
        Creates relative prioritization (1-5) from absolute severity scores.
        <br />
        <span className="text-xs text-gray-500">
          Highest severity → Priority 5, Lowest → Priority 1
        </span>
      </p>
      <p className="text-xs text-gray-500 text-center mt-1">
        <strong>Note:</strong> Use 'Overall' scores for PIN calculations (absolute severity).
        Use 'Priority' scores for relative prioritization.
      </p>

      <button
        onClick={handleCompute}
        disabled={loading}
        className={`mt-2 w-full py-2 rounded-md font-semibold text-white transition ${
          loading ? 'bg-gray-400 cursor-wait' : 'bg-purple-600 hover:bg-purple-700'
        }`}
      >
        {loading ? 'Computing…' : 'Compute Priority Ranking'}
      </button>

      {result && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2 w-full text-center mt-2">
          ✅ {result.status?.toUpperCase()} — {result.upserted_rows ?? 0} locations ranked
          {result.min_severity !== undefined && result.max_severity !== undefined && (
            <div className="text-xs mt-1">
              Severity range: {result.min_severity.toFixed(2)} → {result.max_severity.toFixed(2)}
              <br />
              Priority range: 1.0 → 5.0
            </div>
          )}
          {result.message && (
            <div className="text-xs mt-1 italic">{result.message}</div>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2 w-full text-center mt-2">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

