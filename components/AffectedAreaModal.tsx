'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer     = dynamic(() => import('react-leaflet').then(m => m.TileLayer),     { ssr: false });
const GeoJSON       = dynamic(() => import('react-leaflet').then(m => m.GeoJSON),       { ssr: false });

type Instance = {
  id: string;
  name: string;
  admin_scope: string[] | null;
};

type Adm1Row = { admin_pcode: string; name: string; geom: any };

type Props = {
  instance: Instance;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export default function AffectedAreaModal({ instance, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [adm1Rows, setAdm1Rows] = useState<Adm1Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(instance.admin_scope ?? []));
  const [loading, setLoading] = useState(true);
  const geoRef = useRef<any>(null);

  /** Load ADM1 list + geometries */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      // Basic metadata list (names + codes)
      const { data: rows } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name')
        .eq('admin_level', 'ADM1')
        .order('name', { ascending: true });

      // Geometries via RPC (ensures consistent geometry format)
      const { data: geomRows } = await supabase.rpc('get_admin_boundaries_geojson', { in_level: 'ADM1' });

      if (!mounted) return;

      // Combine metadata with geometry
      const map = new Map<string, any>();
      (geomRows ?? []).forEach((g: any) => map.set(g.admin_pcode, g.geom));

      const merged = (rows ?? []).map(r => ({
        admin_pcode: r.admin_pcode,
        name: r.name,
        geom: map.get(r.admin_pcode),
      }));

      setAdm1Rows(merged);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /** Build GeoJSON for display */
  const features = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: adm1Rows
        .filter(r => r.geom)
        .map(r => ({
          type: 'Feature',
          geometry: r.geom,
          properties: {
            name: r.name,
            admin_pcode: r.admin_pcode,
            selected: selected.has(r.admin_pcode),
          },
        })),
    } as any;
  }, [adm1Rows, selected]);

  /** Fit map to visible features */
  useEffect(() => {
    try {
      if (geoRef.current && (features.features?.length ?? 0) > 0) {
        const layer = geoRef.current;
        const bounds = layer.getBounds?.();
        if (bounds && bounds.isValid()) {
          const map = (layer as any)?._map ?? null;
          if (map && map.fitBounds) map.fitBounds(bounds.pad(0.05));
        }
      }
    } catch {}
  }, [features]);

  /** Toggle ADM1 selection */
  const toggle = (code: string) => {
    const next = new Set(selected);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelected(next);
  };

  /** Save */
  const handleSave = async () => {
    await supabase.from('instances')
      .update({ admin_scope: Array.from(selected) })
      .eq('id', instance.id);
    await onSaved();
    onClose();
  };

  const styleFn = (feature: any) => {
    const sel = feature?.properties?.selected;
    return {
      color: sel ? '#2e7d32' : '#999',
      weight: sel ? 2 : 1,
      fillColor: sel ? '#2e7d32' : '#ccc',
      fillOpacity: sel ? 0.35 : 0.1,
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
          {/* ADM1 list */}
          <div className="col-span-4 border-r overflow-y-auto" style={{ maxHeight: '78vh' }}>
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Loading regions…</div>
            ) : (
              <div className="p-2 space-y-1">
                {adm1Rows.map(r => (
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
