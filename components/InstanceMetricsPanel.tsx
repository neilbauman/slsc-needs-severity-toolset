'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface MetricsData {
  total_population: number;
  people_concern: number;
  people_need: number;
  avg_severity?: number;
  high_severity_count?: number;
  total_affected_locations?: number;
}

interface Props {
  instanceId: string;
}

export default function InstanceMetricsPanel({ instanceId }: Props) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      if (!instanceId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Get instance summary metrics
        const { data: summaryData, error: summaryError } = await supabase.rpc('get_instance_summary', {
          in_instance_id: instanceId
        });

        if (summaryError) {
          console.error('Error loading instance summary:', summaryError);
          setError(summaryError.message);
          setLoading(false);
          return;
        }

        if (!summaryData || summaryData.length === 0) {
          setError('No metrics data available');
          setLoading(false);
          return;
        }

        const summary = summaryData[0] || summaryData;

        // Also get additional metrics from overall scores
        let avgSeverity = null;
        let highSeverityCount = null;
        let totalAffectedLocations = null;

        try {
          // Get overall scores to calculate average severity
          const { data: scoresData, error: scoresError } = await supabase
            .from('v_instance_admin_scores')
            .select('avg_score, admin_pcode')
            .eq('instance_id', instanceId);

          if (!scoresError && scoresData && scoresData.length > 0) {
            const validScores = scoresData
              .map((s: any) => Number(s.avg_score))
              .filter((score: number) => !isNaN(score) && score > 0);
            
            if (validScores.length > 0) {
              avgSeverity = validScores.reduce((sum: number, s: number) => sum + s, 0) / validScores.length;
              highSeverityCount = validScores.filter((s: number) => s >= 4).length;
              totalAffectedLocations = validScores.length;
            }
          }
        } catch (e) {
          console.warn('Error loading additional metrics:', e);
        }

        setMetrics({
          total_population: Number(summary.total_population) || 0,
          people_concern: Number(summary.people_concern) || 0,
          people_need: Number(summary.people_need) || 0,
          avg_severity: avgSeverity,
          high_severity_count: highSeverityCount,
          total_affected_locations: totalAffectedLocations,
        });
      } catch (err: any) {
        console.error('Error loading metrics:', err);
        setError(err?.message || 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [instanceId]);

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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border rounded-lg p-4 shadow-sm animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="border rounded-lg p-4 mb-4"
        style={{
          backgroundColor: 'rgba(217, 84, 0, 0.1)',
          borderColor: 'var(--gsc-orange)'
        }}
      >
        <p className="text-sm" style={{ color: 'var(--gsc-orange)' }}>⚠️ {error}</p>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const {
    total_population,
    people_concern,
    people_need,
    avg_severity,
    high_severity_count,
    total_affected_locations,
  } = metrics;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
      {/* Total Population in Affected Area */}
      <div 
        className="border rounded-lg p-4 shadow-sm"
        style={{
          backgroundColor: 'rgba(0, 75, 135, 0.05)',
          borderColor: 'rgba(0, 75, 135, 0.2)'
        }}
      >
        <div 
          className="text-xs font-medium uppercase tracking-wide mb-1"
          style={{ color: 'var(--gsc-blue)' }}
        >
          Total Population
        </div>
        <div 
          className="text-2xl font-bold"
          style={{ color: 'var(--gsc-blue)' }}
        >
          {formatNumber(total_population)}
        </div>
        <div 
          className="text-xs mt-1"
          style={{ color: 'var(--gsc-gray)' }}
        >
          Affected Area
        </div>
      </div>

      {/* People of Concern */}
      <div 
        className="border rounded-lg p-4 shadow-sm"
        style={{
          backgroundColor: 'rgba(211, 84, 0, 0.05)',
          borderColor: 'rgba(211, 84, 0, 0.2)'
        }}
      >
        <div 
          className="text-xs font-medium uppercase tracking-wide mb-1"
          style={{ color: 'var(--gsc-orange)' }}
        >
          People of Concern
        </div>
        <div 
          className="text-2xl font-bold"
          style={{ color: 'var(--gsc-orange)' }}
        >
          {formatNumber(people_concern)}
        </div>
        <div 
          className="text-xs mt-1"
          style={{ color: 'var(--gsc-gray)' }}
        >
          Severity ≥ 3 ({formatPercentage(people_concern, total_population)})
        </div>
      </div>

      {/* People in Need */}
      <div 
        className="border rounded-lg p-4 shadow-sm"
        style={{
          backgroundColor: 'rgba(99, 7, 16, 0.05)',
          borderColor: 'rgba(99, 7, 16, 0.2)'
        }}
      >
        <div 
          className="text-xs font-medium uppercase tracking-wide mb-1"
          style={{ color: 'var(--gsc-red)' }}
        >
          People in Need
        </div>
        <div 
          className="text-2xl font-bold"
          style={{ color: 'var(--gsc-red)' }}
        >
          {formatNumber(people_need)}
        </div>
        <div 
          className="text-xs mt-1"
          style={{ color: 'var(--gsc-gray)' }}
        >
          PoC × Poverty Rate ({formatPercentage(people_need, total_population)})
        </div>
      </div>

      {/* Average Severity Score */}
      <div 
        className="border rounded-lg p-4 shadow-sm"
        style={{
          backgroundColor: 'rgba(0, 75, 135, 0.05)',
          borderColor: 'rgba(0, 75, 135, 0.2)'
        }}
      >
        <div 
          className="text-xs font-medium uppercase tracking-wide mb-1"
          style={{ color: 'var(--gsc-blue)' }}
        >
          Avg Severity
        </div>
        <div 
          className="text-2xl font-bold"
          style={{ color: 'var(--gsc-blue)' }}
        >
          {avg_severity !== null && avg_severity !== undefined ? avg_severity.toFixed(2) : 'N/A'}
        </div>
        <div 
          className="text-xs mt-1"
          style={{ color: 'var(--gsc-gray)' }}
        >
          Out of 5.0
        </div>
      </div>

      {/* High Severity Locations */}
      <div 
        className="border rounded-lg p-4 shadow-sm"
        style={{
          backgroundColor: 'rgba(211, 84, 0, 0.08)',
          borderColor: 'rgba(211, 84, 0, 0.3)'
        }}
      >
        <div 
          className="text-xs font-medium uppercase tracking-wide mb-1"
          style={{ color: 'var(--gsc-orange)' }}
        >
          High Severity
        </div>
        <div 
          className="text-2xl font-bold"
          style={{ color: 'var(--gsc-orange)' }}
        >
          {formatNumber(high_severity_count)}
        </div>
        <div 
          className="text-xs mt-1"
          style={{ color: 'var(--gsc-gray)' }}
        >
          Locations (≥ 4) {total_affected_locations ? `(${formatPercentage(high_severity_count, total_affected_locations)})` : ''}
        </div>
      </div>

      {/* Total Affected Locations */}
      <div 
        className="border rounded-lg p-4 shadow-sm"
        style={{
          backgroundColor: 'var(--gsc-light-gray)',
          borderColor: 'rgba(55, 65, 81, 0.2)'
        }}
      >
        <div 
          className="text-xs font-medium uppercase tracking-wide mb-1"
          style={{ color: 'var(--gsc-gray)' }}
        >
          Affected Locations
        </div>
        <div 
          className="text-2xl font-bold"
          style={{ color: 'var(--gsc-gray)' }}
        >
          {formatNumber(total_affected_locations)}
        </div>
        <div 
          className="text-xs mt-1"
          style={{ color: 'var(--gsc-gray)' }}
        >
          Admin Units
        </div>
      </div>
    </div>
  );
}
