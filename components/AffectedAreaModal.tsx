'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';

// --- Lazy React-Leaflet components with permissive typing (TS fix) ---
const MapContainer = dynamic(
  () =>
    import('react-leaflet').then((m) => {
      const C = m.MapContainer as React.FC<any>;
      return C;
    }),
  { ssr: false }
);
const TileLayer = dynamic(
  () =>
    import('react-leaflet').then((m) => {
      const C = m.TileLayer as React.FC<any>;
      return C;
    }),
  { ssr: false }
);
const GeoJSON = dynamic(
  () =>
    import('react-leaflet').then((m) => {
      const C = m.GeoJSON as React.FC<any>;
      return C;
    }),
  { ssr: false }
);

type AdmRow = {
  admin_pcode: string;
  name: string;
  geom: any; // GeoJSON geometry
};

type Props = {
  instance: any; // expects { id: string, admin_scope?: string[] }
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export default function AffectedAreaModal({ instance, onClose, onSaved }: Props) {
  const supabase = createClient();

  const [rows, setRows] = useState<AdmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  // selected = set of ADM1 pcodes
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // load ADM1 boundaries + initialize selection from instance.admin_scope
  useEffect(() => {
    (async () => {
      setLoading(true);
      const startSel = new Set<string>(instance?.admin_scope ?? []);
      setSelected(startSel);

      const { data, error } = await supabase.rpc('get_admin_boundaries_geojson', {
        in_level: 'ADM1',
      });
      if (!error && Array.isArray(data)) {
        // normalize to AdmRow[]
        const list: AdmRow[] = data.map((r: any) => ({
          admin_pcode: r.admin_pcode,
          name: r.name,
          geom: r.geom,
        }));
        // sort by name for predictable UI
        list.sort((a, b) => a.name.localeCompare(b.name));
        setRows(list);
      } else {
        setRows([]);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance?.id]);

  const filtered = useMemo(() => {
    const f = (filter || '').toLowerCase();
    if (!f) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(f) ||
        r.admin_pcode.toLowerCase().includes(f)
    );
  }, [rows, filter]);

  const featureCollectionAll = useMemo(
    () =>
      ({
        type: 'FeatureCollection',
        features: rows.map((r) => ({
          type: 'Feature',
          geometry: r.geom,
          properties: { admin_pcode: r.admin_pcode, name: r.name },
        })),
      } as any),
    [rows]
  );

  const featureCollectionSelected = useMemo(() => {
    const sel = selected;
    const feats = rows
      .filter((r) => sel.has(r.admin_pcode))
      .map((r) => ({
        type: 'Feature',
        geometry: r.geom,
        properties: { admin_pcode: r.admin_pcode, name: r.name },
      }));
    return { type: 'FeatureCollection', features: feats } as any;
  }, [rows, selected]);

  const toggleOne = (pcode: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pcode)) next.delete(pcode);
      else next.add(pcode);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(rows.map((r) => r.admin_pcode)));
  const clearAll = () => setSelected(new Set());

  const handleSave = async () => {
    setSaving(true);
    // persist to instances.admin_scope
    await supabase
      .from('instances')
      .update({ admin_scope: Array.from(selected) })
      .eq('id', instance.id);
    setSaving(false);
    await onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-[min(1100px,92vw)] max-h-[88vh] overflow-hidden border">
        <div className="px-4 py-3 border-b flex items-center justify-between bg-[var(--gsc-beige,#f5f2ee)]">
          <h2 className="text-sm font-semibold text-[var(--gsc-blue,#004b87)]">
            Define Affected Area (ADM1)
          </h2>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-12 gap-0">
          {/* Left: List */}
          <div className="col-span-5 p-3">
            <div className="flex items-center justify-between mb-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by name or pcode…"
                className="w-2/3 border rounded px-2 py-1 text-sm"
              />
              <div className="space-x-2">
                <button
                  onClick={selectAll}
                  className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                >
                  Select All
                </button>
                <button
                  onClick={clearAll}
                  className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="border rounded h-[460px] overflow-auto">
              {loading ? (
                <div className="p-3 text-xs text-gray-500">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-xs text-gray-500">No results.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 border-b text-xs text-gray-500">
                    <tr>
                      <th className="w-10 py-1"></th>
                      <th className="text-left py-1 px-2">Name</th>
                      <th className="text-left py-1 px-2">Pcode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const checked = selected.has(r.admin_pcode);
                      return (
                        <tr key={r.admin_pcode} className="border-b last:border-none">
                          <td className="text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOne(r.admin_pcode)}
                            />
                          </td>
                          <td className="py-1 px-2">{r.name}</td>
                          <td className="py-1 px-2">{r.admin_pcode}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
              <span>Selected: {selected.size}</span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 rounded bg-[var(--gsc-green,#2e7d32)] text-white hover:opacity-90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Affected Area'}
              </button>
            </div>
          </div>

          {/* Right: Map */}
          <div className="col-span-7 border-l">
            <div className="h-[460px]">
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
                {/* All ADM1 outlines */}
                {rows.length > 0 && (
                  <GeoJSON
                    data={featureCollectionAll}
                    style={() => ({
                      color: '#666',
                      weight: 1,
                      opacity: 0.6,
                      fillOpacity: 0,
                    })}
                  />
                )}
                {/* Selected ADM1 fill */}
                {featureCollectionSelected.features?.length > 0 && (
                  <GeoJSON
                    data={featureCollectionSelected}
                    style={() => ({
                      color: '#d35400',
                      weight: 2,
                      opacity: 0.9,
                      fillColor: '#2e7d32',
                      fillOpacity: 0.25,
                    })}
                  />
                )}
              </MapContainer>
            </div>
            <div className="px-3 py-2 text-[11px] text-gray-500">
              Selected areas are shaded green; non-selected outlines appear in gray.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
