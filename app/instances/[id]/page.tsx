'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import * as L from 'leaflet';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });
import 'leaflet/dist/leaflet.css';

interface Instance {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  admin_scope: string[] | null;
  active: boolean | null;
  type: string | null;
}

export default function InstancePage() {
  const { id } = useParams();
  const supabase = createClient();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [adm3Geojson, setAdm3Geojson] = useState<any>(null);
  const [affectedNames, setAffectedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // Load instance and its geographic scope
  const loadInstance = useCallback(async () => {
    setLoading(true);

    const { data: inst, error } = await supabase
      .from('instances')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      console.error('Instance load error:', error);
      setLoading(false);
      return;
    }
    setInstance(inst);

    const { data: allAdm3, error: admErr } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name, parent_pcode, admin_level, geom')
      .eq('admin_level', 'ADM3');
    if (admErr) {
      console.error('ADM3 load error:', admErr);
      setLoading(false);
      return;
    }

    const scope = inst?.admin_scope ?? [];
    const adm1Codes = scope.filter((p) => p.length === 4); // e.g. "PH07"
    const adm2Codes = scope.filter((p) => p.length === 6); // e.g. "PH0702"

    // Filter ADM3s precisely by selected ADM2s or ADM1s
    const filtered = (allAdm3 || []).filter((r: any) => {
      if (adm2Codes.length && adm2Codes.includes(r.parent_pcode)) return true;
      if (adm1Codes.length && adm1Codes.includes(r.admin_pcode?.substring(0, 4))) return true;
      return false;
    });

    const features = filtered
      .map((r: any) => {
        let geometry = null;
        if (typeof r.geom === 'string') {
          try {
            geometry = JSON.parse(r.geom);
          } catch {
            console.warn('Invalid geometry JSON for', r.admin_pcode);
          }
        } else if (typeof r.geom === 'object') {
          geometry = r.geom;
        }
        if (!geometry) return null;
        return {
          type: 'Feature',
          geometry,
          properties: {
            admin_pcode: r.admin_pcode,
            name: r.name,
            parent_pcode: r.parent_pcode,
          },
        };
      })
      .filter(Boolean);

    setAdm3Geojson({ type: 'FeatureCollection', features });

    // Load readable names for display
    if (scope.length) {
      const { data: names } = await supabase
        .from('admin_boundaries')
        .select('name')
        .in('admin_pcode', scope);
      setAffectedNames(names?.map((d) => d.name) ?? []);
    }

    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  // Fit map to loaded bounds
  useEffect(() => {
    if (!mapRef.current || !adm3Geojson?.features?.length) return;
    const geoLayer = L.geoJSON(adm3Geojson);
    mapRef.current.fitBounds(geoLayer.getBounds());
  }, [adm3Geojson, mapReady]);

  // Style logic — deselected ADM2 children appear lighter
  const style = (feature: any) => {
    const parent = feature.properties?.parent_pcode;
    const scope = instance?.admin_scope ?? [];
    const isActive =
      scope.includes(parent) ||
      scope.includes(feature.properties?.admin_pcode?.substring(0, 4));
    return {
      color: '#555',
      weight: 0.6,
      fillColor: isActive ? '#8bb7f0' : '#e0e0e0',
      fillOpacity: isActive ? 0.6 : 0.25,
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    layer.bindTooltip(feature.properties?.name ?? feature.properties?.admin_pcode, {
      sticky: true,
    });
  };

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
          {instance?.name ?? 'Instance'}
        </h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Configure Datasets
          </button>
          <button className="px-3 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700">
            Define Affected Area
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        Created at:{' '}
        {instance?.created_at
          ? new Date(instance.created_at).toLocaleString()
          : 'Unknown'}
      </div>

      {affectedNames.length > 0 && (
        <div className="bg-white border rounded-md p-3 mb-4 shadow-sm">
          <div className="text-sm text-gray-700">
            🗺️ <strong>Affected Area:</strong> {affectedNames.join(' → ')}{' '}
            (Target Level: <strong>ADM3</strong>)
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9">
          <div className="h-[600px] w-full border rounded shadow overflow-hidden relative">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading map…
              </div>
            ) : adm3Geojson?.features?.length > 0 ? (
              <MapContainer
                ref={(m) => {
                  mapRef.current = m;
                  setMapReady(!!m);
                }}
                center={[12.8797, 121.774]}
                zoom={6}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <GeoJSON data={adm3Geojson} style={style} onEachFeature={onEachFeature} />
              </MapContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No geometry data found for this affected area.
              </div>
            )}
          </div>
        </div>

        <div className="col-span-3 bg-white border rounded-lg shadow-sm p-3">
          <div className="text-sm font-semibold mb-2 text-gray-700">Top Locations</div>
          <p className="text-xs text-gray-500">No data yet</p>
        </div>
      </div>
    </div>
  );
}
