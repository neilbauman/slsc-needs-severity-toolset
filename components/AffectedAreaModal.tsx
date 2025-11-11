'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createClient } from '@/lib/supabaseClient';

type AdmRow = { admin_pcode: string; name: string; geom: Geometry };

function FitBoundsOnLoad({ geoRef, deps = [] }: { geoRef: React.RefObject<L.GeoJSON | null>; deps?: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (geoRef.current) {
      try {
        const b = geoRef.current.getBounds();
        if (b.isValid()) map.fitBounds(b.pad(0.05));
      } catch {}
    }
  }, [map, geoRef, ...(deps ?? [])]);
  return null;
}

export default function AffectedAreaModal({
  instanceId,
  initialScope,
  onClose,
  onSaved,
}: {
  instanceId: string;
  initialScope?: string[] | null;
  onClose: () => void;
  onSaved: (updatedScope: string[]) => Promise<void>;
}) {
  const supabase = createClient();

  // Global state
  const [activeTab, setActiveTab] = useState<'ADM1' | 'ADM2'>('ADM1');
  const [adm1Rows, setAdm1Rows] = useState<AdmRow[]>([]);
  const [adm2Rows, setAdm2Rows] = useState<AdmRow[]>([]);
  const [selectedAdm1, setSelectedAdm1] = useState<Set<string>>(new Set());
  const [selectedAdm2, setSelectedAdm2] = useState<Set<string>>(new Set(initialScope ?? []));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const geoRef = useRef<L.GeoJSON | null>(null);

  // Fetch function (ADM1 or ADM2)
  const fetchData = async (level: 'ADM1' | 'ADM2', filter?: string[]) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_admin_boundaries_geojson', {
      in_admin_level: level,
      in_search: search || null,
    });
    if (error) {
      console.error(error.message);
      setLoading(false);
      return [];
    }
    let rows = (data ?? []).map((r: any) => ({
      admin_pcode: r.admin_pcode,
      name: r.name,
      geom: r.geom as Geometry,
    }));
    // Filter ADM2 by selected ADM1 prefix
    if (level === 'ADM2' && filter && filter.length > 0) {
      rows = rows.filter((r) => filter.some((f) => r.admin_pcode.startsWith(f)));
    }
    setLoading(false);
    return rows;
  };

  // Load ADM1 at start
  useEffect(() => {
    fetchData('ADM1').then(setAdm1Rows);
  }, []);

  // Load ADM2 when entering ADM2 tab
  useEffect(() => {
    if (activeTab === 'ADM2') {
      fetchData('ADM2', Array.from(selectedAdm1)).then(setAdm2Rows);
    }
  }, [activeTab, selectedAdm1]);

  // Selection helpers
  const toggleAdm1 = (p: string) =>
    setSelectedAdm1((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  const toggleAdm2 = (p: string) =>
    setSelectedAdm2((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  // Build map features
  const currentRows = activeTab === 'ADM1' ? adm1Rows : adm2Rows;
  const fc: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: currentRows.map(
        (r) =>
          ({
            type: 'Feature',
            geometry: r.geom,
            properties: { admin_pcode: r.admin_pcode, name: r.name },
          }) as Feature
      ),
    }),
    [currentRows]
  );

  const style = (f: any) => {
    const code = f.properties?.admin_pcode;
    const sel =
      activeTab === 'ADM1'
        ? selectedAdm1.has(code)
        : selectedAdm2.has(code);
    return {
      color: sel ? '#2e7d32' : '#888',
      weight: 1.2,
      fillColor: sel ? '#81c784' : '#ccc',
      fillOpacity: sel ? 0.6 : 0.2,
    };
  };

  const onEach = (f: any, l: L.Layer) => {
    const code = f.properties?.admin_pcode;
    if (!code) return;
    l.on({
      click: () =>
        activeTab === 'ADM1' ? toggleAdm1(code) : toggleAdm2(code),
    });
    l.bindTooltip(f.properties?.name || code);
  };

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return currentRows;
    return currentRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.admin_pcode.toLowerCase().includes(q)
    );
  }, [search, currentRows]);

  const handleSave = async () => {
    setSaving(true);
    const scope = Array.from(selectedAdm2);
    const { error } = await supabase
      .from('instances')
      .update({ admin_scope: scope })
      .eq('id', instanceId);
    setSaving(false);
    if (error) return alert(error.message);
    await onSaved(scope);
    onClose();
  };

  const selectedCount =
    activeTab === 'ADM1' ? selectedAdm1.size : selectedAdm2.size;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[1100px] max-w-[95vw] max-h-[90vh] flex flex-col border">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b bg-[var(--gsc-beige,#f5f2ee)]">
          <h2 className="font-semibold text-[var(--gsc-gray,#374151)] text-sm">
            Configure Affected Area
          </h2>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b text-sm">
          {[
            { key: 'ADM1', label: 'Regions (ADM1)' },
            { key: 'ADM2', label: 'Provinces (ADM2)' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-2 ${
                activeTab === tab.key
                  ? 'bg-[var(--gsc-blue,#004b87)] text-white'
                  : 'bg-[var(--gsc-beige,#f5f2ee)] text-[var(--gsc-gray,#374151)] hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-2 overflow-hidden">
          {/* Map */}
          <div className="relative h-[600px]">
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution="© OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {!loading && currentRows.length > 0 && (
                <GeoJSON
                  ref={geoRef as any}
                  data={fc as any}
                  style={style}
                  onEachFeature={onEach}
                />
              )}
              <FitBoundsOnLoad geoRef={geoRef} deps={[currentRows.length]} />
            </MapContainer>
          </div>

          {/* List */}
          <div className="border-l flex flex-col">
            <div className="p-3 flex items-center gap-2 border-b">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-2 rounded border text-sm"
              />
              <span className="text-xs text-gray-600">
                {selectedCount} / {currentRows.length}
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="p-6 text-sm text-gray-500">Loading…</div>
              ) : (
                <ul className="divide-y">
                  {filteredRows.map((r) => {
                    const on =
                      activeTab === 'ADM1'
                        ? selectedAdm1.has(r.admin_pcode)
                        : selectedAdm2.has(r.admin_pcode);
                    return (
                      <li
                        key={r.admin_pcode}
                        onClick={() =>
                          activeTab === 'ADM1'
                            ? toggleAdm1(r.admin_pcode)
                            : toggleAdm2(r.admin_pcode)
                        }
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer ${
                          on ? 'bg-green-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-sm font-medium">{r.name}</span>
                        <span
                          className={`text-xs ${
                            on ? 'text-green-700' : 'text-gray-500'
                          }`}
                        >
                          {r.admin_pcode}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <div className="text-xs text-gray-600">
            {activeTab === 'ADM1'
              ? 'Select one or more Regions. Then switch to Provinces to refine.'
              : 'Refine provinces within selected regions. These will be saved as the affected area.'}
          </div>
          <div className="flex gap-2">
            {activeTab === 'ADM2' && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-2 rounded text-white text-sm"
                style={{ background: 'var(--gsc-blue,#004b87)' }}
              >
                {saving ? 'Saving…' : 'Save Affected Area'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
