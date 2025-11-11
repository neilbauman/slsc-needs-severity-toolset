'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import InstanceRecomputePanel from '@/components/InstanceRecomputePanel';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr:false });
const TileLayer   = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr:false });
const GeoJSON     = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr:false });

type Instance = {
  id:string; name:string; description:string|null; admin_scope:string[]|null;
};
type Row = { pcode:string; score:number; };
type Boundary = { admin_pcode:string; name:string; admin_level:string; geom?:any };

export default function InstanceDashboard(){
  const { id } = useParams<{id:string}>();
  const supabase = createClient();

  const [inst, setInst] = useState<Instance|null>(null);
  const [fw, setFw] = useState<Row[]>([]);
  const [finalRows, setFinalRows] = useState<Row[]>([]);
  const [adm1, setAdm1] = useState<Boundary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data:instData }, { data:fwData }, { data:finalData }, { data:adm1Data }] = await Promise.all([
      supabase.from('instances').select('id,name,description,admin_scope').eq('id', id).single(),
      supabase.from('scored_instance_values').select('pcode,score').eq('instance_id', id).eq('pillar','Framework').limit(999999),
      supabase.from('scored_instance_values').select('pcode,score').eq('instance_id', id).eq('pillar','Final').limit(999999),
      supabase.from('admin_boundaries').select('admin_pcode,name,admin_level,geom').eq('admin_level','adm1')
    ]);
    setInst(instData as any);
    setFw((fwData ?? []) as Row[]);
    setFinalRows((finalData ?? []) as Row[]);
    setAdm1((adm1Data ?? []) as Boundary[]);
    setLoading(false);
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [id]);

  const affectedFC = useMemo(() => {
    const pick = new Set(inst?.admin_scope ?? []);
    const feats = adm1
      .filter(a => pick.has(a.admin_pcode))
      .filter(a => a.geom)
      .map(a => ({ type:'Feature', geometry:a.geom, properties:{ name:a.name, pcode:a.admin_pcode } }));
    return { type:'FeatureCollection', features:feats } as any;
  }, [adm1, inst]);

  // Simple headline metrics (placeholder logic; adjust to your existing SQL rollups if needed)
  const totalAreas = inst?.admin_scope?.length ?? 0;
  const frameworkAvg = fw.length ? (fw.reduce((s,r)=>s+r.score,0)/fw.length) : 0;
  const finalAvg     = finalRows.length ? (finalRows.reduce((s,r)=>s+r.score,0)/finalRows.length) : 0;

  // Top places by Final score (descending)
  const top = useMemo(() => {
    return [...finalRows].sort((a,b)=>b.score-a.score).slice(0,15);
  }, [finalRows]);

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--gsc-blue)'}}>{inst?.name ?? 'Instance'}</h1>
          {inst?.description && <p className="text-sm text-gray-600">{inst.description}</p>}
        </div>
        <div className="no-print flex gap-2">
          <Link href="/instances" className="btn btn-secondary">Back</Link>
          <Link href="/datasets" className="btn btn-secondary">Datasets</Link>
        </div>
      </header>

      {/* Print-optimized Letter layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print-safe">
        {/* Left: Map */}
        <div className="card p-3 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Affected Area</div>
            <div className="text-xs text-gray-500">{totalAreas} ADM1 selected</div>
          </div>
          <div style={{height: '520px'}}>
            <MapContainer center={[12.8797,121.7740]} zoom={5} scrollWheelZoom={false} className="h-full w-full">
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {affectedFC.features.length>0 && (
                <GeoJSON
                  key={affectedFC.features.length}
                  data={affectedFC as any}
                  style={() => ({
                    color:'#1f77b4',
                    weight:2,
                    fillColor:'#1f77b4',
                    fillOpacity:0.25
                  })}
                />
              )}
            </MapContainer>
          </div>
          {affectedFC.features.length===0 && (
            <div className="text-xs text-gray-500 mt-2">
              No polygons to show. Define affected area or ensure <code>admin_boundaries.geom</code> is exposed as GeoJSON.
            </div>
          )}
        </div>

        {/* Right: KPIs */}
        <div className="space-y-3">
          <div className="card p-3">
            <div className="text-sm font-semibold mb-1">Key Metrics</div>
            <div className="text-xs text-gray-500 mb-3">Quick read of current scoring state</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-md bg-[var(--gsc-light-gray)]">
                <div className="text-xs text-gray-600">Framework Avg</div>
                <div className="text-lg font-semibold">{frameworkAvg ? frameworkAvg.toFixed(3) : '—'}</div>
              </div>
              <div className="p-3 rounded-md bg-[var(--gsc-light-gray)]">
                <div className="text-xs text-gray-600">Final Avg</div>
                <div className="text-lg font-semibold">{finalAvg ? finalAvg.toFixed(3) : '—'}</div>
              </div>
            </div>
          </div>

          <InstanceRecomputePanel instanceId={id} />

          <div className="card p-3">
            <div className="text-sm font-semibold mb-2">Priority Locations (Top 15 by Final)</div>
            <div className="overflow-auto max-h-[280px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-1 pr-3">Admin Pcode</th>
                    <th className="py-1 pr-3 text-right">Final Score</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map(r=>(
                    <tr key={r.pcode} className="border-t">
                      <td className="py-1 pr-3">{r.pcode}</td>
                      <td className="py-1 pr-3 text-right font-medium">{r.score.toFixed(3)}</td>
                    </tr>
                  ))}
                  {top.length===0 && (
                    <tr><td className="py-2 text-xs text-gray-500" colSpan={2}>No final scores yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* TODO: Add People of Concern & People in Need tables when you confirm the exact dataset IDs to pull from.
         The layout above is sized to print nicely on Letter. */}
    </div>
  );
}
