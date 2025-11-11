'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

// Lazy-load Leaflet pieces for the modal map
const MapContainer = dynamic(
  () => import('react-leaflet').then(m => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(m => m.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import('react-leaflet').then(m => m.GeoJSON),
  { ssr: false }
);

type AdmRow = {
  admin_level: 'ADM1' | 'ADM2';
  admin_pcode: string;
  name: string;
  geom: Geometry | null;
};

type Instance = {
  id: string;
  name: string;
  admin_scope: string[] | null;
};

type Props = {
  instance: Instance;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export default function AffectedAreaModal({ instance, onClose, onSaved }: Props) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tree data
  const [adm1, setAdm1] = useState<AdmRow[]>([]);
  const [adm2ByAdm1, setAdm2ByAdm1] = useState<Record<string, AdmRow[]>>({});

  // UI state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Map features
  const features: Feature[] = useMemo(() => {
    const f: Feature[] = [];
    adm1.forEach((r) => {
      if (r.geom) {
        f.push({
          type: 'Feature',
          geometry: r.geom,
          properties: { admin_pcode: r.admin_pcode, name: r.name, level: 'ADM1' }
        });
      }
    });
    Object.values(adm2ByAdm1).forEach(rows => {
      rows.forEach(r => {
        if (r.geom) {
          f.push({
            type: 'Feature',
            geometry: r.geom,
            properties: { admin_pcode: r.admin_pcode, name: r.name, level: 'ADM2' }
          });
        }
      });
    });
    return f;
  }, [adm1, adm2ByAdm1]);

  const fc: FeatureCollection = useMemo(
    () => ({ type: 'FeatureCollection', features }),
    [features]
  );

  // Initial load
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // Start with stored selection
        const startSel = new Set(instance.admin_scope ?? []);
        setSelected(startSel);

        // Load ADM1 rows (names + geometry via RPC)
        const { data: rows } = await supabase
          .from('admin_boundaries')
          .select('admin_level, admin_pcode, name')
          .eq('admin_level', 'ADM1')
          .order('name', { ascending: true });

        let adm1Rows: AdmRow[] = (rows ?? []).map((r: any) => ({
          admin_level: 'ADM1',
          admin_pcode: r.admin_pcode,
          name: r.name,
          geom: null
        }));

        // Fetch geometries via RPC for ADM1
        const { data: geo1 } = await supabase.rpc('get_admin_boundaries_geojson', {
          in_admin_level: 'ADM1'
        });
        const geoIndex1: Record<string, Geometry> = {};
        (geo1 ?? []).forEach((g: any) => {
          if (g.admin_pcode && g.geom) geoIndex1[g.admin_pcode] = g.geom as Geometry;
        });
        adm1Rows = adm1Rows.map(r => ({ ...r, geom: geoIndex1[r.admin_pcode] ?? null }));
        setAdm1(adm1Rows);

        // Pre-expand ADM1s that are selected (or have any ADM2 selected later)
        const exp = new Set<string>();
        adm1Rows.forEach(r => {
          if (startSel.has(r.admin_pcode)) exp.add(r.admin_pcode);
        });
        setExpanded(exp);
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id]);

  // Load ADM2 for an ADM1 on demand (and also load their geometries)
  const ensureAdm2 = async (adm1Code: string) => {
    if (adm2ByAdm1[adm1Code]) return;
    const { data: rows } = await supabase
      .from('admin_boundaries')
      .select('admin_level, admin_pcode, name')
      .eq('admin_level', 'ADM2')
      .like('admin_pcode', `${adm1Code}%`)
      .order('name', { ascending: true });

    let adm2Rows: AdmRow[] = (rows ?? []).map((r: any) => ({
      admin_level: 'ADM2',
      admin_pcode: r.admin_pcode,
      name: r.name,
      geom: null
    }));

    const { data: geo2 } = await supabase.rpc('get_admin_boundaries_geojson', {
      in_admin_level: 'ADM2'
    });
    const geoIndex2: Record<string, Geometry> = {};
    (geo2 ?? []).forEach((g: any) => {
      if (g.admin_pcode && g.geom) geoIndex2[g.admin_pcode] = g.geom as Geometry;
    });
    adm2Rows = adm2Rows.map(r => ({ ...r, geom: geoIndex2[r.admin_pcode] ?? null }));

    setAdm2ByAdm1(prev => ({ ...prev, [adm1Code]: adm2Rows }));
  };

  // Selection helpers
  const toggleAdm1 = async (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) {
      next.delete(code);
      // Also drop child ADM2 for cleanliness
      const children = adm2ByAdm1[code] ?? [];
      children.forEach(c => next.delete(c.admin_pcode));
    } else {
      next.add(code);
    }
    setSelected(next);
  };

  const toggleAdm2 = (code: string, parent: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    // Optionally auto-select parent if any child selected:
    // if (Array.from(next).some(c => c.startsWith(parent))) next.add(parent);
    setSelected(next);
  };

  const isAdm1Indeterminate = (adm1Code: string) => {
    const children = adm2ByAdm1[adm1Code] ?? [];
    if (children.length === 0) return false;
    const childCodes = new Set(children.map(c => c.admin_pcode));
    const anySel = Array.from(childCodes).some(c => selected.has(c));
    const allSel = Array.from(childCodes).every(c => selected.has(c));
    return anySel && !allSel;
  };

  // Save selection
  const handleSave = async () => {
    setSaving(true);
    try {
      const arr = Array.from(selected);
      await supabase.from('instances').update({ admin_scope: arr }).eq('id', instance.id);
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Styles for modal z-index (above Leaflet)
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--gsc-blue,#004b87)]">
            Define Affected Area – {instance.name}
          </h2>
          <div className="space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 rounded text-sm bg-[var(--gsc-green,#2e7d32)] text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-0">
          {/* Tree selector */}
          <div className="col-span-5 border-r p-3 max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : (
              <ul className="space-y-2">
                {adm1.map((r1) => {
                  const checked = selected.has(r1.admin_pcode);
                  const indeterminate = isAdm1Indeterminate(r1.admin_pcode);
                  const expandedNow = expanded.has(r1.admin_pcode);
                  const children = adm2ByAdm1[r1.admin_pcode] ?? [];

                  return (
                    <li key={r1.admin_pcode}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const next = new Set(expanded);
                            if (next.has(r1.admin_pcode)) next.delete(r1.admin_pcode);
                            else {
                              next.add(r1.admin_pcode);
                              await ensureAdm2(r1.admin_pcode);
                            }
                            setExpanded(next);
                          }}
                          className="text-xs px-1 py-0.5 border rounded bg-white hover:bg-gray-50"
                          aria-label="expand"
                        >
                          {expandedNow ? '−' : '+'}
                        </button>

                        <input
                          type="checkbox"
                          checked={checked}
                          ref={(el) => {
                            if (el) el.indeterminate = !checked && indeterminate;
                          }}
                          onChange={() => toggleAdm1(r1.admin_pcode)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium">{r1.name}</span>
                        <span className="ml-auto text-xs text-gray-400">{r1.admin_pcode}</span>
                      </div>

                      {expandedNow && (
                        <ul className="ml-6 mt-2 space-y-1">
                          {children.length === 0 ? (
                            <li className="text-xs text-gray-400">Loading…</li>
                          ) : (
                            children.map((r2) => {
                              const cChecked = selected.has(r2.admin_pcode);
                              return (
                                <li key={r2.admin_pcode} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={cChecked}
                                    onChange={() => toggleAdm2(r2.admin_pcode, r1.admin_pcode)}
                                    className="h-4 w-4"
                                  />
                                  <span className="text-sm">{r2.name}</span>
                                  <span className="ml-auto text-xs text-gray-400">
                                    {r2.admin_pcode}
                                  </span>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Map */}
          <div className="col-span-7 p-3">
            <div className="h-[70vh] rounded border overflow-hidden relative z-0">
              <MapContainer
                center={[12.8797, 121.774]}
                zoom={5}
                scrollWheelZoom={false}
                className="h-full w-full"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Render ADM1 & ADM2 polygons; selected ones accent */}
                {features.length > 0 && (
                  <GeoJSON
                    key={features.length}
                    data={fc as any}
                    style={(feat: any) => {
                      const code = feat?.properties?.admin_pcode as string;
                      const isSel = selected.has(code);
                      return {
                        color: isSel ? '#004b87' : '#374151',
                        weight: isSel ? 2 : 1,
                        fillColor: isSel ? '#2e7d32' : '#e5e7eb',
                        fillOpacity: isSel ? 0.45 : 0.2
                      };
                    }}
                    eventHandlers={{
                      click: (e: any) => {
                        const code = e?.layer?.feature?.properties?.admin_pcode as string | undefined;
                        if (!code) return;
                        const next = new Set(selected);
                        if (next.has(code)) next.delete(code);
                        else next.add(code);
                        setSelected(next);
                      }
                    }}
                  />
                )}
              </MapContainer>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click polygons to toggle selection. Tree on the left controls ADM1/ADM2 hierarchy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
