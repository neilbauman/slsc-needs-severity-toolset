'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import { useCountry } from '@/lib/countryContext';
import { getAdminLevelName } from '@/lib/adminLevelNames';

const MapContainer: any = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer: any = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const GeoJSONLayer: any = dynamic(
  () => import('react-leaflet').then((m) => m.GeoJSON),
  { ssr: false }
);

type Props = {
  instance: {
    id: string;
    name: string;
    admin_scope: string[] | null;
  };
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

type Adm1ListRow = { admin_pcode: string; name: string };
type Adm1PolyRow = { admin_pcode: string; name: string; geom: any };

export default function AffectedAreaModal({ instance, onClose, onSaved }: Props) {
  const supabase = createClient();
  const { adminLevels } = useCountry();
  const [list, setList] = useState<Adm1ListRow[]>([]);
  const [polys, setPolys] = useState<Adm1PolyRow[]>([]);
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = useMemo<Set<string>>(() => {
    return new Set(instance.admin_scope ?? []);
  }, [instance.admin_scope]);

  // load list + polys once
  const load = async () => {
    const { data: rows } = await supabase.rpc('get_admin_boundaries_list', {
      in_level: 'ADM1',
    });
    setList(rows ?? []);

    const { data: geo } = await supabase.rpc('get_admin_boundaries_geojson', {
      in_level: 'ADM1',
    });
    setPolys(geo ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id]);

  const toggle = (pcode: string) => {
    if (selected.has(pcode)) {
      selected.delete(pcode);
    } else {
      selected.add(pcode);
    }
    // force rerender by cloning
    setList((prev) => [...prev]);
  };

  const save = async () => {
    setSaving(true);
    await supabase
      .from('instances')
      .update({ admin_scope: Array.from(selected) })
      .eq('id', instance.id);
    setSaving(false);
    await onSaved();
    onClose();
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.admin_pcode.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
    );
  }, [filter, list]);

  return (
    <div className="fixed inset-0 z-[999] bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[1100px] max-w-[95vw]">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold">
            Define Affected Area — {instance.name} ({getAdminLevelName(adminLevels, 1, true)})
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 border rounded text-sm bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-12 gap-0" style={{ height: 520 }}>
          {/* Left: list */}
          <div className="col-span-4 border-r p-3 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by name or pcode..."
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <button
                className="text-sm px-2 py-1 border rounded"
                onClick={() => {
                  // select all filtered
                  filtered.forEach((r) => selected.add(r.admin_pcode));
                  setList((p) => [...p]);
                }}
              >
                Select All
              </button>
              <button
                className="text-sm px-2 py-1 border rounded"
                onClick={() => {
                  // clear all filtered
                  filtered.forEach((r) => selected.delete(r.admin_pcode));
                  setList((p) => [...p]);
                }}
              >
                Clear
              </button>
            </div>

            <div className="overflow-auto h-[460px] pr-1">
              {filtered.length === 0 ? (
                <div className="text-sm text-gray-500">No results.</div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((r) => (
                    <li
                      key={r.admin_pcode}
                      className="flex items-center justify-between border rounded px-2 py-1 hover:bg-gray-50"
                    >
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.has(r.admin_pcode)}
                          onChange={() => toggle(r.admin_pcode)}
                        />
                        <span className="truncate">{r.name}</span>
                      </label>
                      <span className="text-xs text-gray-400">
                        {r.admin_pcode}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>Selected: {selected.size}</span>
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 rounded text-sm bg-[var(--gsc-green,#2e7d32)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Affected Area'}
              </button>
            </div>
          </div>

          {/* Right: map */}
          <div className="col-span-8 p-0">
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

              {/* base outlines */}
              {polys.length > 0 && (
                <GeoJSONLayer
                  key="adm1-base"
                  data={{
                    type: 'FeatureCollection',
                    features: polys.map((r) => ({
                      type: 'Feature',
                      geometry: r.geom,
                      properties: { name: r.name, pcode: r.admin_pcode },
                    })),
                  }}
                  style={(feat: any) => {
                    const isSel = selected.has(feat?.properties?.pcode);
                    return {
                      color: isSel ? '#166534' : '#64748b',
                      weight: isSel ? 1.25 : 0.75,
                      fillColor: isSel ? 'rgba(46,125,50,0.35)' : 'rgba(148,163,184,0.15)',
                      fillOpacity: 0.5,
                    };
                  }}
                  eventHandlers={{
                    click: (e: any) => {
                      const pcode = e?.layer?.feature?.properties?.pcode;
                      if (pcode) toggle(pcode);
                    },
                  }}
                />
              )}
            </MapContainer>
            <div className="px-3 py-2 text-xs text-gray-500">
              Click {getAdminLevelName(adminLevels, 1, true).toLowerCase()} to include/exclude. Selected areas are shown in green.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
