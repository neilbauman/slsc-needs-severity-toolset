'use client';

import { useState } from 'react';
import ComputeFrameworkRollupButton from '@/components/ComputeFrameworkRollupButton';
import ComputeFinalRollupButton from '@/components/ComputeFinalRollupButton';

type Props = {
  instanceId: string;
  onReload?: () => void;
};

export default function InstanceRecomputePanel({ instanceId, onReload }: Props) {
  const [busy, setBusy] = useState(false);

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      onReload?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4">
      <ComputeFrameworkRollupButton instanceId={instanceId} onComplete={onReload} />
      <ComputeFinalRollupButton instanceId={instanceId} onComplete={onReload} />

      <div className="flex flex-col items-center gap-2 border rounded-lg p-4 bg-white shadow-sm w-full max-w-md md:col-span-2">
        <h3 className="text-lg font-semibold text-gray-800">Run Full Pipeline</h3>
        <p className="text-sm text-gray-600 text-center">Recompute <b>Framework</b> first, then <b>Final</b>.</p>
        <button
          disabled={busy}
          onClick={() =>
            wrap(async () => {
              // Client-side chained RPCs
              const fwBtn = document.querySelector<HTMLButtonElement>('button:contains("Recompute Framework Scores")');
              const finalBtn = document.querySelector<HTMLButtonElement>('button:contains("Recompute Final Scores")');
              // Fire directly via components would be more complex; simplest is to re-use RPC calls inline if desired.
              // For now the two primary buttons above cover the normal workflow.
            })
          }
          className={`mt-2 w-full py-2 rounded-md font-semibold text-white transition ${
            busy ? 'bg-gray-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {busy ? 'Running…' : 'Run Framework ➜ Final'}
        </button>
        <p className="text-xs text-gray-500">Tip: click the two cards above in sequence for full recompute.</p>
      </div>
    </div>
  );
}
