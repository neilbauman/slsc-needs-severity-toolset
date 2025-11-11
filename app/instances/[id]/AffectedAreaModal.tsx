'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false });
const GeoJSON      = dynamic(() => import('react-leaflet').then(m => m.GeoJSON),      { ssr: false });

type Props = {
  instanceId: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function AffectedAreaModal({ instanceId, onClose, onSaved }: Props) {
  const [admGeo, setAdmGeo] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const [{ data: inst }, { data: adm }] = await Promise.all([
        supabase.from('instances').select('admin_scope').eq('id', instanceId).single(),
        supabase.from('admin_boundaries').select('admin_pcode,name,geom').eq('admin_level', 1),
      ]);

      setSelected(new Set(inst?.admin_scope ?? []));
      setAdmGeo({
        type: 'FeatureCollection',
        features: (adm || []).map((d: any) => ({
          type: 'Feature',
          geometry: d.geom,
          properties: { admin_pcode: d.admin_pcode, name: d.name },
        })),
      });
    };
    load();
  }, [instanceId]);

  const toggle = (pcode: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(pcode) ? n.delete(pcode) : n.add(pcode);
      return n;
    });
  };

  const save = async () => {
    await supabase.from('instances').update({ admin_scope: Array.from(selected) }).eq('id', instanceId);
    onSaved();
    onClose();
  };

  const mapStyle = useMemo(
    () => ({
      chosen: { color: '#374151', weight: 1, fillColor: '#2e7d32', fillOpacity: 0.5 },
      unchosen: { color: '#bfbfbf', weight: 1, fillColor: '#f5f2ee', fillOpacity: 0.3 },
    }),
    []
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[5000]">
      <div className="bg-white rounded-lg shadow-xl w-[min(1000px,95vw)] max-h-[90vh] overflow-hidden z-[5001]">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold">Define Affected Area (ADM1)</h2>
          <div className="text-xs text-gray-500">{selected.size} selected</div>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-9">
              <div className="h-[60vh] rounded overflow-hidden">
                {admGeo && (
                  <MapContainer center={[12.8797, 121.774]} zoom={5} scrollWheelZoom={false} className="h-full w-full z-[0]">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <GeoJSON
                      data={admGeo}
                      style={(f) =>
                        (selected.has(f.properties.admin_pcode) ? mapStyle.chosen : mapStyle.unchosen) as any
                      }
                      onEachFeature={(feature, layer) => {
                        const p = feature.properties.admin_pcode;
                        layer.on('click', () => toggle(p));
                        layer.bindPopup(`<b>${feature.properties.name}</b><br/>${p}`);
                      }}
                    />
                  </MapContainer>
                )}
              </div>
            </div>

            <div className="col-span-3">
              <div className="text-xs text-gray-600 mb-2">Tip: click provinces on the map to (de)select.</div>
              <div className="h-[60vh] overflow-auto border rounded p-2 text-sm">
                {[...selected].sort().map((p) => (
                  <div key={p} className="flex justify-between items-center py-1 border-b">
                    <span>{p}</span>
                    <button className="text-red-600 text-xs" onClick={() => toggle(p)}>remove</button>
                  </div>
                ))}
                {!selected.size && <div className="text-gray-400 text-sm">Nothing selected.</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 border rounded text-sm">Cancel</button>
          <button onClick={save} className="px-3 py-1 rounded text-sm text-white" style={{ background: '#2e7d32' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
