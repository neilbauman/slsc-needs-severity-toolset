'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';

// lazy-load Leaflet map bits
const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer as any),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer as any),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import('react-leaflet').then((m) => m.GeoJSON as any),
  { ssr: false }
);

type Props = {
  instance: any; // full row from instances
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

// simple classnames helper
function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}

export default function AffectedAreaModal({ instance, onClose, onSaved }: Props) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // data
  const [adm1Rows, setAdm1Rows] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(instance?.admin_scope ?? []));

  // map
  const [mapReady, setMapReady] = useState(false);
  const geoRef = useRef<any>(null);

  const allFeatures = useMemo(() => {
    // convert rows into Feature[]
    return adm1Rows.map((r) => ({
      type: 'Feature',
      geometry: r.geom,
      properties: {
        admin_pcode: r.admin_pcode,
        name: r.name,
      },
    }));
  }, [adm1Rows]);

  const selectedCollection = useMemo(() => {
    const s = selected;
    const feats = allFeatures.filter((f: any) => s.has(f.properties.admin_pcode));
    return { type: 'FeatureCollection', features: feats } as any;
  }, [allFeatures, selected]);

  // load ADM1 from RPC, initialize selection from instance.admin_scope
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_admin_boundaries_geojson', {
        in_level: 'ADM1',
      });
      if (!mounted) return;
      if (!error && Array.isArray(data)) {
        setAdm1Rows(data);
      } else {
        setAdm1Rows([]);
      }
      // initialize selection from instance.admin_scope
      setSelected(new Set(instance?.admin_scope ?? []));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance?.id]);

  // save handler
  const handleSave = async () => {
    setSaving(true);
    const scope = Array.from(selected);
    await supabase.from('instances').update({ admin_scope: scope }).eq('id', instance.id);
    setSaving(false);
    await onSaved();
  };

  // checkbox handlers
  const toggleOne = (p: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(p)) s.delete(p);
      else s.add(p);
      return s;
    });
  };
  const allChecked = useMemo(() => selected.size === adm1Rows.length && adm1Rows.length > 0, [selected, adm1Rows]);
  const someChecked = useMemo(
    () => selected.size > 0 && selected.size < adm1Rows.length,
    [selected, adm1Rows]
  );
  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === adm1Rows.length) return new Set();
      return new Set(adm1Rows.map((r) => r.admin_pcode));
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-[var(--gsc-beige,#f5f2ee)]">
          <div className="text-sm font-semibold text-[var(--gsc-blue,#004b87)]">
            Define Affected Area — ADM1
          </div>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-12 gap-0">
          {/* Map */}
          <div className="col-span-7 border-r">
            <div className="h-[460px]">
              <MapContainer
                center={[12.8797, 121.774]}
                zoom={5}
                scrollWheelZoom={false}
                className="h-full w-full"
                whenReady={() => setMapReady(true)}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* outline all ADM1 */}
                {mapReady && allFeatures.length > 0 && (
                  <GeoJSON
                    data={{ type: 'FeatureCollection', features: allFeatures } as any}
                    style={() => ({
                      color: '#888',
                      weight: 1,
                      opacity: 0.5,
                      fillOpacity: 0.0,
                    })}
                  />
                )}
                {/* highlight selected ADM1 */}
                {mapReady && selectedCollection.features?.length > 0 && (
                  <GeoJSON
                    data={selectedCollection}
                    style={() => ({
                      color: '#d35400', // outline
                      weight: 2,
                      opacity: 0.9,
                      fillColor: '#2e7d32', // fill
                      fillOpacity: 0.25,
                    })}
                  />
                )}
              </MapContainer>
            </div>
            <div className="px-4 py-2 text-xs text-gray-500">
              Tip: Use the checklist to include or exclude regions. Selected regions render in green.
            </div>
          </div>

          {/* Checklist */}
          <div className="col-span-5">
            <div className="p-3 flex items-center justify-between border-b">
              <div className="text-sm font-medium text-gray-700">
                Regions ({selected.size}/{adm1Rows.length})
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                />
                Select All
              </label>
            </div>
            <div className="p-3 h-[380px] overflow-auto">
              {loading && <div className="text-sm text-gray-500">Loading…</div>}
              {!loading && adm1Rows.length === 0 && (
                <div className="text-sm text-gray-500">No ADM1 rows found.</div>
              )}
              {!loading &&
                adm1Rows.map((r) => {
                  const checked = selected.has(r.admin_pcode);
                  return (
                    <label
                      key={r.admin_pcode}
                      className={cx(
                        'flex items-center justify-between text-sm border-b py-1.5 cursor-pointer',
                        checked ? 'bg-[var(--gsc-beige,#f5f2ee)]' : ''
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.name}</div>
                        <div className="text-xs text-gray-500">{r.admin_pcode}</div>
                      </div>
                      <input
                        type="checkbox"
                        className="ml-2"
                        checked={checked}
                        onChange={() => toggleOne(r.admin_pcode)}
                      />
                    </label>
                  );
                })}
            </div>

            <div className="p-3 border-t flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50"
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
        </div>
      </div>
    </div>
  );
}
