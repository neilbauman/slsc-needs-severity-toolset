// components/AffectedAreaModal.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeoJSON as LeafletGeoJSON } from 'leaflet';

const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import('react-leaflet').then((m) => m.GeoJSON),
  { ssr: false }
);

type AdmRow = {
  admin_level: string;
  admin_pcode: string;
  name: string;
  geom: Geometry; // comes back as GeoJSON geometry from the SQL function/view
};

export default function AffectedAreaModal({
  instanceId,
  onClose,
  onSaved,
}: {
  instanceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<AdmRow[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const layerRef = useRef<LeafletGeoJSON | null>(null);

  // Load ADM1 boundaries and current instance selection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 1) Preload instance selection
        const { data: inst, error: instErr } = await supabase
          .from('instances')
          .select('admin_scope')
          .eq('id', instanceId)
          .single();

        if (instErr) throw instErr;
        const startSel = new Set<string>((inst?.admin_scope as string[] | null) ?? []);
        if (cancelled) return;
        setSelected(startSel);

        // 2) Load ADM1 boundaries via RPC (expects rows with admin_pcode, name, geom)
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          'get_admin_boundaries_geojson',
          { level: 'ADM1' } // if your arg name differs (e.g. admin_level), adjust here
        );

        if (rpcErr) throw rpcErr;

        const list: AdmRow[] = (rpcData ?? []) as AdmRow[];
        if (cancelled) return;
        setRows(list);

        const feats: Feature[] = (list ?? []).map((r) => ({
          type: 'Feature',
          geometry: r.geom,
          properties: {
            admin_pcode: r.admin_pcode,
            name: r.name,
            admin_level: r.admin_level,
          },
        }));
        setFeatures(feats);
      } catch (e) {
        console.error('AffectedAreaModal load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instanceId, supabase]);

  const fc = useMemo<FeatureCollection<Geometry>>(
    () => ({
      type: 'FeatureCollection',
      features,
    }),
    [features]
  );

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.admin_pcode.toLowerCase().includes(s)
    );
  }, [rows, search]);

  const toggleCode = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(rows.map((r) => r.admin_pcode)));
  };

  const clearAll = () => {
    setSelected(new Set());
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const arr = Array.from(selected);
      const { error } = await supabase
        .from('instances')
        .update({ admin_scope: arr })
        .eq('id', instanceId);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (e) {
      console.error('Save affected area failed', e);
      setSaving(false);
    }
  };

  // Leaflet styling: highlight selected ADM1 with thicker border & light fill
  const styleFor = (feat: Feature) => {
    const code = feat.properties?.['admin_pcode'] as string | undefined;
    const isOn = code ? selected.has(code) : false;
    return {
      color: isOn ? '#004b87' : '#374151', // GSC blue vs neutral gray
      weight: isOn ? 2 : 1,
      fillColor: isOn ? '#e5f0fa' : '#f5f2ee',
      fillOpacity: isOn ? 0.6 : 0.35,
    };
  };

  const onEachFeature = (feat: Feature, layer: any) => {
    const code = feat.properties?.['admin_pcode'] as string | undefined;
    const nm = feat.properties?.['name'] as string | undefined;
    if (code) {
      layer.on('click', () => toggleCode(code));
      layer.bindTooltip(`${nm ?? ''} (${code})`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-[var(--gsc-beige,#f5f2ee)]">
          <h2 className="text-base font-semibold text-[var(--gsc-blue,#004b87)]">
            Configure Affected Area (ADM1)
          </h2>
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm border hover:bg-[var(--gsc-light-gray,#e5e7eb)]"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-[70vh]">
          {/* Map */}
          <div className="relative">
            <div className="absolute inset-0">
              {!loading && features.length > 0 ? (
                <MapContainer
                  center={[12.8797, 121.774]}
                  zoom={5}
                  scrollWheelZoom={false}
                  className="h-full w-full z-[61] rounded-none"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <GeoJSON
                    key={features.length}
                    data={fc as any}
                    style={styleFor as any}
                    onEachFeature={onEachFeature as any}
                    ref={layerRef as any}
                  />
                </MapContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-gray-500">
                  {loading ? 'Loading boundaries…' : 'No ADM1 features found.'}
                </div>
              )}
            </div>
          </div>

          {/* List & controls */}
          <div className="flex flex-col border-l">
            <div className="p-3 flex items-center gap-2 border-b bg-white sticky top-0 z-[62]">
              <input
                className="flex-1 border rounded px-2 py-1 text-sm"
                placeholder="Search by name or pcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                onClick={selectAll}
                className="text-xs px-2 py-1 rounded border hover:bg-[var(--gsc-light-gray,#e5e7eb)]"
              >
                Select all
              </button>
              <button
                onClick={clearAll}
                className="text-xs px-2 py-1 rounded border hover:bg-[var(--gsc-light-gray,#e5e7eb)]"
              >
                Clear all
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {filteredRows.map((r) => {
                const on = selected.has(r.admin_pcode);
                return (
                  <label
                    key={r.admin_pcode}
                    className="flex items-center gap-2 px-3 py-2 border-b text-sm cursor-pointer hover:bg-[var(--gsc-beige,#f5f2ee)]"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleCode(r.admin_pcode)}
                    />
                    <span className="font-medium">{r.name}</span>
                    <span className="text-gray-500 ml-auto">{r.admin_pcode}</span>
                  </label>
                );
              })}
              {filteredRows.length === 0 && (
                <div className="p-4 text-sm text-gray-500">No results.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-xs text-gray-600">
            Selected: {selected.size} of {rows.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm border hover:bg-[var(--gsc-light-gray,#e5e7eb)]"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              onClick={handleSave}
              className="rounded px-3 py-1.5 text-sm text-white"
              style={{
                background: 'var(--gsc-blue, #004b87)',
              }}
            >
              {saving ? 'Saving…' : 'Save Affected Area'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
