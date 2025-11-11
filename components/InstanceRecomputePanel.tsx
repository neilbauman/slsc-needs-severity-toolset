'use client';

import { useState } from 'react';
import ComputeFrameworkRollupButton from '@/components/ComputeFrameworkRollupButton';
import ComputeFinalRollupButton from '@/components/ComputeFinalRollupButton';

type Props = {
  instanceId: string;
  onReload?: () => void; // e.g., refresh map/tables after any recompute
};

export default function InstanceRecomputePanel({ instanceId, onReload }: Props) {
  const [busy, setBusy] = useState(false);

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      if (onReload) onReload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4">
      <ComputeFrameworkRollupButton
        instanceId={instanceId}
        onComplete={() => {
          /* framework done */
        }}
      />

      <ComputeFinalRollupButton
        instanceId={instanceId}
        onComplete={() => {
          /* final done */
        }}
      />

      {/* Optional single-click pipeline: Framework ➜ Final */}
      <div className="flex flex-col items-center gap-2 border rounded-lg p-4 bg-white shadow-sm w-full max-w-md md:col-span-2">
        <h3 className="text-lg font-semibold text-gray-800">Run Full Pipeline</h3>
        <p className="text-sm text-gray-600 text-center">
          Recompute <b>Framework</b> first, then recompute <b>Final</b>.
        </p>
        <button
          disabled={busy}
          onClick={() =>
            wrap(async () => {
              // Framework first
              const res1 = await fetch('/api/rpc/score-framework', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId }),
              }).catch(() => null);
              // Fallback if you prefer direct client-side RPC:
              // await supabase.rpc('score_framework_aggregate', { in_instance_id: instanceId });

              // Then Final
              const res2 = await fetch('/api/rpc/score-final', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId }),
              }).catch(() => null);
              // Fallback if you prefer direct client-side RPC:
              // await supabase.rpc('score_final_aggregate', { in_instance_id: instanceId });
            })
          }
          className={`mt-2 w-full py-2 rounded-md font-semibold text-white transition ${
            busy ? 'bg-gray-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {busy ? 'Running…' : 'Run Framework ➜ Final'}
        </button>
        <p className="text-xs text-gray-500">Tip: You can wire /api/rpc/* endpoints or call Supabase RPC directly.</p>
      </div>
    </div>
  );
}
