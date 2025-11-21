'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

interface VulnerableLocation {
  admin_pcode: string;
  name: string;
  avg_score: number;
  population: number | null;
  people_in_need: number | null;
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
        
        // Get instance to find population dataset
        const { data: instanceData } = await supabase
          .from('instances')
          .select('population_dataset_id')
          .eq('id', instanceId)
          .single();

        // Find poverty rate dataset
        const { data: povertyDataset } = await supabase
          .from('datasets')
          .select('id')
          .ilike('name', '%poverty%')
          .limit(1)
          .single();

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

        // Get population and poverty data for these locations
        const adminPcodes = data.map((loc: any) => loc.admin_pcode);
        const locationsWithData = await Promise.all(
          data.map(async (loc: any) => {
            let population: number | null = null;
            let povertyRate: number | null = null;

            // Fetch population
            if (instanceData?.population_dataset_id) {
              const { data: popData } = await supabase
                .from('dataset_values_numeric')
                .select('value')
                .eq('dataset_id', instanceData.population_dataset_id)
                .eq('admin_pcode', loc.admin_pcode)
                .single();
              
              if (popData) {
                population = Number(popData.value) || null;
              }
            }

            // Fetch poverty rate
            if (povertyDataset?.id) {
              const { data: povData } = await supabase
                .from('dataset_values_numeric')
                .select('value')
                .eq('dataset_id', povertyDataset.id)
                .eq('admin_pcode', loc.admin_pcode)
                .single();
              
              if (povData) {
                povertyRate = Number(povData.value) || null;
              }
            }

            // Calculate People in Need = population * (poverty_rate / 100)
            let peopleInNeed: number | null = null;
            if (population !== null && povertyRate !== null) {
              peopleInNeed = Math.round(population * (povertyRate / 100));
            }

            return {
              admin_pcode: loc.admin_pcode,
              name: loc.name || 'Unknown',
              avg_score: Number(loc.avg_score) || 0,
              population,
              people_in_need: peopleInNeed,
            };
          })
        );

        setLocations(locationsWithData);
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

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  if (loading) {
    return (
      <div className="border rounded p-2" style={{ backgroundColor: 'rgba(0, 75, 135, 0.02)', borderColor: 'var(--gsc-blue)' }}>
        <h3 className="font-semibold mb-1 text-xs" style={{ color: 'var(--gsc-blue)' }}>
          Most Vulnerable Locations
        </h3>
        <p className="text-xs" style={{ color: 'var(--gsc-gray)' }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded p-2" style={{ backgroundColor: 'rgba(99, 7, 16, 0.05)', borderColor: 'var(--gsc-red)' }}>
        <h3 className="font-semibold mb-1 text-xs" style={{ color: 'var(--gsc-red)' }}>
          Most Vulnerable Locations
        </h3>
        <p className="text-xs" style={{ color: 'var(--gsc-gray)' }}>{error}</p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="border rounded p-2" style={{ backgroundColor: 'rgba(0, 75, 135, 0.02)', borderColor: 'var(--gsc-blue)' }}>
        <h3 className="font-semibold mb-1 text-xs" style={{ color: 'var(--gsc-blue)' }}>
          Most Vulnerable Locations
        </h3>
        <p className="text-xs" style={{ color: 'var(--gsc-gray)' }}>No location scores available.</p>
      </div>
    );
  }

  return (
    <div className="border rounded p-2" style={{ backgroundColor: 'rgba(0, 75, 135, 0.02)', borderColor: 'var(--gsc-blue)' }}>
      <h3 className="font-semibold mb-2 text-xs" style={{ color: 'var(--gsc-blue)' }}>
        Most Vulnerable Locations
      </h3>
      
      <div className="space-y-1">
        {locations.map((location, index) => (
          <div
            key={location.admin_pcode}
            className="flex items-center justify-between p-1.5 rounded border"
            style={{
              backgroundColor: index < 5 ? 'rgba(99, 7, 16, 0.05)' : 'transparent',
              borderColor: getSeverityColor(location.avg_score),
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                style={{ backgroundColor: getSeverityColor(location.avg_score) }}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate" style={{ color: 'var(--gsc-gray)' }}>
                  {location.name}
                </div>
                <div className="text-xs flex gap-2 mt-0.5">
                  <span style={{ color: 'var(--gsc-gray)' }}>
                    Pop: {formatNumber(location.population)}
                  </span>
                  <span style={{ color: 'var(--gsc-red)' }}>
                    PiN: {formatNumber(location.people_in_need)}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <div
                className="font-bold text-sm"
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
          className="mt-2 w-full py-1 px-2 rounded text-xs font-medium transition-colors"
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
          className="mt-2 w-full py-1 px-2 rounded text-xs font-medium transition-colors"
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

