'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import 'leaflet/dist/leaflet.css';

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
  const [adm1List, setAdm1List] = useState<any[]>([]);
  const [adm2List, setAdm2List] = useState<any[]>([]);
  const [adm3Geo, setAdm3Geo] = useState<any | null>(null);
  const [selectedADM1, setSelectedADM1] = useState<string[]>([]);
  const [selectedADM2, setSelectedADM2] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<any>(null);

  const targetLevel = instance?.target_admin_level || 'ADM3';

  // --- Load ADM1 & ADM2 lists
  useEffect(() => {
    if (!open) return;
    const loadLists = async () => {
      setLoading(true);

      const { data: adm1, error: adm1Err } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name')
        .eq('admin_level', 'ADM1')
        .order('name');
      if (adm1Err) console.error('ADM1 load error:', adm1Err);
      setAdm1List(adm1 || []);

      const { data: adm2, error: adm2Err } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, parent_pcode')
        .eq('admin_level', 'ADM2')
        .order('name');
      if (adm2Err) console.error('ADM2 load error:', adm2Err);
      setAdm2List(adm2 || []);

      // Load ADM3 geometries (for map rendering)
      const { data: geo, error: geoErr } = await supabase
        .rpc('get_admin_boundaries_geojson', { level: 'ADM3' });
      if (geoErr) console.error('ADM3 geojson error:', geoErr);
      setAdm3Geo(geo);

      setLoading(false);
    };
    loadLists();
  }, [open]);

  // --- Selection logic
  const toggleADM1 = (code: string) => {
    setSelectedADM1(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleADM2 = (code: string) => {
    setSelectedADM2(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // --- Filter ADM3 polygons for rendering
  const getFilteredADM3 = () => {
    if (!adm3Geo) return null;
    const adm2Parents = selectedADM2.length
      ? selectedADM2
      : adm2List
          .filter(a => selectedADM1.includes(a.parent_pcode))
          .map(a => a.admin_pcode);

    const filtered = adm3Geo.features.filter((f: any) =>
      adm2Parents.includes(f.properties.parent_pcode)
    );
    return { type: 'FeatureCollection', features: filtered };
  };

  // --- Zoom to selected area
  const fitToSelection = () => {
    const gj = getFilteredADM3();
    if (!gj || !mapRef.current) return;
    const L = (window as any).L;
    const layerGroup = L.geoJSON(gj);
    const bounds = layerGroup.getBounds();
    if (bounds.isValid()) mapRef.current.fitBounds(bounds);
  };

  // --- Save affected area (store ADM1 + ADM2 codes)
  const handleSave = async () => {
    const finalScope = [...selectedADM1, ...selectedADM2];
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

  // --- Map style
  const getColor = (feature: any) => {
    const parent = feature.properties.parent_pcode;
    return selectedADM2.includes(parent)
      ? '#2563eb'
      : selectedADM1.includes(feature.properties.parent_pcode.slice(0, 3))
      ? '#60a5fa'
      : '#ccc';
  };

  const style = (feature: any) => ({
    color: '#555',
    weight: 0.3,
    fillColor: getColor(feature),
    fillOpacity: 0.7,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl p-6 flex flex-col space-y-4">
        <h2 className="text-lg font-semibold">Define Affected Area</h2>

        {loading ? (
          <div className="text-sm text-gray-500">Loading administrative boundaries…</div>
        ) : (
          <>
            {/* ADM1 SELECTION */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Step 1: Select ADM1 Regions</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 overflow-y-auto max-h-32">
                {adm1List.map(a => (
                  <label key={a.admin_pcode} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedADM1.includes(a.admin_pcode)}
                      onChange={() => toggleADM1(a.admin_pcode)}
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>

            {/* ADM2 REFINEMENT */}
            {selectedADM1.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Step 2: Refine by ADM2</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 overflow-y-auto max-h-32">
                  {adm2List
                    .filter(a => selectedADM1.includes(a.parent_pcode))
                    .map(a => (
                      <label key={a.admin_pcode} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedADM2.includes(a.admin_pcode)}
                          onChange={() => toggleADM2(a.admin_pcode)}
                        />
                        {a.name}
                      </label>
                    ))}
                </div>
              </div>
            )}

            {/* MAP */}
            <div className="border rounded-md overflow-hidden h-[400px]">
              {adm3Geo && (
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
                  <GeoJSON data={getFilteredADM3()} style={style} />
                </MapContainer>
              )}
            </div>
          </>
        )}

        {/* FOOTER */}
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
