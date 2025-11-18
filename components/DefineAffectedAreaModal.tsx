'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function DefineAffectedAreaModal({ instance, onClose, onSaved }: Props) {
  const supabase = createClient();

  const [adm1Options, setAdm1Options] = useState<any[]>([]);
  const [adm2Options, setAdm2Options] = useState<any[]>([]);
  const [adm3GeoJSON, setAdm3GeoJSON] = useState<any>(null);

  const [selectedAdm1, setSelectedAdm1] = useState<string[]>([]);
  const [selectedAdm2, setSelectedAdm2] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAdm1();
  }, []);

  useEffect(() => {
    if (selectedAdm1.length > 0) loadAdm2();
    else setAdm2Options([]);
  }, [selectedAdm1]);

  useEffect(() => {
    if (selectedAdm2.length > 0) loadAdm3();
  }, [selectedAdm2]);

  const loadAdm1 = async () => {
    const { data, error } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name')
      .eq('admin_level', 'ADM1')
      .order('name');
    if (!error && data) setAdm1Options(data);
  };

  const loadAdm2 = async () => {
    const { data, error } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name, parent_pcode')
      .eq('admin_level', 'ADM2')
      .in('parent_pcode', selectedAdm1);
    if (!error && data) setAdm2Options(data);
  };

  const loadAdm3 = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_affected_adm3', {
      in_scope: selectedAdm2,
    });
    if (error) {
      console.error('ADM3 load error:', error);
      setLoading(false);
      return;
    }

    setAdm3GeoJSON({
      type: 'FeatureCollection',
      features: data.map((row: any) => ({
        type: 'Feature',
        properties: { name: row.name, admin_pcode: row.admin_pcode },
        geometry: row.geom,
      })),
    });
    setLoading(false);
  };

  const handleSave = async () => {
    const admin_scope = selectedAdm2;

    if (admin_scope.length === 0) {
      alert('Please select at least one ADM2 area before saving.');
      return;
    }

    const { error } = await supabase
      .from('instances')
      .update({ admin_scope })
      .eq('id', instance.id);

    if (error) {
      console.error('Failed to save affected area:', error);
      return;
    }

    await onSaved();
    onClose();
  };

  const style = {
    color: '#1d4ed8',
    weight: 1,
    fillColor: '#60a5fa',
    fillOpacity: 0.5,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-4xl p-4 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Define Affected Area</h2>

        {/* Step 1: ADM1 */}
        <div className="mb-4">
          <div className="font-medium mb-2">Step 1: Select ADM1 Region</div>
          <div className="grid grid-cols-3 gap-1 text-sm">
            {adm1Options.map((opt) => (
              <label key={opt.admin_pcode} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedAdm1.includes(opt.admin_pcode)}
                  disabled={adm2Options.length > 0}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedAdm1([...selectedAdm1, opt.admin_pcode]);
                    else
                      setSelectedAdm1(selectedAdm1.filter((x) => x !== opt.admin_pcode));
                  }}
                />
                {opt.name}
              </label>
            ))}
          </div>
        </div>

        {/* Step 2: ADM2 */}
        {adm2Options.length > 0 && (
          <div className="mb-4">
            <div className="font-medium mb-2">Step 2: Select ADM2 Areas</div>
            <div className="grid grid-cols-3 gap-1 text-sm max-h-64 overflow-y-auto">
              {adm2Options.map((opt) => (
                <label key={opt.admin_pcode} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedAdm2.includes(opt.admin_pcode)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedAdm2([...selectedAdm2, opt.admin_pcode]);
                      else
                        setSelectedAdm2(selectedAdm2.filter((x) => x !== opt.admin_pcode));
                    }}
                  />
                  {opt.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Map */}
        <div className="rounded overflow-hidden border" style={{ height: 400 }}>
          {loading ? (
            <div className="p-4 text-sm text-gray-500">Loading map...</div>
          ) : adm3GeoJSON ? (
            <MapContainer
              style={{ height: '100%', width: '100%' }}
              center={[10.3157, 123.8854]}
              zoom={8}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <GeoJSON data={adm3GeoJSON} style={() => style} />
            </MapContainer>
          ) : (
            <div className="p-4 text-sm text-gray-500">Select a region to begin.</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={onClose}>
            Cancel
          </button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={handleSave}>
            Save Affected Area
          </button>
        </div>
      </div>
    </div>
  );
}
