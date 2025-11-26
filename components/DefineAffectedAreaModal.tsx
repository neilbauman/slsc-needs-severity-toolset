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
  const [manuallyDeselected, setManuallyDeselected] = useState<Set<string>>(new Set());

  // --------------------------------------------------
  // Load ADM1 regions (top level)
  // --------------------------------------------------
  useEffect(() => {
    loadAdm1();
  }, []);

  const loadAdm1 = async () => {
    const { data, error } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name')
      .eq('admin_level', 'ADM1')
      .order('name');

    if (!error && data) setAdm1Options(data);
    else console.error('ADM1 load error:', error);
  };

  // --------------------------------------------------
  // When ADM1 selection changes → load its ADM2s
  // --------------------------------------------------
  useEffect(() => {
    if (selectedAdm1.length > 0) {
      loadAdm2();
    } else {
      setAdm2Options([]);
      setSelectedAdm2([]);
      setAdm3GeoJSON(null);
      setManuallyDeselected(new Set());
    }
  }, [selectedAdm1]);

  const loadAdm2 = async () => {
    const { data, error } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name, parent_pcode')
      .eq('admin_level', 'ADM2')
      .in('parent_pcode', selectedAdm1);

    if (!error && data) {
      setAdm2Options(data);

      setManuallyDeselected((prev) => {
        const next = new Set(prev);
        prev.forEach((code) => {
          if (!data.some((opt) => opt.admin_pcode === code)) {
            next.delete(code);
          }
        });
        return next;
      });

      setSelectedAdm2(() => {
        const next = new Set<string>();
        data.forEach((opt) => {
          if (!manuallyDeselected.has(opt.admin_pcode)) {
            next.add(opt.admin_pcode);
          }
        });
        return Array.from(next);
      });
    } else {
      console.error('ADM2 load error:', error);
    }
  };

  // --------------------------------------------------
  // Load ADM3 polygons for preview
  // --------------------------------------------------
  useEffect(() => {
    if (selectedAdm2.length > 0) {
      loadAdm3();
    } else {
      setAdm3GeoJSON(null);
    }
  }, [selectedAdm2]);

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

  // --------------------------------------------------
  // NEW: Preload saved scope (ADM2s) + infer ADM1s
  // --------------------------------------------------
  useEffect(() => {
    if (!instance?.admin_scope || instance.admin_scope.length === 0) return;

    const loadExisting = async () => {
      const { data, error } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, parent_pcode')
        .in('admin_pcode', instance.admin_scope);

      if (!error && data?.length) {
        const adm2s = data.map((d) => d.admin_pcode);
        const adm1s = [...new Set(data.map((d) => d.parent_pcode))];
        setSelectedAdm2(adm2s);
        setSelectedAdm1(adm1s);
      } else if (error) {
        console.error('Failed to preload affected area:', error);
      }
    };

    loadExisting();
  }, [instance]);

  // --------------------------------------------------
  // Save only ADM2 selections
  // --------------------------------------------------
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

  // --------------------------------------------------
  // Map style
  // --------------------------------------------------
  const style = {
    color: '#1d4ed8',
    weight: 1,
    fillColor: '#60a5fa',
    fillOpacity: 0.5,
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-4xl p-4 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Define Affected Area</h2>

        {/* Step 1: ADM1 selection */}
        <div className="mb-4">
          <div className="font-medium mb-2">Step 1: Select ADM1 Regions</div>
          <div className="grid grid-cols-3 gap-1 text-sm">
            {adm1Options.map((opt) => (
              <label key={opt.admin_pcode} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedAdm1.includes(opt.admin_pcode)}
                  onChange={(e) => {
                    setSelectedAdm1((prev) => {
                      if (e.target.checked) {
                        return [...prev, opt.admin_pcode];
                      }
                      return prev.filter((x) => x !== opt.admin_pcode);
                    });
                  }}
                />
                {opt.name}
              </label>
            ))}
          </div>
        </div>

        {/* Step 2: ADM2 refinement */}
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
                      if (e.target.checked) {
                        setSelectedAdm2((prev) => [...prev, opt.admin_pcode]);
                        setManuallyDeselected((prev) => {
                          const next = new Set(prev);
                          next.delete(opt.admin_pcode);
                          return next;
                        });
                      } else {
                        setSelectedAdm2((prev) => prev.filter((x) => x !== opt.admin_pcode));
                        setManuallyDeselected((prev) => {
                          const next = new Set(prev);
                          next.add(opt.admin_pcode);
                          return next;
                        });
                      }
                    }}
                  />
                  {opt.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Map preview */}
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
          <button
            className="px-3 py-1 border rounded hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={handleSave}
          >
            Save Affected Area
          </button>
        </div>
      </div>
    </div>
  );
}
