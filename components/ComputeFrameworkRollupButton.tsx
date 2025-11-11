'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

type Props = {
  instanceId: string;
  onComplete?: () => void;
};

/**
 * Calls your server-side SQL to aggregate pillars (P1..P3) into
 * the "SSC Framework Roll-up" dataset for the given instance.
 * Tries score_framework_aggregate(uuid) first, then falls back to (jsonb, uuid).
 */
export default function ComputeFrameworkRollupButton({ instanceId, onComplete }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status?: string; upserted_rows?: number; framework_avg?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultConfig = {
    methods: { P1: 'weighted_mean', P2: 'weighted_mean', P3: 'weighted_mean' },
    weights: { P1: 1, P2: 1, P3: 1 },
  };

  const handleCompute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Try simple signature first
      let { data, error } = await supabase.rpc('score_framework_aggregate', {
        in_instance_id: instanceId,
      });

      if (error) {
        // Legacy signature fallback: (jsonb, uuid)
        const second = await supabase.rpc('score_framework_aggregate', {
          in_config: defaultConfig,
          in_instance_id: instanceId,
        });
        data = second.data;
        error = second.error;
        if (error) throw error;
      }

      if (Array.isArray(data) && data.length > 0) {
        const row = data[0] as any;
        setResult({
          status: row.status ?? 'done',
          upserted_rows: row.upserted_rows ?? row.updated_rows ?? 0,
          framework_avg: row.framework_avg ?? row.avg_score ?? null,
        });
      } else {
        setResult({ status: 'done', upserted_rows: 0, framework_avg: 0 });
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
      <h3 className="text-lg font-semibold text-gray-800">Compute Framework Roll-up</h3>
      <p className="text-sm text-gray-600 text-center">
        Aggregates P1–P3 pillar scores into the <b>SSC Framework Roll-up</b>.
      </p>

      <button
        onClick={handleCompute}
        disabled={loading}
        className={`mt-2 w-full py-2 rounded-md font-semibold text-white transition ${
          loading ? 'bg-gray-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {loading ? 'Computing…' : 'Recompute Framework Scores'}
      </button>

      {result && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2 w-full text-center mt-2">
          ✅ {result.status?.toUpperCase()} — {result.upserted_rows ?? 0} rows
          {typeof result.framework_avg === 'number' ? ` • Avg ${result.framework_avg.toFixed(3)}` : ''}
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
