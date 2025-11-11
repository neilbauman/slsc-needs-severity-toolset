'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { GeoJSON as LeafletGeoJSON } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabaseClient';

type Instance = {
  id: string;
  name: string;
  admin_scope?: string[] | null;
};

type AdmRow = {
  admin_level: 'ADM1' | 'ADM2';
  admin_pcode: string;
  name: string;
  geom: Geometry;
};

type Props = {
  instance: Instance;
  onClose: () => void;
  onSaved: () => void;
};

const GSC = {
  red: '#630710',
  blue: '#004b87',
  green: '#2e7d32',
  orange: '#d35400',
  gray: '#374151',
  lightGray: '#e5e7eb',
  beige: '#f5f2ee',
};

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

function toFeatureCollection(rows: AdmRow[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: r.geom,
      properties: {
        admin_level: r.admin_level,
        admin_pcode: r.admin_pcode,
        name: r.name,
      },
    })) as Feature[],
  };
}

// simple green→red gradient for future use (kept for consistency)
function pctToColor(p: number) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const t = clamp(p);
  const r = Math.round(255 * t);
  const g = Math.round(170 * (1 - t) + 30); // keep green-ish when low
  const b = Math.round(60 * (1 - t));
  return `rgb(${r},${g},${b})`;
}

export default function AffectedAreaModal({ instance, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [adm1Rows, setAdm1Rows] = useState<AdmRow[]>([]);
  const [adm2Rows, setAdm2Rows] = useState<AdmRow[]>([]);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [selectedAdm2, setSelectedAdm2] = useState<Set<string>>(
    new Set(instance.admin_scope ?? [])
  );

  // map refs
  const adm1LayerRef = useRef<LeafletGeoJSON | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // load ADM1 + ADM2
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: a1, error: e1 }, { data: a2, error: e2 }] = await Promise.all([
        supabase.rpc('get_admin_boundaries_geojson', {
          in_admin_level: 'ADM1',
          in_search: null,
        }),
        supabase.rpc('get_admin_boundaries_geojson', {
          in_admin_level: 'ADM2',
          in_search: null,
        }),
      ]);

      if (!cancelled) {
        if (e1 || e2) {
          console.error('RPC get_admin_boundaries_geojson failed', e1 || e2);
          setAdm1Rows([]);
          setAdm2Rows([]);
        } else {
          setAdm1Rows((a1 ?? []) as AdmRow[]);
          setAdm2Rows((a2 ?? []) as AdmRow[]);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // group ADM2 by parent ADM1 prefix (first 4 chars like PH01)
  const grouped = useMemo(() => {
    const byParent = new Map<string, AdmRow[]>();
    for (const r of adm2Rows) {
      const parent = r.admin_pcode.slice(0, 4);
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent)!.push(r);
    }
    // keep ADM1 display rows aligned with actual data available
    const adm1 = adm1Rows
      .map((r) => ({
        ...r,
        children: (byParent.get(r.admin_pcode) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      }))
      .filter((r) => r.children.length > 0);

    // search filter
    const s = search.trim().toLowerCase();
    if (!s) return adm1;

    return adm1
      .map((g) => {
        const matchGroup =
          g.name.toLowerCase().includes(s) ||
          g.admin_pcode.toLowerCase().includes(s);
        const kids = matchGroup
          ? g.children
          : g.children.filter(
              (c) =>
                c.name.toLowerCase().includes(s) ||
                c.admin_pcode.toLowerCase().includes(s)
            );
        return kids.length ? { ...g, children: kids } : null;
      })
      .filter(Boolean) as (AdmRow & { children: AdmRow[] })[];
  }, [adm1Rows, adm2Rows, search]);

  const totalAdm2 = useMemo(
    () => adm2Rows.length,
    [adm2Rows.length]
  );

  // geojson sources for map (ADM1 outlines, selected ADM2 shaded)
  const adm1FC = useMemo(() => toFeatureCollection(adm1Rows), [adm1Rows]);
  const selectedAdm2FC = useMemo(() => {
    const sel = new Set(selectedAdm2);
    const rows = adm2Rows.filter((r) => sel.has(r.admin_pcode));
    return toFeatureCollection(rows);
  }, [adm2Rows, selectedAdm2]);

  // fit map to ADM1 bounds when layer mounts/updates
  useEffect(() => {
    const layer = adm1LayerRef.current;
    if (!layer) return;
    try {
      const b = layer.getBounds();
      if (b.isValid()) {
        const map = layer._map ?? mapRef.current;
        map?.fitBounds(b.pad(0.05));
      }
    } catch {
      /* noop */
    }
  }, [adm1FC]);

  // handlers
  const toggleGroup = (adm1Code: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(adm1Code)) next.delete(adm1Code);
      else next.add(adm1Code);
      return next;
    });
  };

  const isGroupOpen = (adm1Code: string) => openGroups.has(adm1Code);

  const handleToggleAdm2 = (code: string) => {
    setSelectedAdm2((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleToggleAdm1 = (adm1Code: string, children: AdmRow[], checked: boolean) => {
    setSelectedAdm2((prev) => {
      const next = new Set(prev);
      for (const ch of children) {
        if (checked) next.add(ch.admin_pcode);
        else next.delete(ch.admin_pcode);
      }
      return next;
    });
  };

  const isAdm1FullySelected = (children: AdmRow[]) =>
    children.every((c) => selectedAdm2.has(c.admin_pcode));

  const isAdm1PartiallySelected = (children: AdmRow[]) => {
    const any = children.some((c) => selectedAdm2.has(c.admin_pcode));
    const all = isAdm1FullySelected(children);
    return any && !all;
  };

  const selectAll = () => {
    setSelectedAdm2(new Set(adm2Rows.map((r) => r.admin_pcode)));
  };

  const clearAll = () => setSelectedAdm2(new Set());

  const save = async () => {
    const codes = Array.from(selectedAdm2);
    const { error } = await supabase
      .from('instances')
      .update({ admin_scope: codes })
      .eq('id', instance.id);
    if (error) {
      console.error('Failed saving admin_scope', error);
      return;
    }
    onSaved();
  };

  // styles
  const panelCls =
    'rounded-lg border border-gray-200 bg-white shadow-sm';
  const headerCls =
    'flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 bg-[var(--gsc-beige,#f5f2ee)] border-b border-gray-200';
  const btn =
    'px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50';
  const btnPrimary =
    'bg-[var(--gsc-blue,#004b87)] text-white hover:opacity-90';
  const btnGhost =
    'border border-gray-300 text-gray-700 hover:bg-gray-50';
  const chip =
    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--gsc-light-gray,#e5e7eb)] text-[var(--gsc-gray,#374151)]';

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      aria-modal
    >
      <div className="w-[min(1000px,96vw)] max-h-[92vh] overflow-hidden rounded-xl bg-white shadow-2xl border border-gray-200">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-[var(--gsc-beige,#f5f2ee)]">
          <h2 className="text-[15px] font-semibold text-[var(--gsc-gray,#374151)]">
            Configure Affected Area (ADM1 → ADM2)
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className={classNames(btn, btnGhost)}>
              Close
            </button>
            <button
              onClick={save}
              className={classNames(btn, btnPrimary)}
              disabled={loading}
            >
              Save Affected Area
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {/* Left: Map */}
          <div className={panelCls}>
            <div className={headerCls}>
              <span>Regions map (ADM1 outlines, selected ADM2 shaded)</span>
              <span className={chip}>
                Selected provinces: {selectedAdm2.size}
              </span>
            </div>
            <div className="h-[520px]">
              <MapContainer
                ref={(m) => (mapRef.current = m)}
                center={[12.8797, 121.7740]}
                zoom={5}
                scrollWheelZoom={false}
                className="h-full w-full"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* ADM1 outlines */}
                <GeoJSON
                  ref={adm1LayerRef as any}
                  data={adm1FC as any}
                  style={() => ({
                    color: '#666',
                    weight: 1,
                    fill: false,
                  })}
                />
                {/* Selected ADM2 shaded */}
                <GeoJSON
                  data={selectedAdm2FC as any}
                  style={() => ({
                    color: '#222',
                    weight: 1,
                    fill: true,
                    fillOpacity: 0.35,
                    fillColor: pctToColor(0.25), // currently uniform; hook to scoring later
                  })}
                  onEachFeature={(feat, layer) => {
                    const p = feat.properties as any;
                    if (p?.name) layer.bindTooltip(`${p.name} (${p.admin_pcode})`);
                  }}
                />
              </MapContainer>
            </div>
          </div>

          {/* Right: Hierarchical selector */}
          <div className={panelCls}>
            <div className={headerCls}>
              <div className="flex items-center gap-2">
                <span>Regions (ADM1) & Provinces (ADM2)</span>
                <span className={chip}>{totalAdm2} provinces</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className={classNames(btn, btnGhost)}>
                  Select all
                </button>
                <button onClick={clearAll} className={classNames(btn, btnGhost)}>
                  Clear all
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-3 pt-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search region/province name or pcode…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gsc-blue,#004b87)]"
              />
            </div>

            {/* Tree list */}
            <div className="p-3 pt-2 overflow-y-auto max-h-[460px]">
              {loading ? (
                <div className="text-sm text-gray-500 py-20 text-center">
                  Loading administrative boundaries…
                </div>
              ) : grouped.length === 0 ? (
                <div className="text-sm text-gray-500 py-20 text-center">
                  No results.
                </div>
              ) : (
                <ul className="space-y-2">
                  {grouped.map((g) => {
                    const open = isGroupOpen(g.admin_pcode);
                    const full = isAdm1FullySelected(g.children);
                    const partial = isAdm1PartiallySelected(g.children);

                    return (
                      <li key={g.admin_pcode} className="border border-gray-200 rounded-md">
                        {/* ADM1 row */}
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                          <div className="flex items-center gap-2">
                            <button
                              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
                              onClick={() => toggleGroup(g.admin_pcode)}
                              aria-label={open ? 'Collapse' : 'Expand'}
                            >
                              {open ? '−' : '+'}
                            </button>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={full}
                                ref={(el) => {
                                  if (el) el.indeterminate = partial;
                                }}
                                onChange={(e) =>
                                  handleToggleAdm1(g.admin_pcode, g.children, e.target.checked)
                                }
                              />
                              <span className="font-medium">{g.name}</span>
                              <span className="text-gray-500">({g.admin_pcode})</span>
                              <span className={chip}>{g.children.length} provinces</span>
                            </label>
                          </div>
                        </div>

                        {/* ADM2 children */}
                        {open && (
                          <div className="px-3 py-2">
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {g.children.map((c) => {
                                const checked = selectedAdm2.has(c.admin_pcode);
                                return (
                                  <li key={c.admin_pcode}>
                                    <label className="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-gray-50">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => handleToggleAdm2(c.admin_pcode)}
                                      />
                                      <span className="truncate">{c.name}</span>
                                      <span className="text-gray-500">{c.admin_pcode}</span>
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-sm text-gray-600">
            Selected provinces:&nbsp;
            <span className="font-medium">{selectedAdm2.size}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className={classNames(btn, btnGhost)}>
              Cancel
            </button>
            <button
              onClick={save}
              className={classNames(btn, btnPrimary)}
              disabled={loading}
            >
              Save Affected Area
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
