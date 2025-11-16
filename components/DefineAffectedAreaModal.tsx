'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });
import 'leaflet/dist/leaflet.css';

interface Props {
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
  open: boolean;
}

export default function DefineAffectedAreaModal({ instance, onClose, onSaved, open }: Props) {
  const [adm1List, setAdm1List] = useState<any[]>([]);
  const [adm2List, setAdm2List] = useState<any[]>([]);
  const [selectedAdm1, setSelectedAdm1] = useState<string[]>([]);
  const [geojson, setGeojson] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const { data: adm1, error: e1 } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode,name,admin_level')
        .eq('admin_level', 'ADM1')
        .order('name');
      if (!e1 && adm1) setAdm1List(adm1);

      const { data: adm2, error: e2 } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode,name,parent_pcode,admin_level')
        .eq('admin_level', 'ADM2')
        .order('name');
      if (!e2 && adm2) setAdm2List(adm2);

      const { data: gj, error: gerr } = await supabase.rpc('get_admin_boundaries_geojson', { level: 'ADM1' });
      if (!gerr && gj) setGeojson(gj);
      setLoading(false);
    };
    load();
  }, [open]);

  const toggleAdm1 = (pcode: string) => {
    setSelectedAdm1(prev =>
      prev.includes(pcode) ? prev.filter(p => p !== pcode) : [...prev, pcode]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('instances')
      .update({ admin_scope: selectedAdm1 })
      .eq('id', instance.id);
    setLoading(false);
    if (error) return alert('Save failed: ' + error.message);
    await onSaved();
    onClose();
  };

  if (!open) return null;

  const getColor = (code: string) =>
    selectedAdm1.includes(code) ? '#2563eb' : '#cccccc';

  const style = (feature: any) => ({
    color: '#555',
    weight: 0.5,
    fillColor: getColor(feature.properties.admin_pcode),
    fillOpacity: 0.7,
  });

  const onEachFeature = (feature: any, layer: any) => {
    const props = feature.properties;
    layer.bindTooltip(`${props.name}`, { sticky: true });
    layer.on({
      click: () => toggleAdm1(props.admin_pcode),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-6 flex flex-col space-y-4">
        <h2 className="text-lg font-semibold">Define Affected Area</h2>

        {loading ? (
          <div className="text-sm text-gray-500">Loading boundaries…</div>
        ) : (
          <>
            <div className="text-sm font-semibold">Step 1: Select ADM1 Regions</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 overflow-y-auto max-h-40">
              {adm1List.map(a1 => (
                <label key={a1.admin_pcode} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedAdm1.includes(a1.admin_pcode)}
                    onChange={() => toggleAdm1(a1.admin_pcode)}
                  />
                  {a1.name}
                </label>
              ))}
            </div>

            <div className="border rounded-md overflow-hidden h-[400px]">
              {geojson && (
                <MapContainer
                  center={[12.8797, 121.774]}
                  zoom={6}
                  scrollWheelZoom={true}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <GeoJSON data={geojson} style={style} onEachFeature={onEachFeature} />
                </MapContainer>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {loading ? 'Saving…' : 'Save Affected Area'}
          </button>
        </div>
      </div>
    </div>
  );
}
