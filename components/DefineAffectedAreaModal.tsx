'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';

// react-leaflet must be dynamic (no SSR)
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr:false });
const TileLayer   = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr:false });
const GeoJSON     = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr:false });

type Boundary = {
  admin_pcode:string;
  name:string;
  admin_level:string;
  geom?: any; // expect GeoJSON geometry if PostgREST serializes
};

export default function DefineAffectedAreaModal({
  instanceId,
  initialScope,
  onClose,
  onSaved,
}:{
  instanceId:string;
  initialScope:string[]|null;
  onClose:()=>void;
  onSaved:()=>Promise<void>;
}){
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [adm1, setAdm1] = useState<Boundary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialScope ?? []));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      // fetch ADM1 boundaries; expecting PostGIS geometry to serialize as GeoJSON
      const { data, error } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode,name,admin_level,geom')
        .eq('admin_level','adm1')
        .order('name', { ascending: true });
      if (!active) return;
      if (error) {
        console.error(error);
        setAdm1([]);
      } else {
        setAdm1(data as Boundary[]);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase]);

  const toggle = (pcode:string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(pcode)) n.delete(pcode); else n.add(pcode);
      return n;
    });
  };

  const allChecked = useMemo(() => adm1.length>0 && adm1.every(a => selected.has(a.admin_pcode)), [adm1, selected]);
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(adm1.map(a => a.admin_pcode)));
  };

  const save = async () => {
    setSaving(true);
    const scope = Array.from(selected);
    const { error } = await supabase
      .from('instances')
      .update({ admin_scope: scope })
      .eq('id', instanceId);
    setSaving(false);
    if (error) {
      alert(`Failed to save: ${error.message}`);
      return;
    }
    await onSaved();
    onClose();
  };

  // Build FeatureCollection for selected polygons (if geometry available)
  const featureCollection = useMemo(() => {
    const feats = adm1
      .filter(a => selected.has(a.admin_pcode))
      .filter(a => a.geom) // only if serialized
      .map(a => ({
        type:'Feature',
        geometry: a.geom,
        properties: { name:a.name, pcode:a.admin_pcode }
      }));
    return { type:'FeatureCollection', features:feats } as any;
  }, [adm1, selected]);

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal p-4 max-w-5xl">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold" style={{color:'var(--gsc-blue)'}}>Define Affected Area</h2>
          <button className="btn btn-secondary no-print" onClick={onClose}>Close</button>
        </div>
        <p className="text-sm mb-3">Select ADM1 regions included in this instance. Map highlights selected areas.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: checkbox list */}
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">ADM1 Regions</span>
              <button className="btn btn-secondary" onClick={toggleAll}>
                {allChecked ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="h-[360px] overflow-auto pr-2">
              {loading && <div className="text-sm">Loading…</div>}
              {!loading && adm1.map(a => (
                <label key={a.admin_pcode} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    className="accent-[var(--gsc-blue)]"
                    checked={selected.has(a.admin_pcode)}
                    onChange={() => toggle(a.admin_pcode)}
                  />
                  <span>{a.name}</span>
                  <span className="ml-auto text-xs text-gray-500">{a.admin_pcode}</span>
                </label>
              ))}
              {!loading && adm1.length===0 && (
                <div className="text-sm text-gray-500">No ADM1 boundaries found.</div>
              )}
            </div>
          </div>

          {/* Right: map */}
          <div className="card p-3">
            <div className="text-sm font-medium mb-2">Map Preview</div>
            <div className="map-pane">
              <MapContainer center={[12.8797,121.7740]} zoom={5} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Draw selected polygons if available */}
                {featureCollection.features.length>0 && (
                  <GeoJSON
                    key={featureCollection.features.length}
                    data={featureCollection as any}
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
            {featureCollection.features.length===0 && (
              <div className="text-xs text-gray-500 mt-2">
                Select regions on the left to highlight them here. (If polygons don’t appear, ensure PostGIS geometry is exposed as GeoJSON in <code>admin_boundaries.geom</code>.)
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Selection'}
          </button>
        </div>
      </div>
    </>
  );
}
