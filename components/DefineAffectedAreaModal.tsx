'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import 'leaflet/dist/leaflet.css';

// --- dynamic imports for react-leaflet (to avoid SSR issues)
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });

interface Props {
  instance: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function DefineAffectedAreaModal({ instance, open, onClose, onSaved }: Props) {
  const targetLevel = instance?.target_admin_level || 'ADM3';
  const [adm1List, setAdm1List] = useState<any[]>([]);
  const [adm2List, setAdm2List] = useState<any[]>([]);
  const [adm3List, setAdm3List] = useState<any[]>([]);
  const [selectedADM1, setSelectedADM1] = useState<string[]>([]);
  const [selectedADM2, setSelectedADM2] = useState<string[]>([]);
  const [selectedADM3, setSelectedADM3] = useState<string[]>([]);
  const [geojson, setGeojson] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<any>(null);

  // --- Load ADM1 on open
  useEffect(() => {
    if (!open) return;
    const loadADM1 = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_admin_boundaries_geojson', { level: 'ADM1' });
      if (error) console.error('ADM1 geojson error:', error);
      setGeojson(data);

      const { data: list, error: listErr } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name')
        .eq('admin_level', 'ADM1')
        .order('name');
      if (listErr) console.error('ADM1 list error:', listErr);
      setAdm1List(list || []);
      setLoading(false);
    };
    loadADM1();
  }, [open]);

  // --- When ADM1 changes, load ADM2
  useEffect(() => {
    if (selectedADM1.length === 0) return;
    const loadADM2 = async () => {
      const { data, error } = await supabase.rpc('get_admin_boundaries_by_parent', {
        level: 'ADM2',
        parents: selectedADM1,
      });
      if (error) console.error('ADM2 load error:', error);
      if (data) setAdm2List(data.features.map((f: any) => f.properties));
    };
    loadADM2();
  }, [selectedADM1]);

  // --- When ADM2 changes, load ADM3 if needed
  useEffect(() => {
    if (targetLevel !== 'ADM3' || selectedADM2.length === 0) return;
    const loadADM3 = async () => {
      const { data, error } = await supabase.rpc('get_admin_boundaries_by_parent', {
        level: 'ADM3',
        parents: selectedADM2,
      });
      if (error) console.error('ADM3 load error:', error);
      if (data) setAdm3List(data.features.map((f: any) => f.properties));
    };
    loadADM3();
  }, [selectedADM2]);

  // --- selection toggle logic
  const toggle = (code: string, level: 'ADM1' | 'ADM2' | 'ADM3') => {
    const updater = (prev: string[]) =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code];
    if (level === 'ADM1') setSelectedADM1(updater);
    else if (level === 'ADM2') setSelectedADM2(updater);
    else setSelectedADM3(updater);
  };

  // --- get selected subset of GeoJSON
  const getSelectedGeojson = () => {
    if (!geojson) return null;
    const selectedCodes =
      targetLevel === 'ADM1' ? selectedADM1 :
      targetLevel === 'ADM2' ? selectedADM2 :
      selectedADM3;
    const selected = geojson.features.filter((f: any) =>
      selectedCodes.includes(f.properties.admin_pcode)
    );
    return { type: 'FeatureCollection', features: selected };
  };

  // --- zoom to selected using pure Leaflet
  const fitToSelection = () => {
    const gj = getSelectedGeojson();
    if (!gj || !mapRef.current) return;
    const L = (window as any).L;
    const layerGroup = L.geoJSON(gj);
    const bounds = layerGroup.getBounds();
    if (bounds.isValid()) mapRef.current.fitBounds(bounds);
  };

  // --- save admin_scope to instances
  const handleSave = async () => {
    const finalScope =
      targetLevel === 'ADM1' ? selectedADM1 :
      targetLevel === 'ADM2' ? selectedADM2 :
      selectedADM3;

    const { error } = await supabase
      .from('instances')
      .update({ admin_scope: finalScope })
      .eq('id', instance.id);

    if (error) {
      console.error('Save error:', error);
      alert('Error saving affected area: ' + error.message);
      return;
    }
    await onSaved();
    onClose();
  };

  if (!open) return null;

  // --- map style and events
  const getColor = (code: string) =>
    selectedADM1.includes(code) || selectedADM2.includes(code) || selectedADM3.includes(code)
      ? '#2563eb'
      : '#cccccc';

  const style = (feature: any) => ({
    color: '#555',
    weight: 0.5,
    fillColor: getColor(feature.properties.admin_pcode),
    fillOpacity: 0.7,
  });

  const onEachFeature = (feature: any, layer: any) => {
    layer.bindTooltip(feature.properties.name, { sticky: true });
    layer.on({
      click: () => toggle(feature.properties.admin_pcode, 'ADM1'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl p-6 flex flex-col space-y-4">
        <h2 className="text-lg font-semibold">Define Affected Area</h2>

        {loading ? (
          <div className="text-sm text-gray-500">Loading boundaries…</div>
        ) : (
          <>
            {/* --- ADM1 --- */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Step 1: Select ADM1 Regions</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 overflow-y-auto max-h-32">
                {adm1List.map(a => (
                  <label key={a.admin_pcode} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedADM1.includes(a.admin_pcode)}
                      onChange={() => toggle(a.admin_pcode, 'ADM1')}
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>

            {/* --- ADM2 refinement --- */}
            {selectedADM1.length > 0 && adm2List.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Step 2: Refine by ADM2</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 overflow-y-auto max-h-32">
                  {adm2List.map(a => (
                    <label key={a.admin_pcode} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedADM2.includes(a.admin_pcode)}
                        onChange={() => toggle(a.admin_pcode, 'ADM2')}
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* --- ADM3 refinement --- */}
            {targetLevel === 'ADM3' && selectedADM2.length > 0 && adm3List.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Step 3: Refine by ADM3</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 overflow-y-auto max-h-32">
                  {adm3List.map(a => (
                    <label key={a.admin_pcode} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedADM3.includes(a.admin_pcode)}
                        onChange={() => toggle(a.admin_pcode, 'ADM3')}
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* --- map --- */}
            <div className="border rounded-md overflow-hidden h-[400px]">
              {geojson && (
                <MapContainer
                  ref={mapRef}
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

        {/* --- footer --- */}
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={fitToSelection}
            className="px-3 py-1.5 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Zoom to Selection
          </button>
          <div className="flex gap-2">
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
    </div>
  );
}
