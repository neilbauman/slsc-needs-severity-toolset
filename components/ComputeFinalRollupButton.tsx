'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/supabaseClient';

type Props = {
  instanceId: string;
  onComplete?: () => void;
};

export default function ComputeFinalRollupButton({ instanceId, onComplete }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; upserted_rows: number; final_avg: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error } = await supabase.rpc('score_final_aggregate', {
        in_instance_id: instanceId,
      });

      if (error) throw error;

      if (Array.isArray(data) && data.length > 0) {
        setResult(data[0]);
      } else {
        setResult({ status: 'done', upserted_rows: 0, final_avg: 0 });
      }

      if (onComplete) onComplete();
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 border rounded-lg p-4 bg-white shadow-sm w-full max-w-md">
      <h3 className="text-lg font-semibold text-gray-800">Compute Final Roll-up</h3>
      <p className="text-sm text-gray-600 text-center">
        This recalculates the weighted final vulnerability scores (Framework × Hazard × Underlying) for the selected
        instance.
      </p>

      <button
        onClick={handleCompute}
        disabled={loading}
        className={`mt-2 w-full py-2 rounded-md font-semibold text-white transition ${
          loading ? 'bg-gray-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? 'Computing…' : 'Recompute Final Scores'}
      </button>

      {result && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2 w-full text-center mt-2">
          ✅ {result.status.toUpperCase()} — {result.upserted_rows} rows • Avg Score {result.final_avg?.toFixed(3)}
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
