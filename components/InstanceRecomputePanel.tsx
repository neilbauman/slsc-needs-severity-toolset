'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function InstanceRecomputePanel({ instanceId }:{ instanceId:string }){
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  const run = async (fn: 'framework'|'final'|'priority') => {
    setBusy(true); setMsg(null);
    try{
      // call Postgres functions via RPC (assuming you created http callables or use SQL over pg net)
      // Here we hit a simple REST endpoint you can wire later, for now we trigger SQL via Supabase SQL RPC
      const fnName = fn === 'framework' ? 'score_framework_aggregate' 
                    : fn === 'final' ? 'score_final_aggregate'
                    : 'score_priority_ranking';
      const { data, error } = await supabase.rpc(fnName, { in_instance_id: instanceId });
      if (error) throw error;
      const fnLabel = fn === 'framework' ? 'Framework' : fn === 'final' ? 'Final' : 'Priority Ranking';
      setMsg(`${fnLabel} recompute OK`);
    }catch(e:any){
      console.error(e);
      setMsg(e.message || 'Error');
    }finally{
      setBusy(false);
    }
  };

  return (
    <div className="card p-3 no-print">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Recompute</div>
          <div className="text-xs text-gray-500">Run DB-side rollups after tuning.</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" disabled={busy} onClick={()=>run('framework')}>Recompute Framework</button>
          <button className="btn btn-primary" disabled={busy} onClick={()=>run('final')}>Recompute Final</button>
          <button className="btn" style={{ backgroundColor: 'var(--gsc-purple, #9333ea)', color: '#fff' }} disabled={busy} onClick={()=>run('priority')}>Compute Priority</button>
        </div>
      </div>
      {msg && <div className="text-xs mt-2">{msg}</div>}
    </div>
  );
}
