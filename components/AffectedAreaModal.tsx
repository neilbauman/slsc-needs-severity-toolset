'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';

/* lazy leaflet loading */
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer     = dynamic(() => import('react-leaflet').then(m => m.TileLayer),     { ssr: false });
const GeoJSON       = dynamic(() => import('react-leaflet').then(m => m.GeoJSON),       { ssr: false });

type Instance = {
  id: string;
  name: string;
  admin_scope: string[] | null;
};

type AdmRow = { admin_pcode: string; name: string; geom: any };

type Props = {
  instance: Instance;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export default function AffectedAreaModal({ instance, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<AdmRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(instance.admin_scope ?? []));
  const [loading, setLoading] = useState(true);
  const geoRef = useRef<any>(null);

  /** Load ADM1 features */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc('get_admin_boundaries_geojson', { in_level: 'ADM1' });
      if (mounted && data) setRows(data as AdmRow[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  /** Build GeoJSON feature collection */
  const features = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: rows.map(r => ({
        type: 'Feature',
        geometry: r.geom,
        properties: {
          name: r.name,
          admin_pcode: r.admin_pcode,
          selected: selected.has(r.admin_pcode),
        },
      })),
    } as any;
  }, [rows, selected]);

  /** Fit to bounds */
  useEffect(() => {
    try {
      if (geoRef.current && (features.features?.length ?? 0) > 0) {
        const layer = geoRef.current;
        const b = layer.getBounds?.();
        if (b && b.isValid()) {
          const map = (layer as any)?._map ?? null;
          if (map && map.fitBounds) map.fitBounds(b.pad(0.05));
        }
      }
    } catch {}
  }, [features]);

  /** Toggle region selection */
  const toggle = (code: string) => {
    const next = new Set(selected);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelected(next);
  };

  /** Save to instances table */
  const handleSave = async () => {
    await supabase.from('instances')
      .update({ admin_scope: Array.from(selected) })
      .eq('id', instance.id);
    await onSaved();
    onClose();
  };

  const styleFn = (f: any) => {
    const isSelected = f.properties.selected;
    return {
      color: isSelected ? '#2e7d32' : '#999',
      weight: isSelected ? 2 : 1,
      fillColor: isSelected ? '#2e7d32' : '#ccc',
      fillOpacity: isSelected ? 0.35 : 0.1,
    };
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40">
      <div className="w-[1000px] max-h-[90vh] overflow-hidden rounded-lg border bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-[var(--gsc-beige,#f5f2ee)]">
          <div className="text-sm font-semibold text-[var(--gsc-blue,#004b87)]">
            Define Affected Area — {instance.name}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">{selected.size} selected</span>
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
        <div className="grid grid-cols-12">
          {/* Region list */}
          <div className="col-span-4 border-r overflow-y-auto" style={{ maxHeight: '78vh' }}>
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Loading regions…</div>
            ) : (
              <div className="p-2 space-y-1">
                {rows.map(r => (
                  <label
                    key={r.admin_pcode}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(r.admin_pcode)}
                      onChange={() => toggle(r.admin_pcode)}
                    />
                    <span className="text-sm">
                      {r.name}{' '}
                      <span className="text-gray-400 text-xs">{r.admin_pcode}</span>
                    </span>
                  </label>
                ))}
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
                <GeoJSON ref={geoRef as any} data={features as any} style={styleFn} />
              </MapContainer>
            </div>
            <div className="px-3 py-2 text-[11px] text-gray-500 border-t">
              Click regions (ADM1) to include/exclude. Selected areas are shown in green.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
