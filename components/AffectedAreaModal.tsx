'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { createClient } from '@/lib/supabaseClient';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

type AdmRow = { admin_pcode: string; name: string; geom: Geometry };

export default function AffectedAreaModal({
  instanceId,
  initialScope,
  onClose,
  onSaved,
}: {
  instanceId: string;
  initialScope?: string[] | null;
  onClose: () => void;
  onSaved: (updatedScope: string[]) => Promise<void>;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<AdmRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialScope ?? []));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<'ADM1' | 'ADM2'>('ADM1');
  const geoRef = useRef<L.GeoJSON | null>(null);

  // Fetch polygons
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_admin_boundaries_geojson', {
        in_admin_level: level,
        in_search: search || null,
      });
      if (error) {
        console.error(error.message);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((r: any) => ({
            admin_pcode: r.admin_pcode,
            name: r.name,
            geom: r.geom as Geometry,
          }))
        );
      }
      setLoading(false);
    })();
  }, [level, search, supabase]);

  // Selection helpers
  const toggle = (p: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });

  const selectAll = () => setSelected(new Set(rows.map((r) => r.admin_pcode)));
  const clearAll = () => setSelected(new Set());

  const handleSave = async () => {
    setSaving(true);
    const scope = Array.from(selected);
    const { error } = await supabase
      .from('instances')
      .update({ admin_scope: scope })
      .eq('id', instanceId);
    setSaving(false);
    if (error) return alert(error.message);
    await onSaved(scope);
    onClose();
  };

  // Map feature styling
  const style = (f: any) => {
    const p = f.properties?.admin_pcode;
    const on = p && selected.has(p);
    return {
      color: on ? '#2e7d32' : '#888',
      weight: 1.2,
      fillColor: on ? '#81c784' : '#ccc',
      fillOpacity: on ? 0.6 : 0.2,
    };
  };
  const onEach = (f: any, l: L.Layer) => {
    const p = f.properties?.admin_pcode;
    if (!p) return;
    l.on({ click: () => toggle(p) });
    l.bindTooltip(f.properties?.name || p);
  };

  // Build FeatureCollection
  const fc: FeatureCollection = {
    type: 'FeatureCollection',
    features: rows.map(
      (r) =>
        ({
          type: 'Feature',
          geometry: r.geom,
          properties: { admin_pcode: r.admin_pcode, name: r.name },
        }) as Feature
    ),
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.admin_pcode.toLowerCase().includes(q)
    );
  }, [search, rows]);

  // Internal helper component to fit bounds safely
  function FitBoundsOnLoad({ geoRef }: { geoRef: React.RefObject<L.GeoJSON | null> }) {
    const map = useMap();
    useEffect(() => {
      if (geoRef.current) {
        try {
          const b = geoRef.current.getBounds();
          if (b.isValid()) map.fitBounds(b.pad(0.05));
        } catch {}
      }
    }, [map, geoRef, rows.length]);
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl w-[1100px] max-w-[95vw] max-h-[90vh] flex flex-col border">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-[var(--gsc-beige,#f5f2ee)] text-[var(--gsc-gray,#374151)] flex items-center justify-between">
          <div className="font-semibold text-sm">
            Configure Affected Area ({level})
          </div>
          <button
            className="px-3 py-1 rounded border text-sm hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 grid grid-cols-2 overflow-hidden">
          {/* Map */}
          <div className="relative h-[600px]">
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution="© OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {!loading && rows.length > 0 && (
                <GeoJSON
                  ref={geoRef as any}
                  data={fc as any}
                  style={style}
                  onEachFeature={onEach}
                />
              )}
              <FitBoundsOnLoad geoRef={geoRef} />
            </MapContainer>
          </div>

          {/* List */}
          <div className="border-l flex flex-col">
            <div className="p-3 flex items-center gap-2 border-b">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="ADM1">ADM1 (Regions)</option>
                <option value="ADM2">ADM2 (Provinces)</option>
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-2 rounded border text-sm"
              />
              <button
                onClick={selectAll}
                className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
              >
                Select all
              </button>
              <button
                onClick={clearAll}
                className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
              >
                Clear all
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="p-6 text-sm text-gray-500">Loading…</div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((r) => {
                    const on = selected.has(r.admin_pcode);
                    return (
                      <li
                        key={r.admin_pcode}
                        onClick={() => toggle(r.admin_pcode)}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer ${
                          on ? 'bg-green-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-sm font-medium">{r.name}</span>
                        <span
                          className={`text-xs ${
                            on ? 'text-green-700' : 'text-gray-500'
                          }`}
                        >
                          {r.admin_pcode}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="px-3 py-2 border-t text-xs text-gray-600">
              Selected {selected.size} of {rows.length}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button
            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 rounded text-white text-sm"
            style={{ background: 'var(--gsc-blue,#004b87)' }}
          >
            {saving ? 'Saving…' : 'Save Affected Area'}
          </button>
        </div>
      </div>
    </div>
  );
}
