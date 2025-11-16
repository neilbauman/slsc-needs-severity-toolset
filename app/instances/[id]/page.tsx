'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';
import InstanceDatasetConfigModal from '@/components/InstanceDatasetConfigModal';
import InstanceRecomputePanel from '@/components/InstanceRecomputePanel';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });

interface Instance {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  admin_scope: string[] | null;
  target_admin_level?: string | null;
}

export default function InstancePage() {
  const params = useParams();
  const supabase = createClient();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [adm3GeoJSON, setAdm3GeoJSON] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showDatasetModal, setShowDatasetModal] = useState(false);

  useEffect(() => {
    loadInstance();
  }, [params.id]);

  const loadInstance = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instances')
      .select('*')
      .eq('id', params.id)
      .single();
    if (error) {
      console.error('Error loading instance:', error);
      setLoading(false);
      return;
    }
    setInstance(data);
    await loadAdm3(data.admin_scope);
    setLoading(false);
  };

  const loadAdm3 = async (scope: string[] | null) => {
    if (!scope || scope.length === 0) {
      setAdm3GeoJSON(null);
      return;
    }

    const { data, error } = await supabase.rpc('get_affected_adm3', { in_scope: scope });
    if (error) {
      console.error('ADM3 load error:', error);
      return;
    }

    // Wrap features in a valid GeoJSON FeatureCollection
    setAdm3GeoJSON({
      type: 'FeatureCollection',
      features: data.map((row: any) => ({
        type: 'Feature',
        properties: {
          name: row.name,
          admin_pcode: row.admin_pcode,
          parent_pcode: row.parent_pcode
        },
        geometry: row.geom
      }))
    });
  };

  const handleAreaSaved = async () => {
    await loadInstance();
    setShowAreaModal(false);
  };

  if (loading) return <div className="p-4 text-sm text-gray-600">Loading instance...</div>;
  if (!instance) return <div className="p-4 text-sm text-gray-600">Instance not found.</div>;

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--gsc-blue)' }}>
            {instance.name}
          </h1>
          <div className="text-xs text-gray-500">
            Created at:{' '}
            {instance.created_at ? new Date(instance.created_at).toLocaleString() : '—'}
          </div>
          {instance.description && (
            <div className="text-sm text-gray-600 mt-1">{instance.description}</div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => setShowDatasetModal(true)}
          >
            Configure Datasets
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAreaModal(true)}
          >
            Define Affected Area
          </button>
        </div>
      </header>

      {instance.admin_scope && instance.admin_scope.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
          <strong className="mr-2">🌍 Affected Area:</strong>
          <span>
            {instance.admin_scope.join(', ')} (Target Level:{' '}
            <strong>{instance.target_admin_level || 'ADM3'}</strong>)
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div className="card p-3">
          <InstanceRecomputePanel instanceId={instance.id} />

          <div className="mt-3 rounded overflow-hidden" style={{ height: 500 }}>
            {adm3GeoJSON ? (
              <MapContainer
                style={{ height: '100%', width: '100%' }}
                center={[10.3157, 123.8854]}
                zoom={8}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <GeoJSON
                  data={adm3GeoJSON}
                  style={() => ({
                    color: '#1d4ed8',
                    weight: 1,
                    fillColor: '#60a5fa',
                    fillOpacity: 0.5
                  })}
                />
              </MapContainer>
            ) : (
              <div className="text-sm text-gray-500 p-3">Loading map...</div>
            )}
          </div>
        </div>

        <div className="card p-3">
          <h2 className="text-sm font-semibold mb-2">Top Locations</h2>
          <div className="text-xs text-gray-500">No data yet</div>
        </div>
      </div>

      {showAreaModal && (
        <DefineAffectedAreaModal
          instance={instance}
          onClose={() => setShowAreaModal(false)}
          onSaved={handleAreaSaved}
        />
      )}

      {showDatasetModal && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowDatasetModal(false)}
          onSaved={loadInstance}
        />
      )}
    </div>
  );
}
