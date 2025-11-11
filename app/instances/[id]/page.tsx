'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import AffectedAreaModal from '@/components/AffectedAreaModal';

// Lazy-load react-leaflet for SSR
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

export default function InstancePage() {
  const supabase = createClient();
  const { id } = useParams();
  const router = useRouter();

  const [instance, setInstance] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [priority, setPriority] = useState<any[]>([]);
  const [showAffected, setShowAffected] = useState(false);

  // --- Load instance + metrics + priority table
  const loadInstanceData = async () => {
    const { data: inst } = await supabase.from('instances').select('*').eq('id', id).single();
    setInstance(inst);

    const { data: summaryData } = await supabase.rpc('get_instance_summary', { in_instance: id });
    setSummary(summaryData?.[0] ?? null);

    const { data: priorityData } = await supabase.rpc('get_priority_locations', {
      in_instance: id,
      limit_n: 15,
    });
    setPriority(priorityData ?? []);
  };

  useEffect(() => {
    loadInstanceData();
  }, [id]);

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--gsc-blue,#004b87)]">
          {instance?.name ?? 'Instance Dashboard'}
        </h1>
        <div className="space-x-2">
          <button
            onClick={() => router.push('/instances')}
            className="px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={() => setShowAffected(true)}
            className="px-3 py-1.5 rounded text-sm bg-[var(--gsc-green,#2e7d32)] text-white hover:opacity-90"
          >
            Define Affected Area
          </button>
        </div>
      </div>

      {/* --- Dashboard Grid --- */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left: Map */}
        <div className="col-span-7 bg-white border rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between mb-2 text-sm font-medium text-gray-700">
            <span>Affected Area</span>
            <span className="text-gray-400 text-xs">
              {instance?.admin_scope?.length ?? 0} ADM1 selected
            </span>
          </div>

          <div className="h-[520px] rounded overflow-hidden border relative z-0">
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={5}
              scrollWheelZoom={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </MapContainer>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Affected regions: {instance?.admin_scope?.join(', ') || 'None defined'}.
          </p>
        </div>

        {/* Right: Metrics and Tables */}
        <div className="col-span-5 flex flex-col gap-4">
          {/* Summary Metrics */}
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Summary Metrics
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">Framework Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
                  {summary?.framework_avg?.toFixed(3) ?? '-'}
                </div>
              </div>
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">Final Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-red,#630710)]">
                  {summary?.final_avg?.toFixed(3) ?? '-'}
                </div>
              </div>
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3 col-span-2">
                <div className="text-xs text-gray-600">People Affected</div>
                <div className="text-lg font-semibold text-[var(--gsc-blue,#004b87)]">
                  {summary?.people_affected?.toLocaleString() ?? '-'}
                </div>
              </div>
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">People of Concern</div>
                <div className="text-lg font-semibold text-[var(--gsc-orange,#d35400)]">
                  {summary?.people_of_concern?.toLocaleString() ?? '-'}
                </div>
              </div>
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">People in Need</div>
                <div className="text-lg font-semibold text-[var(--gsc-green,#2e7d32)]">
                  {summary?.people_in_need?.toLocaleString() ?? '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Priority Locations Table */}
          <div className="bg-white border rounded-lg shadow-sm p-4 overflow-auto max-h-[420px]">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Priority Locations (Top 15)
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-gray-500 text-xs border-b">
                  <th className="text-left py-1">ADM2</th>
                  <th className="text-left py-1">ADM3</th>
                  <th className="text-right py-1">Final Score</th>
                  <th className="text-right py-1">Population</th>
                  <th className="text-right py-1">People in Need</th>
                </tr>
              </thead>
              <tbody>
                {priority.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-3">
                      No data available
                    </td>
                  </tr>
                )}
                {priority.map((p) => (
                  <tr
                    key={p.pcode}
                    className="border-b last:border-none hover:bg-gray-50 transition"
                  >
                    <td className="py-1">{p.adm2_name ?? '-'}</td>
                    <td className="py-1">{p.adm3_name ?? '-'}</td>
                    <td className="py-1 text-right">{p.final_score?.toFixed(3) ?? '-'}</td>
                    <td className="py-1 text-right">{p.population?.toLocaleString() ?? '-'}</td>
                    <td className="py-1 text-right text-[var(--gsc-green,#2e7d32)] font-medium">
                      {p.people_in_need?.toLocaleString() ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAffected && instance && (
        <AffectedAreaModal
          instance={instance}
          onClose={() => setShowAffected(false)}
          onSaved={loadInstanceData}
        />
      )}
    </div>
  );
}
