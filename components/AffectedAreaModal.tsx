'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import type { Feature, FeatureCollection } from 'geojson';
import type { GeoJSON as LeafletGeoJSON } from 'leaflet';

const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import('react-leaflet').then(mod => mod.GeoJSON),
  { ssr: false }
);

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
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const layerRef = useRef<LeafletGeoJSON | null>(null);
  
  // ---- fetch admin_scope + ADM1 polygons as GeoJSON
  useEffect(() => {
    (async () => {
      setLoading(true);

      const [{ data: inst, error: instErr }, { data: rows, error: admErr }] = await Promise.all([
        supabase.from('instances').select('admin_scope').eq('id', instanceId).single(),
        supabase
          .from('admin_boundaries')
          .select('admin_pcode,name,ST_AsGeoJSON(geom)::json geom')
          .eq('admin_level', 'ADM1'),
      ]);

      if (instErr) console.error(instErr);
      if (admErr) console.error(admErr);

      const startSel = new Set<string>(inst?.admin_scope ?? []);
      setSelected(startSel);

      const feats: GeoJSONType.Feature[] =
        (rows ?? []).map((r: AdmRow) => ({
          type: 'Feature',
          geometry: r.geom,
          properties: { admin_pcode: r.admin_pcode, name: r.name },
        })) ?? [];

      setFeatures(feats);
      setLoading(false);
      // Fit map to PH roughly after first render; bounds handled below
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  // ---- Derived feature collection
  const fc: GeoJSONType.FeatureCollection = useMemo(
    () => ({ type: 'FeatureCollection', features }),
    [features]
  );

  // ---- Toggle selection on polygon click
  const toggleFeature = (pcode: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(pcode)) n.delete(pcode);
      else n.add(pcode);
      return n;
    });
  };

  // ---- Style helpers
  const baseStyle = {
    weight: 1,
    color: '#374151',
    fillOpacity: 0.12,
  };

  const styleFn = (f?: GeoJSONType.Feature) => {
    const p = (f?.properties as any) || {};
    const isSel = selected.has(p.admin_pcode);
    return {
      ...baseStyle,
      color: isSel ? '#2e7d32' : '#94a3b8', // green when selected
      fillColor: isSel ? '#2e7d32' : '#64748b',
      fillOpacity: isSel ? 0.22 : 0.08,
      weight: isSel ? 2 : 1,
    };
  };

  const onEach = (feature: any, layer: L.Layer) => {
    const p = feature?.properties || {};
    layer.on('click', () => toggleFeature(p.admin_pcode));
    layer.bindTooltip(`${p.name} (${p.admin_pcode})`, { sticky: true });
  };

  // Refresh styles when selection changes
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setStyle(styleFn as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // ---- Save to DB
  const handleSave = async () => {
    setSaving(true);
    const arr = Array.from(selected);
    const { error } = await supabase
      .from('instances')
      .update({ admin_scope: arr })
      .eq('id', instanceId);
    setSaving(false);
    if (error) {
      console.error(error);
      alert('Save failed. See console for details.');
      return;
    }
    await onSaved();
    onClose();
  };

  // ---- Fit bounds
  const bounds = useMemo(() => {
    // If you have no features yet, use a sensible PH view
    if (!features.length) return L.latLngBounds(L.latLng(4.3, 116.8), L.latLng(21.3, 126.6));
    const b = L.latLngBounds();
    features.forEach((f: any) => {
      const g = L.geoJSON(f.geometry);
      b.extend(g.getBounds());
    });
    return b.pad(0.05);
  }, [features]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[min(1200px,95vw)] max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b text-sm font-medium text-gray-700">
          Define Affected Area (ADM1)
          <span className="ml-2 text-gray-400">· {selected.size} selected</span>
        </div>

        <div className="p-3 grid grid-cols-12 gap-3 overflow-hidden">
          <div className="col-span-8 min-h-[520px]">
            <div className="h-[520px] rounded-md overflow-hidden border">
              {!loading && (
                <MapContainer
                  bounds={bounds}
                  scrollWheelZoom={false}
                  className="h-full w-full leaflet-in-modal"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <GeoJSON
                    data={fc as any}
                    style={styleFn as any}
                    onEachFeature={onEach}
                    ref={(r) => (layerRef.current = (r as any)?._layer as LeafletGeoJSON)}
                  />
                </MapContainer>
              )}
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              Tip: click provinces to (de)select. Selections are stored in <code>instances.admin_scope</code>.
            </p>
          </div>

          <div className="col-span-4">
            <div className="h-[520px] rounded-md border p-3 overflow-auto text-sm">
              <div className="font-medium mb-2">Selected provinces</div>
              {selected.size === 0 && <div className="text-gray-400">Nothing selected.</div>}
              {selected.size > 0 && (
                <ul className="space-y-1">
                  {Array.from(selected)
                    .sort()
                    .map((code) => {
                      const nm =
                        (features.find(
                          (f) => (f.properties as any)?.admin_pcode === code
                        )?.properties as any)?.name ?? '';
                      return (
                        <li
                          key={code}
                          className="flex items-center justify-between border rounded px-2 py-1"
                        >
                          <span className="truncate">{nm}</span>
                          <button
                            onClick={() => toggleFeature(code)}
                            className="text-xs text-red-600 hover:underline ml-2"
                          >
                            remove
                          </button>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="px-3 py-3 border-t flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 text-sm rounded bg-[var(--gsc-blue,#004b87)] text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Ensure Leaflet never floats above the modal */}
      <style jsx global>{`
        .leaflet-in-modal {
          z-index: 0 !important;
        }
        .leaflet-pane,
        .leaflet-top,
        .leaflet-bottom {
          z-index: 0 !important;
        }
      `}</style>
    </div>
  );
}
