'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });

export default function AffectedAreaModal({ instanceId, onClose, onSaved }: {
  instanceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [geojson, setGeojson] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadAdm1 = async () => {
      const { data, error } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, geom')
        .eq('admin_level', 1);
      if (!error && data) {
        setGeojson({
          type: 'FeatureCollection',
          features: data.map((d: any) => ({
            type: 'Feature',
            geometry: d.geom,
            properties: { admin_pcode: d.admin_pcode, name: d.name }
          }))
        });
      }
    };
    loadAdm1();
  }, []);

  const toggleSelect = (code: string) => {
    setSelected(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const saveScope = async () => {
    setSaving(true);
    await supabase
      .from('instances')
      .update({ admin_scope: selected })
      .eq('id', instanceId);
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white rounded-lg shadow-xl p-4 w-[900px] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-3">Define Affected Area (ADM1)</h2>
        <div className="flex gap-4">
          <div className="w-2/3 h-[500px]">
            {geojson && (
              <MapContainer center={[12.8797, 121.774]} zoom={5} className="h-full w-full">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <GeoJSON
                  data={geojson}
                  style={(f) => ({
                    color: selected.includes(f.properties.admin_pcode) ? '#2e7d32' : '#999',
                    weight: 1,
                    fillOpacity: selected.includes(f.properties.admin_pcode) ? 0.5 : 0.1,
                    fillColor: selected.includes(f.properties.admin_pcode) ? '#2e7d32' : '#e5e7eb'
                  })}
                  onEachFeature={(feature, layer) => {
                    layer.on({
                      click: () => toggleSelect(feature.properties.admin_pcode)
                    });
                    layer.bindPopup(feature.properties.name);
                  }}
                />
              </MapContainer>
            )}
          </div>
          <div className="w-1/3 overflow-y-auto border rounded p-2 text-sm h-[500px]">
            <p className="font-medium mb-1">Select provinces:</p>
            {geojson && geojson.features.map((f: any) => (
              <label key={f.properties.admin_pcode} className="block">
                <input
                  type="checkbox"
                  checked={selected.includes(f.properties.admin_pcode)}
                  onChange={() => toggleSelect(f.properties.admin_pcode)}
                  className="mr-2"
                />
                {f.properties.name}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end mt-4 gap-2">
          <button onClick={onClose} className="px-4 py-1 border rounded">Cancel</button>
          <button
            disabled={saving}
            onClick={saveScope}
            className="px-4 py-1 bg-gsc-blue text-white rounded"
          >
            {saving ? 'Saving...' : 'Save Area'}
          </button>
        </div>
      </div>
    </div>
  );
}
