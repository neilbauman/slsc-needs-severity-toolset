'use client';

import { useEffect, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';
import InstanceCategoryConfigModal from '@/components/InstanceCategoryConfigModal';
import InstanceRecomputePanel from '@/components/InstanceRecomputePanel';

// Dynamically import Leaflet components (to prevent window errors)
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });
const useMap = dynamic(() => import('react-leaflet').then(m => m.useMap), { ssr: false });

// --- Types ---
interface Instance {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  admin_scope: string[] | null;
  type: string | null;
}

interface AdminBoundary {
  admin_pcode: string;
  name: string;
  admin_level: string;
  parent_pcode: string | null;
  geom: any;
}

// --- Helper for zooming map ---
function MapAutoZoom({ geojson }: { geojson: any }) {
  const map = useMap() as any;
  useEffect(() => {
    if (!geojson || !map) return;
    try {
      const L = require('leaflet');
      const layer = L.geoJSON(geojson);
      map.fitBounds(layer.getBounds());
    } catch (e) {
      console.warn('fitBounds failed:', e);
    }
  }, [geojson, map]);
  return null;
}

export default function InstanceDashboardPage() {
  const supabase = createClient();
  const { id } = useParams();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [boundaries, setBoundaries] = useState<AdminBoundary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // --- Load instance ---
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('instances')
        .select('*')
        .eq('id', id)
        .single();
      if (error) console.error(error);
      else setInstance(data);
    })();
  }, [id]);

  // --- Load ADM3 boundaries within affected ADM1/ADM2 ---
  useEffect(() => {
    if (!instance?.admin_scope?.length) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_boundaries_geojson')
        .select('admin_pcode,name,admin_level,parent_pcode,geom')
        .eq('admin_level', 'ADM3')
        .in('parent_pcode', instance.admin_scope);
      if (error) {
        console.error('Boundary load error:', error);
        setBoundaries([]);
      } else {
        setBoundaries(data as AdminBoundary[]);
      }
      setLoading(false);
    })();
  }, [instance?.admin_scope]);

  // --- Combine all ADM3 GeoJSON features ---
  const combinedGeoJSON = boundaries.length
    ? {
        type: 'FeatureCollection',
        features: boundaries.map((b) => ({
          type: 'Feature',
          properties: { name: b.name, pcode: b.admin_pcode },
          geometry: typeof b.geom === 'string' ? JSON.parse(b.geom) : b.geom,
        })),
      }
    : null;

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between no-print">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--gsc-blue)' }}>
          {instance ? instance.name : 'Loading...'}
        </h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setShowAreaModal(true)}>
            Define Affected Area
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}>
            Configure Datasets
          </button>
        </div>
      </header>

      <div className="card p-4">
        <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--gsc-green)' }}>
          Affected Area Overview
        </h2>

        {loading && <div className="text-sm text-gray-600">Loading boundaries...</div>}

        {!loading && combinedGeoJSON && (
          <div className="h-[500px] w-full border rounded-md overflow-hidden">
            <Suspense fallback={<div className="text-sm p-4">Loading map...</div>}>
              <MapContainer
                center={[12.8797, 121.774]} // Philippines centroid
                zoom={6}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap contributors"
                />
                <GeoJSON
                  data={combinedGeoJSON as any}
                  style={{
                    color: '#2563eb',
                    weight: 1,
                    fillOpacity: 0.2,
                  }}
                />
                <MapAutoZoom geojson={combinedGeoJSON} />
              </MapContainer>
            </Suspense>
          </div>
        )}

        {!loading && !combinedGeoJSON && (
          <div className="text-sm text-gray-500">
            No boundaries found for selected affected area.
          </div>
        )}
      </div>

      {/* Recompute Panel */}
      {instance && <InstanceRecomputePanel instanceId={instance.id} />}

      {/* Modals */}
      {showAreaModal && instance && (
        <DefineAffectedAreaModal
          instance={instance}
          onClose={() => setShowAreaModal(false)}
          onSaved={async () => {
            setShowAreaModal(false);
            const { data } = await supabase.from('instances').select('*').eq('id', id).single();
            setInstance(data);
          }}
        />
      )}

      {showCategoryModal && instance && (
        <InstanceCategoryConfigModal
          instance={instance}
          onClose={() => setShowCategoryModal(false)}
        />
      )}
    </div>
  );
}
