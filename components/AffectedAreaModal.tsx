'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { createClient } from '@/lib/supabaseClient';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

type AdmRow = {
  admin_pcode: string;
  name: string;
  geom: GeoJSON.Geometry;
};

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
  const [q, setQ] = useState('');

  const geoRef = useRef<L.GeoJSON | null>(null);

  // Load data
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_admin_boundaries_geojson', {
        in_admin_level: 'ADM1',
      });
      if (error) {
        console.error(error);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((r: any) => ({
            admin_pcode: r.admin_pcode,
            name: r.name,
            geom: r.geom,
          }))
        );
      }
      setLoading(false);
    })();
  }, [supabase]);

  // Filter list by search
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(qq) ||
        r.admin_pcode.toLowerCase().includes(qq)
    );
  }, [q, rows]);

  const toggleSelect = (pcode: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(pcode) ? next.delete(pcode) : next.add(pcode);
      return next;
    });
  };

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

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const pcode = feature.properties?.admin_pcode;
    const name = feature.properties?.name;
    if (!pcode) return;
    layer.on({
      click: () => toggleSelect(pcode),
    });
    layer.bindTooltip(name);
  };

  const styleFeature = (feature: any) => {
    const pcode = feature.properties?.admin_pcode;
    const isSelected = pcode && selected.has(pcode);
    return {
      color: isSelected ? '#2e7d32' : '#999',
      weight: 1.5,
      fillColor: isSelected ? '#81c784' : '#f0f0f0',
      fillOpacity: isSelected ? 0.6 : 0.2,
    };
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl w-[1100px] max-w-[95vw] max-h-[90vh] flex flex-col border">
        <div className="px-4 py-3 border-b bg-[var(--gsc-beige,#f5f2ee)] text-[var(--gsc-gray,#374151)] flex items-center justify-between">
          <div className="font-semibold text-sm">Define Affected Area (ADM1)</div>
          <button
            className="px-3 py-1 rounded border text-sm hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex-1 grid grid-cols-2 overflow-hidden">
          {/* Left: map */}
          <div className="relative h-[600px]">
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution="© OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {!loading && rows.length > 0 && (
                <GeoJSON
                  key={selected.size}
                  data={{
                    type: 'FeatureCollection',
                    features: rows.map((r) => ({
                      type: 'Feature',
                      geometry: r.geom,
                      properties: {
                        admin_pcode: r.admin_pcode,
                        name: r.name,
                      },
                    })),
                  }}
                  style={styleFeature}
                  onEachFeature={onEachFeature}
                  ref={geoRef as any}
                />
              )}
            </MapContainer>
          </div>

          {/* Right: list */}
          <div className="border-l flex flex-col">
            <div className="p-3 flex items-center gap-2 border-b">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or pcode..."
                className="w-full px-3 py-2 rounded border text-sm"
              />
            </div>

            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="p-6 text-sm text-gray-500">Loading…</div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((r) => {
                    const checked = selected.has(r.admin_pcode);
                    return (
                      <li
                        key={r.admin_pcode}
                        className={`flex items-center justify-between px-3 py-2 ${
                          checked ? 'bg-green-50' : 'hover:bg-gray-50'
                        } cursor-pointer`}
                        onClick={() => toggleSelect(r.admin_pcode)}
                      >
                        <span className="text-sm font-medium">{r.name}</span>
                        <span
                          className={`text-xs ${
                            checked ? 'text-green-700' : 'text-gray-500'
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
              Selected: {selected.size} of {rows.length}
            </div>
          </div>
        </div>

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
            style={{
              background: 'var(--gsc-blue,#004b87)',
            }}
          >
            {saving ? 'Saving…' : 'Save Affected Area'}
          </button>
        </div>
      </div>
    </div>
  );
}
