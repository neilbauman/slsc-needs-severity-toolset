'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

interface ResponseMetricsData {
  total_population: number;
  people_concern: number;
  people_need: number;
  total_affected_locations: number | null;
  areas_of_concern_count: number | null;
  avg_severity: number | null;
}

interface Props {
  responseId: string;
  layerId: string | null; // null = baseline
  refreshKey?: number;
}

export default function ResponseMetricsPanel({ responseId, layerId, refreshKey }: Props) {
  const [metrics, setMetrics] = useState<ResponseMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      if (!responseId) return;

      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data, error: rpcError } = await supabase.rpc('get_response_summary', {
          in_response_id: responseId,
          in_layer_id: layerId,
        });

        if (rpcError) {
          setError(rpcError.message);
          setLoading(false);
          return;
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
          setMetrics({
            total_population: 0,
            people_concern: 0,
            people_need: 0,
            total_affected_locations: 0,
            areas_of_concern_count: 0,
            avg_severity: null,
          });
          setLoading(false);
          return;
        }

        const row = Array.isArray(data) ? data[0] : data;
        setMetrics({
          total_population: Number(row?.total_population ?? 0),
          people_concern: Number(row?.people_concern ?? 0),
          people_need: Number(row?.people_need ?? 0),
          total_affected_locations: row?.total_affected_locations != null ? Number(row.total_affected_locations) : null,
          areas_of_concern_count: row?.areas_of_concern_count != null ? Number(row.areas_of_concern_count) : null,
          avg_severity: row?.avg_severity != null ? Number(row.avg_severity) : null,
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [responseId, layerId, refreshKey]);

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatPercentage = (num: number | null | undefined, total: number | null | undefined): string => {
    if (num === null || num === undefined || total === null || total === undefined || total === 0) return 'N/A';
    const pct = (num / total) * 100;
    return `${pct.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border rounded-lg p-4 shadow-sm animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2" />
            <div className="h-8 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="border rounded-lg p-4 mb-4"
        style={{ backgroundColor: 'rgba(217, 84, 0, 0.1)', borderColor: 'var(--gsc-orange)' }}
      >
        <p className="text-sm" style={{ color: 'var(--gsc-orange)' }}>
          ⚠️ {error}
        </p>
      </div>
    );
  }

  if (!metrics) return null;

  const {
    total_population,
    people_concern,
    people_need,
    total_affected_locations,
    areas_of_concern_count,
    avg_severity,
  } = metrics;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-2">
      {/* Total Population */}
      <div
        className="border rounded p-2 shadow-sm"
        style={{ backgroundColor: 'rgba(0, 75, 135, 0.05)', borderColor: 'rgba(0, 75, 135, 0.2)' }}
      >
        <div className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--gsc-blue)' }}>
          Total Population
        </div>
        <div className="text-lg font-bold" style={{ color: 'var(--gsc-blue)' }}>
          {formatNumber(total_population)}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--gsc-gray)' }}>
          Affected Area
        </div>
      </div>

      {/* People of Concern (PoC) */}
      <div
        className="border rounded p-2 shadow-sm"
        style={{ backgroundColor: 'rgba(211, 84, 0, 0.05)', borderColor: 'rgba(211, 84, 0, 0.2)' }}
      >
        <div className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--gsc-orange)' }}>
          People of Concern (PoC)
        </div>
        <div className="text-lg font-bold" style={{ color: 'var(--gsc-orange)' }}>
          {formatNumber(people_concern)}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--gsc-gray)' }}>
          Severity ≥ 3 ({formatPercentage(people_concern, total_population)})
        </div>
      </div>

      {/* People in Need (PiN) */}
      <div
        className="border rounded p-2 shadow-sm"
        style={{ backgroundColor: 'rgba(99, 7, 16, 0.05)', borderColor: 'rgba(99, 7, 16, 0.2)' }}
      >
        <div className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--gsc-red)' }}>
          People in Need (PiN)
        </div>
        <div className="text-lg font-bold" style={{ color: 'var(--gsc-red)' }}>
          {formatNumber(people_need)}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--gsc-gray)' }}>
          Humanitarian caseload ({formatPercentage(people_need, total_population)})
        </div>
      </div>

      {/* Avg Severity */}
      <div
        className="border rounded p-2 shadow-sm"
        style={{ backgroundColor: 'rgba(0, 75, 135, 0.05)', borderColor: 'rgba(0, 75, 135, 0.2)' }}
      >
        <div className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--gsc-blue)' }}>
          Avg Severity
        </div>
        <div className="text-lg font-bold" style={{ color: 'var(--gsc-blue)' }}>
          {avg_severity != null && !isNaN(avg_severity) ? avg_severity.toFixed(2) : 'N/A'}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--gsc-gray)' }}>
          Out of 5.0
        </div>
      </div>

      {/* Areas of Concern */}
      <div
        className="border rounded p-2 shadow-sm"
        style={{ backgroundColor: 'rgba(211, 84, 0, 0.08)', borderColor: 'rgba(211, 84, 0, 0.3)' }}
      >
        <div className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--gsc-orange)' }}>
          Areas of Concern
        </div>
        <div className="text-lg font-bold" style={{ color: 'var(--gsc-orange)' }}>
          {formatNumber(areas_of_concern_count)}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--gsc-gray)' }}>
          Severity ≥ 3{' '}
          {total_affected_locations != null
            ? `(${formatPercentage(areas_of_concern_count ?? 0, total_affected_locations)})`
            : ''}
        </div>
      </div>

      {/* Affected Locations */}
      <div
        className="border rounded p-2 shadow-sm"
        style={{ backgroundColor: 'var(--gsc-light-gray)', borderColor: 'rgba(55, 65, 81, 0.2)' }}
      >
        <div className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--gsc-gray)' }}>
          Affected Locations
        </div>
        <div className="text-lg font-bold" style={{ color: 'var(--gsc-gray)' }}>
          {formatNumber(total_affected_locations)}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--gsc-gray)' }}>
          Admin Units
        </div>
      </div>
    </div>
  );
}
