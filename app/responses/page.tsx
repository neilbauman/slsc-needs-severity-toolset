'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import CreateResponseModal from '@/components/CreateResponseModal';
import ResponsesSummaryDashboard from '@/components/ResponsesSummaryDashboard';

type Response = {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  admin_scope: string[] | null;
  status: string | null;
  normalization_scope: string | null;
  baseline_id: string | null;
  legacy_instance_id: string | null;
  layer_count?: number;
};

type Baseline = {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
  computed_at: string | null;
};

export default function ResponsesPage() {
  const router = useRouter();
  const [responses, setResponses] = useState<Response[]>([]);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleResponseCreated = (responseId: string) => {
    router.push(`/responses/${responseId}`);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // Fetch baselines
      const { data: baselinesData, error: baselinesError } = await supabase
        .from('country_baselines')
        .select('id, name, slug, status, computed_at')
        .order('created_at', { ascending: false });
      
      if (baselinesError) {
        console.error('Error fetching baselines:', baselinesError);
        // Check for schema cache error
        if (baselinesError.message?.includes('schema cache')) {
          setError('New tables are being synchronized. Please wait 1-2 minutes and refresh the page.');
        }
        setBaselines([]);
      } else {
        setBaselines(baselinesData || []);
      }
      
      // Fetch responses
      const { data: responsesData, error: responsesError } = await supabase
        .from('responses')
        .select('id, name, description, created_at, admin_scope, status, normalization_scope, baseline_id, legacy_instance_id')
        .order('created_at', { ascending: false });
      
      if (responsesError) {
        console.error('Error fetching responses:', responsesError);
        setResponses([]);
      } else {
        // Fetch layer counts separately
        const responseIds = (responsesData || []).map((r: any) => r.id);
        let layerCounts: Record<string, number> = {};
        
        if (responseIds.length > 0) {
          const { data: layersData } = await supabase
            .from('response_layers')
            .select('response_id')
            .in('response_id', responseIds);
          
          // Count layers per response
          (layersData || []).forEach((l: any) => {
            layerCounts[l.response_id] = (layerCounts[l.response_id] || 0) + 1;
          });
        }
        
        const transformedResponses = (responsesData || []).map((r: any) => ({
          ...r,
          layer_count: layerCounts[r.id] || 0
        }));
        setResponses(transformedResponses);
      }
    } catch (err: any) {
      console.error('Exception in load:', err);
      setError(`Error: ${err.message}`);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const getStatusBadge = (status: string | null) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      monitoring: 'bg-blue-100 text-blue-800',
      closed: 'bg-gray-100 text-gray-800',
      archived: 'bg-gray-100 text-gray-500',
      draft: 'bg-yellow-100 text-yellow-800',
    };
    return statusColors[status || 'active'] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-4 space-y-6">
      <header className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--gsc-blue)' }}>
            Responses
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Layered response architecture with baseline + temporal layers
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            + New Response
          </button>
          <Link href="/instances" className="btn btn-secondary">
            Legacy Instances
          </Link>
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
        </div>
      </header>

      {/* Dashboard Summary */}
      <ResponsesSummaryDashboard />

      {/* Error Message */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <p className="text-sm text-yellow-800 font-medium">{error}</p>
          <button 
            onClick={load}
            className="mt-2 text-sm text-yellow-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Baseline Summary */}
      <div className="card p-4">
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--gsc-green)' }}>
          Country Baseline
        </h2>
        {baselines.length === 0 ? (
          <p className="text-sm text-gray-500">No baseline configured yet.</p>
        ) : (
          <div className="space-y-2">
            {baselines.map((baseline) => (
              <div key={baseline.id} className="flex items-center justify-between border rounded-md px-3 py-2 hover:bg-gray-50">
                <div>
                  <span className="font-medium">{baseline.name}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${getStatusBadge(baseline.status)}`}>
                    {baseline.status || 'draft'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {baseline.computed_at 
                      ? `Computed: ${new Date(baseline.computed_at).toLocaleDateString()}`
                      : 'Not computed'}
                  </span>
                  <Link 
                    href={`/baselines/${baseline.slug || baseline.id}`}
                    className="btn btn-secondary text-sm"
                  >
                    Configure
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Responses list */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Active Responses</h2>
          <div className="text-xs text-gray-500">{responses.length} total</div>
        </div>

        {loading && <div className="text-sm">Loading...</div>}
        {!loading && responses.length === 0 && (
          <div className="text-sm text-gray-600">No responses yet.</div>
        )}

        {!loading && responses.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Layers</th>
                  <th className="py-2 pr-3">Affected Areas</th>
                  <th className="py-2 pr-3">Normalization</th>
                  <th className="py-2 pr-3">Legacy Instance</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((resp) => (
                  <tr key={resp.id} className="border-t">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{resp.name}</div>
                      {resp.description && (
                        <div className="text-xs text-gray-500">{resp.description}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(resp.status)}`}>
                        {resp.status || 'active'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{resp.layer_count || 0}</span>
                    </td>
                    <td className="py-2 pr-3">{resp.admin_scope?.length ?? 0} ADM2</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        resp.normalization_scope === 'national' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {resp.normalization_scope || 'affected_area'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {resp.legacy_instance_id ? (
                        <Link 
                          href={`/instances/${resp.legacy_instance_id}`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          View Instance
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-0">
                      <div className="flex items-center gap-2 justify-end">
                        <Link href={`/responses/${resp.id}`} className="btn btn-primary">
                          Open Dashboard
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Response Modal */}
      <CreateResponseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleResponseCreated}
      />
    </div>
  );
}
