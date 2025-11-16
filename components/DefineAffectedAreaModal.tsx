'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import 'leaflet/dist/leaflet.css';
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

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
  const [adm3Geo, setAdm3Geo] = useState<FeatureCollection<Geometry, GeoJsonProperties> | null>(null);
  const [selectedADM1, setSelectedADM1] = useState<string[]>([]);
  const [selectedADM2, setSelectedADM2] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<any>(null);

  // --- Load all levels
  useEffect(() => {
    if (!open) return;
    const loadData = async () => {
      setLoading(true);

      // ADM1
      const { data: adm1 } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name')
        .eq('admin_level', 'ADM1')
        .order('name');
      setAdm1List(adm1 || []);

      // ADM2
      const { data: adm2 } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, parent_pcode')
        .eq('admin_level', 'ADM2')
        .order('name');
      setAdm2List(adm2 || []);

      // ADM3
      const { data: adm3, error: adm3Err } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, parent_pcode, geom')
        .eq('admin_level', 'ADM3');
      if (adm3Err) console.error('ADM3 load error:', adm3Err);

      const features = (adm3 || []).map((row: any) => ({
        type: 'Feature',
        geometry: row.geom,
        properties: {
          admin_pcode: row.admin_pcode,
          name: row.name,
          parent_pcode: row.parent_pcode,
        },
      }));

      setAdm3Geo({
        type: 'FeatureCollection',
        features,
      } as FeatureCollection<Geometry, GeoJsonProperties>);

      setLoading(false);
    };
    loadData();
  }, [open]);

  // --- Toggle selections
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

  // --- Filter ADM3 polygons based on selections
  const filteredADM3: FeatureCollection<Geometry, GeoJsonProperties> | null = useMemo(() => {
    if (!adm3Geo) return null;
    const adm2Parents = selectedADM2.length
      ? selectedADM2
      : adm2List
          .filter(a => selectedADM1.includes(a.parent_pcode))
          .map(a => a.admin_pcode);

    const filtered = adm3Geo.features.filter((f: any) =>
      adm2Parents.includes(f.properties.parent_pcode)
    );

    return {
      type: 'FeatureCollection',
      features: filtered,
    } as FeatureCollection<Geometry, GeoJsonProperties>;
  }, [adm3Geo, adm2List, selectedADM1, selectedADM2]);

  // --- Auto-zoom when selection changes
  useEffect(() => {
    if (!filteredADM3 || !mapRef.current) return;
    const L = (window as any).L;
    const group = L.geoJSON(filteredADM3);
    const bounds = group.getBounds();
    if (bounds.isValid()) mapRef.current.fitBounds(bounds);
  }, [filteredADM3]);

  // --- Save selection
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

  const getColor = (feature: any) => {
    const parent = feature.properties.parent_pcode;
    return selectedADM2.includes(parent)
      ? '#2563eb'
      : adm2List.some(a => selectedADM1.includes(a.parent_pcode) && a.admin_pcode === parent)
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
            {/* ADM1 Selection */}
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

            {/* ADM2 Refinement */}
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

            {/* Map */}
            <div className="border rounded-md overflow-hidden h-[400px]">
              {filteredADM3 && (
                <MapContainer
                  ref={mapRef}
                  center={[12.8797, 121.774]}
                  zoom={6}
                  scrollWheelZoom
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <GeoJSON data={filteredADM3} style={style} />
                </MapContainer>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex justify-end items-center pt-2 gap-2">
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
