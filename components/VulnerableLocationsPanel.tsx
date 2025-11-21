'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

interface VulnerableLocation {
  admin_pcode: string;
  name: string;
  avg_score: number;
}

interface Props {
  instanceId: string;
}

export default function VulnerableLocationsPanel({ instanceId }: Props) {
  const [locations, setLocations] = useState<VulnerableLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const loadVulnerableLocations = async () => {
      if (!instanceId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Get top locations by score (highest = most vulnerable)
        const { data, error: fetchError } = await supabase
          .from('v_instance_admin_scores')
          .select('admin_pcode, name, avg_score')
          .eq('instance_id', instanceId)
          .not('avg_score', 'is', null)
          .order('avg_score', { ascending: false })
          .limit(showAll ? 50 : 5);

        if (fetchError) {
          console.error('Error loading vulnerable locations:', fetchError);
          setError(fetchError.message);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          setError('No location scores available');
          setLoading(false);
          return;
        }

        setLocations(data.map((loc: any) => ({
          admin_pcode: loc.admin_pcode,
          name: loc.name || 'Unknown',
          avg_score: Number(loc.avg_score) || 0,
        })));
      } catch (err: any) {
        console.error('Error loading vulnerable locations:', err);
        setError(err?.message || 'Failed to load vulnerable locations');
      } finally {
        setLoading(false);
      }
    };

    loadVulnerableLocations();
  }, [instanceId, showAll]);

  const getSeverityColor = (score: number): string => {
    if (score >= 4.5) return 'var(--gsc-red)';
    if (score >= 3.5) return 'var(--gsc-orange)';
    if (score >= 2.5) return '#FFCC00'; // Yellow
    if (score >= 1.5) return '#CCFF00'; // Yellow-green
    return '#00FF00'; // Green
  };

  const getSeverityLabel = (score: number): string => {
    if (score >= 4.5) return 'Critical';
    if (score >= 3.5) return 'High';
    if (score >= 2.5) return 'Moderate';
    if (score >= 1.5) return 'Low';
    return 'Very Low';
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-4" style={{ backgroundColor: 'rgba(0, 75, 135, 0.02)', borderColor: 'var(--gsc-blue)' }}>
        <h3 className="font-semibold mb-2" style={{ color: 'var(--gsc-blue)' }}>
          Most Vulnerable Locations
        </h3>
        <p className="text-sm" style={{ color: 'var(--gsc-gray)' }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4" style={{ backgroundColor: 'rgba(99, 7, 16, 0.05)', borderColor: 'var(--gsc-red)' }}>
        <h3 className="font-semibold mb-2" style={{ color: 'var(--gsc-red)' }}>
          Most Vulnerable Locations
        </h3>
        <p className="text-sm" style={{ color: 'var(--gsc-gray)' }}>{error}</p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="border rounded-lg p-4" style={{ backgroundColor: 'rgba(0, 75, 135, 0.02)', borderColor: 'var(--gsc-blue)' }}>
        <h3 className="font-semibold mb-2" style={{ color: 'var(--gsc-blue)' }}>
          Most Vulnerable Locations
        </h3>
        <p className="text-sm" style={{ color: 'var(--gsc-gray)' }}>No location scores available.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4" style={{ backgroundColor: 'rgba(0, 75, 135, 0.02)', borderColor: 'var(--gsc-blue)' }}>
      <h3 className="font-semibold mb-3" style={{ color: 'var(--gsc-blue)' }}>
        Most Vulnerable Locations
      </h3>
      
      <div className="space-y-2">
        {locations.map((location, index) => (
          <div
            key={location.admin_pcode}
            className="flex items-center justify-between p-2 rounded border"
            style={{
              backgroundColor: index < 5 ? 'rgba(99, 7, 16, 0.05)' : 'transparent',
              borderColor: getSeverityColor(location.avg_score),
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
                style={{ backgroundColor: getSeverityColor(location.avg_score) }}
              >
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm" style={{ color: 'var(--gsc-gray)' }}>
                  {location.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--gsc-gray)' }}>
                  {getSeverityLabel(location.avg_score)} Severity
                </div>
              </div>
            </div>
            <div className="text-right">
              <div
                className="font-bold text-lg"
                style={{ color: getSeverityColor(location.avg_score) }}
              >
                {location.avg_score.toFixed(1)}
              </div>
              <div className="text-xs" style={{ color: 'var(--gsc-gray)' }}>
                / 5.0
              </div>
            </div>
          </div>
        ))}
      </div>

      {locations.length >= 5 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 w-full py-2 px-4 rounded text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--gsc-blue)',
            color: '#fff',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          View More ({locations.length} total)
        </button>
      )}

      {showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-3 w-full py-2 px-4 rounded text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--gsc-light-gray)',
            color: 'var(--gsc-gray)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 75, 135, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--gsc-light-gray)';
          }}
        >
          Show Less
        </button>
      )}
    </div>
  );
}

