'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';

/* Lazy-load leaflet bits (no SSR) */
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer     = dynamic(() => import('react-leaflet').then(m => m.TileLayer),     { ssr: false });
const GeoJSON       = dynamic(() => import('react-leaflet').then(m => m.GeoJSON),       { ssr: false });

type Instance = {
  id: string;
  name: string;
  admin_scope: string[] | null;
};

type Adm1Row = { admin_pcode: string; name: string };
type Adm2GeoRow = { admin_pcode: string; name: string; geom: any }; // geom is GeoJSON geometry

type Props = {
  instance: Instance;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export default function AffectedAreaModal({ instance, onClose, onSaved }: Props) {
  const supabase = createClient();

  const [adm1, setAdm1] = useState<Adm1Row[]>([]);
  const [adm2, setAdm2] = useState<Adm2GeoRow[]>([]);
  const [loading, setLoading] = useState(true);

  // selections
  const [selAdm1, setSelAdm1] = useState<Set<string>>(new Set());
  const [selAdm2, setSelAdm2] = useState<Set<string>>(new Set());

  // map ref to fit bounds
  const geoRef = useRef<any>(null);

  /** Load ADM1 list + ALL ADM2 geometries once */
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);

      // ADM1 (list)
      const { data: a1 } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode,name')
        .eq('admin_level', 'ADM1')
        .order('name', { ascending: true });

      // ALL ADM2 as GeoJSON (RPC returns rows with admin_pcode, name, geom as GeoJSON)
      // If you used a different arg name, adjust here.
      const { data: a2 } = await supabase.rpc('get_admin_boundaries_geojson', { in_level: 'ADM2' });

      if (!isMounted) return;

      setAdm1((a1 ?? []) as Adm1Row[]);
      setAdm2((a2 ?? []) as Adm2GeoRow[]);

      // seed selections from instance.admin_scope
      const seed = new Set(instance.admin_scope ?? []);
      const seed1 = new Set<string>([...seed].filter(p => p.length === 4));  // ADM1 (PH07)
      const seed2 = new Set<string>([...seed].filter(p => p.length > 4));    // ADM2 (PH07022)
      setSelAdm1(seed1);
      setSelAdm2(seed2);

      setLoading(false);
    })();
    return () => { isMounted = false; };
  }, [instance.id]);

  /** Helper: parent region code from a province pcode */
  const parentOf = (adm2Pcode: string) => adm2Pcode.slice(0, 4); // e.g. PH07022 -> PH07

  /** Group ADM2 by parent ADM1 for tree rendering */
  const adm2ByParent = useMemo(() => {
    const m = new Map<string, Adm2GeoRow[]>();
    for (const r of adm2) {
      const parent = parentOf(r.admin_pcode);
      if (!m.has(parent)) m.set(parent, []);
      m.get(parent)!.push(r);
    }
    // keep children sorted by name
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
      m.set(k, arr);
    }
    return m;
  }, [adm2]);

  /** GeoJSON FC of currently visible polygons (any ADM2 whose parent ADM1 is selected OR itself selected) */
  const visibleFeatures = useMemo(() => {
    const feats = adm2
      .filter(r => selAdm2.has(r.admin_pcode) || selAdm1.has(parentOf(r.admin_pcode)))
      .map(r => ({
        type: 'Feature',
        geometry: r.geom,
        properties: {
          pcode: r.admin_pcode,
          name: r.name,
          parent: parentOf(r.admin_pcode),
          selected: selAdm2.has(r.admin_pcode) || selAdm1.has(parentOf(r.admin_pcode)),
        },
      }));
    return { type: 'FeatureCollection', features: feats } as any;
  }, [adm2, selAdm1, selAdm2]);

  /** Fit bounds on change */
  useEffect(() => {
    try {
      if (geoRef.current && (visibleFeatures.features?.length ?? 0) > 0) {
        // @ts-ignore leaflet typings at runtime
        const layer = geoRef.current;
        const b = layer.getBounds?.();
        if (b && b.isValid()) {
          // @ts-ignore access underlying map safely via _map if available
          const map = (layer as any)?._map ?? layer._leafletMap ?? null;
          if (map && map.fitBounds) map.fitBounds(b.pad(0.05));
        }
      }
    } catch { /* noop */ }
  }, [visibleFeatures]);

  /** Toggle handlers */
  const toggleAdm1 = (code: string) => {
    const next = new Set(selAdm1);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelAdm1(next);
  };

  const toggleAdm2 = (code: string) => {
    const next = new Set(selAdm2);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelAdm2(next);
  };

  /** Save: union of selected ADM1 + ADM2 */
  const handleSave = async () => {
    const scope = Array.from(new Set<string>([...selAdm1, ...selAdm2]));
    await supabase
      .from('instances')
      .update({ admin_scope: scope })
      .eq('id', instance.id);
    await onSaved();
    onClose();
  };

  const allSelectedCount = useMemo(
    () => selAdm1.size + selAdm2.size,
    [selAdm1.size, selAdm2.size],
  );

  /** leaf style (green highlight for included polygons) */
  const styleFn = (feature: any) => {
    const included = !!feature?.properties?.selected;
    return {
      color: included ? '#2e7d32' : '#9aa1a9',
      weight: included ? 2 : 1,
      fillOpacity: included ? 0.25 : 0.05,
      fillColor: included ? '#2e7d32' : '#9aa1a9',
    };
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30">
      <div className="w-[1100px] max-h-[90vh] overflow-hidden rounded-lg border bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-[var(--gsc-beige,#f5f2ee)]">
          <div className="text-sm font-semibold">
            Define Affected Area – {instance.name}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">{allSelectedCount} selected</span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded bg-[var(--gsc-green,#2e7d32)] text-white hover:opacity-90 disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-12 gap-0">
          {/* Tree (ADM1 / ADM2) */}
          <div className="col-span-4 border-r overflow-y-auto" style={{ maxHeight: '78vh' }}>
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Loading…</div>
            ) : (
              <div className="p-2">
                {adm1.map(r1 => {
                  const children = adm2ByParent.get(r1.admin_pcode) ?? [];
                  const childChecked = children.filter(c => selAdm2.has(c.admin_pcode)).length;
                  const parentChecked = selAdm1.has(r1.admin_pcode);
                  const indeterminate = !parentChecked && childChecked > 0;

                  return (
                    <div key={r1.admin_pcode} className="mb-1">
                      <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={parentChecked}
                          ref={el => { if (el) el.indeterminate = indeterminate; }}
                          onChange={() => toggleAdm1(r1.admin_pcode)}
                        />
                        <span className="text-sm font-medium">
                          {r1.name} <span className="text-gray-400 text-xs">{r1.admin_pcode}</span>
                        </span>
                      </label>

                      {/* ADM2 list */}
                      {children.length > 0 && (
                        <div className="ml-6">
                          {children.map(c => (
                            <label
                              key={c.admin_pcode}
                              className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                checked={selAdm2.has(c.admin_pcode)}
                                onChange={() => toggleAdm2(c.admin_pcode)}
                              />
                              <span className="text-[13px]">
                                {c.name}{' '}
                                <span className="text-gray-400 text-[11px]">{c.admin_pcode}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="col-span-8">
            <div className="h-[78vh]">
              <MapContainer
                center={[12.8797, 121.774]}
                zoom={5}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Render all visible ADM2 polygons (from selected ADM1 and/or individually selected ADM2) */}
                <GeoJSON ref={geoRef as any} data={visibleFeatures as any} style={styleFn} />
              </MapContainer>
            </div>
            <div className="px-3 py-2 text-[11px] text-gray-500 border-t">
              Click checkboxes to include/exclude. Provinces (ADM2) render when their Region (ADM1) is selected. You can
              refine by toggling individual provinces.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
