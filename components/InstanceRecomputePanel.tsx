'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import InstanceDatasetConfigModal from '@/components/InstanceDatasetConfigModal';
import InstanceScoringModal from '@/components/InstanceScoringModal';

type Instance = { id: string; name: string };

export default function InstanceRecomputePanel({ instance }: { instance: Instance }) {
  const supabase = createClient();

  const [busyFw, setBusyFw] = useState(false);
  const [busyFinal, setBusyFinal] = useState(false);
  const [errorFw, setErrorFw] = useState<string | null>(null);
  const [errorFinal, setErrorFinal] = useState<string | null>(null);

  const [showDatasets, setShowDatasets] = useState(false);
  const [showFramework, setShowFramework] = useState(false);

  const header = useMemo(
    () => (
      <div className="mb-3 flex items-center justify-between">
        <div className="text-base font-medium">
          {instance.name}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs hover:bg-gray-50"
            onClick={() => setShowDatasets(true)}
          >
            Configure datasets
          </button>
          <button
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs hover:bg-gray-50"
            onClick={() => setShowFramework(true)}
          >
            Configure framework scoring
          </button>
        </div>
      </div>
    ),
    [instance.name]
  );

  async function runFramework() {
    setBusyFw(true);
    setErrorFw(null);
    // RPC wrapper: the SQL function already does upserts; just call it.
    const { error } = await supabase.rpc('score_framework_aggregate', {
      in_instance_id: instance.id,
      // config is persisted by the modal; backend function reads from tables,
      // so no JSON is required here.
    } as any);
    if (error) setErrorFw(error.message);
    setBusyFw(false);
  }

  async function runFinal() {
    setBusyFinal(true);
    setErrorFinal(null);
    const { error } = await supabase.rpc('score_final_aggregate', {
      in_instance_id: instance.id,
    } as any);
    if (error) setErrorFinal(error.message);
    setBusyFinal(false);
  }

  async function runPipeline() {
    await runFramework();
    await runFinal();
  }

  return (
    <div className="mt-2">
      {header}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Framework card */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold">Compute Framework Roll-up</div>
          <p className="mt-1 text-xs text-gray-500">
            Aggregates pillar scores into the <span className="font-medium">SSC Framework Roll-up</span>.
          </p>

          <button
            onClick={runFramework}
            disabled={busyFw}
            className="mt-3 w-full rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {busyFw ? 'Recomputing…' : 'Recompute Framework Scores'}
          </button>

          {errorFw && (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              ⚠ {errorFw}
            </div>
          )}
        </div>

        {/* Final card */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold">Compute Final Roll-up</div>
          <p className="mt-1 text-xs text-gray-500">
            Recalculates the weighted <span className="font-medium">final vulnerability scores</span>.
          </p>

          <button
            onClick={runFinal}
            disabled={busyFinal}
            className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busyFinal ? 'Recomputing…' : 'Recompute Final Scores'}
          </button>

          {errorFinal && (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              ⚠ {errorFinal}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline row */}
      <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm font-semibold">Run Full Pipeline</div>
        <p className="mt-1 text-xs text-gray-500">
          Recompute <span className="font-medium">Framework</span> first, then <span className="font-medium">Final</span>.
        </p>

        <button
          onClick={runPipeline}
          disabled={busyFw || busyFinal}
          className="mt-3 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busyFw || busyFinal ? 'Running…' : 'Run Framework ➜ Final'}
        </button>

        <p className="mt-1 text-[11px] text-gray-500">
          Tip: you can also click the two cards above in sequence for a full recompute.
        </p>
      </div>

      {/* Modals */}
      {showDatasets && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowDatasets(false)}
          onSaved={async () => setShowDatasets(false)}
        />
      )}

      {showFramework && (
        <InstanceScoringModal
          instance={instance}
          onClose={() => setShowFramework(false)}
          onSaved={async () => setShowFramework(false)}
        />
      )}
    </div>
  );
}
