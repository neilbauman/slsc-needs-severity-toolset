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

interface ScoreDistribution {
  score1: number;
  score2: number;
  score3: number;
  score4: number;
  score5: number;
}

interface Props {
  instanceId: string;
  refreshKey?: number; // Optional key to force refresh
}

export default function VulnerableLocationsPanel({ instanceId, refreshKey }: Props) {
  const [locations, setLocations] = useState<VulnerableLocation[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<ScoreDistribution | null>(null);
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
        
        // Get instance to find population dataset and country
        const { data: instanceData } = await supabase
          .from('instances')
          .select('population_dataset_id, admin_scope, country_id')
          .eq('id', instanceId)
          .single();

        // Find poverty rate dataset - try multiple search patterns, filtered by country
        let povertyDataset: any = null;
        
        // Try different search patterns, filtered by the instance's country
        const searchPatterns = ['%poverty%', '%pov%', '%poor%'];
        for (const pattern of searchPatterns) {
          let query = supabase
            .from('datasets')
            .select('id, admin_level, name')
            .ilike('name', pattern)
            .eq('type', 'numeric');
          
          // Filter by country if instance has a country_id
          if (instanceData?.country_id) {
            query = query.eq('country_id', instanceData.country_id);
          }
          
          const { data, error } = await query
            .limit(1)
            .maybeSingle();
          
          if (!error && data) {
            povertyDataset = data;
            console.log(`Found poverty dataset: ${data.name} (${data.admin_level}) for country ${instanceData?.country_id}`);
            break;
          }
        }
        
        if (!povertyDataset) {
          console.warn(`No poverty dataset found for country ${instanceData?.country_id} - PIN values will not be calculated`);
          console.warn('Searched patterns:', searchPatterns);
        }

        // Get affected ADM3 codes first - we need these to filter locations
        let affectedCodes: string[] = [];
        if (instanceData?.admin_scope && Array.isArray(instanceData.admin_scope) && instanceData.admin_scope.length > 0) {
          const { data: affectedData } = await supabase.rpc('get_affected_adm3', {
            in_scope: instanceData.admin_scope
          });
          
          if (affectedData && Array.isArray(affectedData)) {
            affectedCodes = affectedData.map((item: any) => 
              typeof item === 'string' ? item : (item.admin_pcode || item.pcode || item.code)
            ).filter(Boolean);
          }
        }

        // Get top locations by score (highest = most vulnerable) - ONLY from affected area
        let locationsQuery = supabase
          .from('v_instance_admin_scores')
          .select('admin_pcode, name, avg_score')
          .eq('instance_id', instanceId)
          .not('avg_score', 'is', null);
        
        // Filter to only affected locations
        if (affectedCodes.length > 0) {
          locationsQuery = locationsQuery.in('admin_pcode', affectedCodes);
        }
        
        const { data, error: fetchError } = await locationsQuery
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

        // Calculate score distribution - only for affected locations (affectedCodes already set above)
        let scoreQuery = supabase
          .from('v_instance_admin_scores')
          .select('avg_score, admin_pcode')
          .eq('instance_id', instanceId)
          .not('avg_score', 'is', null);
        
        // Filter to only affected locations if we have the codes
        if (affectedCodes.length > 0) {
          scoreQuery = scoreQuery.in('admin_pcode', affectedCodes);
        }
        
        const { data: allScores } = await scoreQuery;

        if (allScores) {
          const dist: ScoreDistribution = { score1: 0, score2: 0, score3: 0, score4: 0, score5: 0 };
          allScores.forEach((s: any) => {
            const score = Number(s.avg_score);
            if (isNaN(score) || score < 1 || score > 5) return;
            
            // Use Math.floor to match the top panel's threshold logic
            // Score >= 3.0 means it should be counted as Score 3 or higher
            // Math.floor ensures: 2.9 → 2, 3.0 → 3, 3.9 → 3, 4.0 → 4
            // This aligns with "Areas of Concern (≥3)" which counts exact scores >= 3.0
            const scoreBucket = Math.floor(score);
            // Clamp to valid range (1-5)
            const bucket = Math.max(1, Math.min(5, scoreBucket));
            dist[`score${bucket}` as keyof ScoreDistribution]++;
          });
          setScoreDistribution(dist);
        }

        // Batch fetch population and poverty data for all locations at once
        const adminPcodes = data.map((loc: any) => loc.admin_pcode);
        const populationMap = new Map<string, number>();
        const povertyMap = new Map<string, number>();

        // Batch fetch population data - aggregate from ADM4 to ADM3 if needed
        if (instanceData?.population_dataset_id && adminPcodes.length > 0) {
          console.log(`Fetching population for ${adminPcodes.length} locations from dataset ${instanceData.population_dataset_id}`);
          
          // First try exact ADM3 match
          const { data: popDataAdm3, error: popError } = await supabase
            .from('dataset_values_numeric')
            .select('admin_pcode, value')
            .eq('dataset_id', instanceData.population_dataset_id)
            .in('admin_pcode', adminPcodes);
          
          if (popError) {
            console.error('Error fetching ADM3 population:', popError);
          }
          
          if (!popError && popDataAdm3) {
            console.log(`Found ${popDataAdm3.length} ADM3 population records`);
            popDataAdm3.forEach((row: any) => {
              const value = Number(row.value);
              if (!isNaN(value)) {
                populationMap.set(row.admin_pcode, value);
              }
            });
          } else {
            console.log('No direct ADM3 population match found, checking if aggregation needed...');
          }

          // Get dataset admin level to check if we need to aggregate
          const { data: popDataset } = await supabase
            .from('datasets')
            .select('admin_level')
            .eq('id', instanceData.population_dataset_id)
            .single();

          // If population is at ADM4, aggregate to ADM3
          if (popDataset?.admin_level && popDataset.admin_level.toUpperCase() === 'ADM4') {
            // Get all ADM4 boundaries that belong to our ADM3 codes
            const { data: boundaries } = await supabase
              .from('admin_boundaries')
              .select('admin_pcode, parent_pcode')
              .in('parent_pcode', adminPcodes)
              .eq('admin_level', 'ADM4');
            
            if (boundaries && boundaries.length > 0) {
              const adm4Codes = boundaries.map((b: any) => b.admin_pcode);
              
              // Get ADM4 population values
              const { data: popDataAdm4 } = await supabase
                .from('dataset_values_numeric')
                .select('admin_pcode, value')
                .eq('dataset_id', instanceData.population_dataset_id)
                .in('admin_pcode', adm4Codes);
              
              if (popDataAdm4) {
                // Create map of ADM4 to ADM3
                const adm4ToAdm3 = new Map(boundaries.map((b: any) => [b.admin_pcode, b.parent_pcode]));
                const adm3PopMap = new Map<string, number>();
                
                // Aggregate ADM4 population to ADM3
                popDataAdm4.forEach((row: any) => {
                  const adm3Code = adm4ToAdm3.get(row.admin_pcode);
                  if (adm3Code && adminPcodes.includes(adm3Code)) {
                    const value = Number(row.value);
                    if (!isNaN(value) && value > 0) {
                      const current = adm3PopMap.get(adm3Code) || 0;
                      adm3PopMap.set(adm3Code, current + value);
                    }
                  }
                });
                
                // Merge into population map (only if not already set from ADM3 direct match)
                adm3PopMap.forEach((value, code) => {
                  if (!populationMap.has(code)) {
                    populationMap.set(code, value);
                  }
                });
              }
            }
          }
        }

        // Batch fetch poverty rate data - handle different admin levels
        if (povertyDataset?.id && adminPcodes.length > 0) {
          const povAdminLevel = povertyDataset.admin_level?.toUpperCase();
          
          if (povAdminLevel === 'ADM3') {
            // Direct ADM3 match
            console.log(`Fetching ADM3 poverty data for ${adminPcodes.length} locations from dataset ${povertyDataset.id}`);
            const { data: povData, error: povError } = await supabase
              .from('dataset_values_numeric')
              .select('admin_pcode, value')
              .eq('dataset_id', povertyDataset.id)
              .in('admin_pcode', adminPcodes);
            
            if (povError) {
              console.error('Error fetching ADM3 poverty data:', povError);
            }
            
            if (!povError && povData) {
              console.log(`Found ${povData.length} ADM3 poverty records`);
              povData.forEach((row: any) => {
                const value = Number(row.value);
                if (!isNaN(value)) {
                  povertyMap.set(row.admin_pcode, value);
                }
              });
            } else {
              console.log('No ADM3 poverty data found');
            }
          } else if (povAdminLevel === 'ADM4') {
            // Aggregate ADM4 poverty data to ADM3 using population-weighted average
            // Get all ADM4 boundaries that belong to our ADM3 codes
            const { data: boundaries } = await supabase
              .from('admin_boundaries')
              .select('admin_pcode, parent_pcode')
              .in('parent_pcode', adminPcodes)
              .eq('admin_level', 'ADM4');
            
            if (boundaries && boundaries.length > 0) {
              const adm4Codes = boundaries.map((b: any) => b.admin_pcode);
              
              // Get ADM4 poverty values
              const { data: povDataAdm4, error: povError } = await supabase
                .from('dataset_values_numeric')
                .select('admin_pcode, value')
                .eq('dataset_id', povertyDataset.id)
                .in('admin_pcode', adm4Codes);
              
              if (!povError && povDataAdm4) {
                // Create map of ADM4 to ADM3
                const adm4ToAdm3 = new Map(boundaries.map((b: any) => [b.admin_pcode, b.parent_pcode]));
                
                // Get ADM4 population for weighting (if population dataset is also ADM4)
                const adm4PopMap = new Map<string, number>();
                if (instanceData?.population_dataset_id) {
                  const { data: popDataset } = await supabase
                    .from('datasets')
                    .select('admin_level')
                    .eq('id', instanceData.population_dataset_id)
                    .single();
                  
                  if (popDataset?.admin_level?.toUpperCase() === 'ADM4') {
                    const { data: popDataAdm4 } = await supabase
                      .from('dataset_values_numeric')
                      .select('admin_pcode, value')
                      .eq('dataset_id', instanceData.population_dataset_id)
                      .in('admin_pcode', adm4Codes);
                    
                    if (popDataAdm4) {
                      popDataAdm4.forEach((row: any) => {
                        const value = Number(row.value);
                        if (!isNaN(value) && value > 0) {
                          adm4PopMap.set(row.admin_pcode, value);
                        }
                      });
                    }
                  }
                }
                
                // Aggregate ADM4 poverty rates to ADM3 (population-weighted if available, otherwise simple average)
                const adm3PovMap = new Map<string, { weightedSum: number; totalPop: number; count: number }>();
                
                povDataAdm4.forEach((row: any) => {
                  const adm3Code = adm4ToAdm3.get(row.admin_pcode);
                  if (adm3Code && adminPcodes.includes(adm3Code)) {
                    const povRate = Number(row.value);
                    if (!isNaN(povRate)) {
                      const adm4Pop = adm4PopMap.get(row.admin_pcode) || 0;
                      const current = adm3PovMap.get(adm3Code) || { weightedSum: 0, totalPop: 0, count: 0 };
                      
                      if (adm4Pop > 0) {
                        // Population-weighted: sum(pop * pov_rate) / sum(pop)
                        adm3PovMap.set(adm3Code, {
                          weightedSum: current.weightedSum + (adm4Pop * povRate),
                          totalPop: current.totalPop + adm4Pop,
                          count: current.count + 1,
                        });
                      } else {
                        // Simple average fallback
                        adm3PovMap.set(adm3Code, {
                          weightedSum: current.weightedSum + povRate,
                          totalPop: current.totalPop,
                          count: current.count + 1,
                        });
                      }
                    }
                  }
                });
                
                // Calculate weighted average poverty rate for each ADM3
                adm3PovMap.forEach((stats, code) => {
                  if (stats.totalPop > 0) {
                    // Population-weighted average
                    povertyMap.set(code, stats.weightedSum / stats.totalPop);
                  } else if (stats.count > 0) {
                    // Simple average fallback
                    povertyMap.set(code, stats.weightedSum / stats.count);
                  }
                });
              }
            }
          } else {
            console.warn(`Poverty dataset admin level ${povAdminLevel} not supported for aggregation`);
          }
        } else if (!povertyDataset) {
          console.warn('No poverty dataset found - PIN values will not be calculated');
        }

        // Map data to locations
        const locationsWithData = data.map((loc: any) => {
          const population = populationMap.get(loc.admin_pcode) ?? null;
          const povertyRate = povertyMap.get(loc.admin_pcode) ?? null;

          // Calculate People in Need = population * (poverty_rate / 100)
          let peopleInNeed: number | null = null;
          if (population !== null && povertyRate !== null) {
            peopleInNeed = Math.round(population * (povertyRate / 100));
          } else {
            // Debug logging for missing data
            if (population === null) {
              console.debug(`No population data for ${loc.name} (${loc.admin_pcode})`);
            }
            if (povertyRate === null) {
              console.debug(`No poverty rate data for ${loc.name} (${loc.admin_pcode})`);
            }
          }

          return {
            admin_pcode: loc.admin_pcode,
            name: loc.name || 'Unknown',
            avg_score: Number(loc.avg_score) || 0,
            population,
            people_in_need: peopleInNeed,
          };
        });
        
        // Log summary for debugging
        const locationsWithPIN = locationsWithData.filter(l => l.people_in_need !== null).length;
        console.log(`PIN calculation: ${locationsWithPIN}/${locationsWithData.length} locations have PIN values`);
        console.log(`Population data: ${locationsWithData.filter(l => l.population !== null).length}/${locationsWithData.length} locations have population`);
        console.log(`Poverty data: ${povertyMap.size} poverty rates found for ${adminPcodes.length} locations`);

        setLocations(locationsWithData);
      } catch (err: any) {
        console.error('Error loading vulnerable locations:', err);
        setError(err?.message || 'Failed to load vulnerable locations');
      } finally {
        setLoading(false);
      }
    };

    loadVulnerableLocations();
  }, [instanceId, refreshKey, showAll]); // Reload when instanceId, refreshKey, or showAll changes

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const getSeverityColor = (score: number): string => {
    if (score >= 4.5) return 'var(--gsc-red)';
    if (score >= 3.5) return 'var(--gsc-orange)';
    if (score >= 2.5) return '#FFCC00';
    if (score >= 1.5) return '#CCFF00';
    return '#00FF00';
  };

  if (loading) {
    return (
      <div className="border rounded p-2" style={{ backgroundColor: 'rgba(0, 75, 135, 0.02)', borderColor: 'var(--gsc-blue)' }}>
        <p className="text-xs" style={{ color: 'var(--gsc-gray)' }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded p-2" style={{ backgroundColor: 'rgba(99, 7, 16, 0.05)', borderColor: 'var(--gsc-red)' }}>
        <p className="text-xs" style={{ color: 'var(--gsc-red)' }}>{error}</p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="border rounded p-2" style={{ backgroundColor: 'rgba(0, 75, 135, 0.02)', borderColor: 'var(--gsc-blue)' }}>
        <p className="text-xs" style={{ color: 'var(--gsc-gray)' }}>No location scores available.</p>
      </div>
    );
  }

  const totalLocations = scoreDistribution 
    ? scoreDistribution.score1 + scoreDistribution.score2 + scoreDistribution.score3 + 
      scoreDistribution.score4 + scoreDistribution.score5 
    : 0;

  return (
    <div className="border rounded p-2" style={{ backgroundColor: 'rgba(0, 75, 135, 0.02)', borderColor: 'var(--gsc-blue)' }}>
      <div className="grid grid-cols-2 gap-2">
        {/* Left Column: Top Vulnerable Locations */}
        <div>
          <h3 className="font-semibold mb-1 text-xs" style={{ color: 'var(--gsc-blue)' }}>
            Top Vulnerable Locations
          </h3>
          <div className="space-y-0.5">
            {locations.map((location, index) => (
              <div
                key={location.admin_pcode}
                className="flex items-center gap-1 p-1 rounded border text-xs"
                style={{
                  backgroundColor: index < 3 ? 'rgba(99, 7, 16, 0.05)' : 'transparent',
                  borderColor: getSeverityColor(location.avg_score),
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                  style={{ backgroundColor: getSeverityColor(location.avg_score) }}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" style={{ color: 'var(--gsc-gray)' }}>
                    {location.name}
                  </div>
                  <div className="text-xs flex gap-1" style={{ color: 'var(--gsc-gray)' }}>
                    <span>Pop: {formatNumber(location.population)}</span>
                    <span style={{ color: 'var(--gsc-red)' }}>PiN: {formatNumber(location.people_in_need)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className="font-bold text-xs"
                    style={{ color: getSeverityColor(location.avg_score) }}
                  >
                    {location.avg_score.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {locations.length >= 5 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-1 w-full py-0.5 px-1 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--gsc-blue)',
                color: '#fff',
              }}
            >
              View More ({locations.length} total)
            </button>
          )}
        </div>

        {/* Right Column: Score Distribution & Stats */}
        <div>
          <h3 className="font-semibold mb-1 text-xs" style={{ color: 'var(--gsc-blue)' }}>
            Score Distribution
          </h3>
          {scoreDistribution && totalLocations > 0 ? (
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center justify-between p-0.5 rounded border" style={{ backgroundColor: '#f0fdf4', borderColor: '#00FF00' }}>
                <span className="font-medium" style={{ color: 'var(--gsc-gray)' }}>Score 1 (Low):</span>
                <span className="font-semibold" style={{ color: '#15803d' }}>{scoreDistribution.score1} ({((scoreDistribution.score1 / totalLocations) * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center justify-between p-0.5 rounded border" style={{ backgroundColor: '#fefce8', borderColor: '#CCFF00' }}>
                <span className="font-medium" style={{ color: 'var(--gsc-gray)' }}>Score 2:</span>
                <span className="font-semibold" style={{ color: '#a3a000' }}>{scoreDistribution.score2} ({((scoreDistribution.score2 / totalLocations) * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center justify-between p-0.5 rounded border" style={{ backgroundColor: '#fffbeb', borderColor: '#FFCC00' }}>
                <span className="font-medium" style={{ color: 'var(--gsc-gray)' }}>Score 3:</span>
                <span className="font-semibold" style={{ color: '#d97706' }}>{scoreDistribution.score3} ({((scoreDistribution.score3 / totalLocations) * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center justify-between p-0.5 rounded border" style={{ backgroundColor: '#fff7ed', borderColor: 'var(--gsc-orange)' }}>
                <span className="font-medium" style={{ color: 'var(--gsc-gray)' }}>Score 4:</span>
                <span className="font-semibold" style={{ color: 'var(--gsc-orange)' }}>{scoreDistribution.score4} ({((scoreDistribution.score4 / totalLocations) * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center justify-between p-0.5 rounded border" style={{ backgroundColor: '#fef2f2', borderColor: 'var(--gsc-red)' }}>
                <span className="font-medium" style={{ color: 'var(--gsc-gray)' }}>Score 5 (Critical):</span>
                <span className="font-semibold" style={{ color: 'var(--gsc-red)' }}>{scoreDistribution.score5} ({((scoreDistribution.score5 / totalLocations) * 100).toFixed(0)}%)</span>
              </div>
              <div className="mt-1 pt-1 border-t" style={{ borderColor: 'var(--gsc-blue)' }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--gsc-gray)' }}>Total Locations:</span>
                  <span className="font-semibold" style={{ color: 'var(--gsc-blue)' }}>{totalLocations}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--gsc-gray)' }}>High Severity (≥4):</span>
                  <span className="font-semibold" style={{ color: 'var(--gsc-orange)' }}>
                    {scoreDistribution.score4 + scoreDistribution.score5} ({(((scoreDistribution.score4 + scoreDistribution.score5) / totalLocations) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--gsc-gray)' }}>No distribution data</p>
          )}
        </div>
      </div>
    </div>
  );
}
