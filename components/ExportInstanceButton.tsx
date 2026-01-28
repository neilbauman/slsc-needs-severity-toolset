'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

interface Props {
  instanceId: string;
  instanceName: string;
}

interface LocationData {
  admin_pcode: string;
  name: string;
  overall_score: number | null;
  population: number | null;
  poverty_rate: number | null;
  people_in_need: number | null;
}

export default function ExportInstanceButton({ instanceId, instanceName }: Props) {
  const supabase = createClient();
  
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const exportData = async () => {
    setExporting(true);
    setProgress('Loading instance data...');
    
    try {
      // 1. Get instance configuration
      const { data: instanceData, error: instanceError } = await supabase
        .from('instances')
        .select('population_dataset_id, admin_scope, country_id')
        .eq('id', instanceId)
        .single();

      if (instanceError) throw instanceError;

      // 2. Get affected ADM3 codes
      setProgress('Getting affected areas...');
      let affectedCodes: string[] = [];
      
      if (instanceData?.admin_scope && Array.isArray(instanceData.admin_scope) && instanceData.admin_scope.length > 0) {
        const CHUNK_SIZE = 2000;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: affectedData, error: affectedError } = await supabase.rpc('get_affected_adm3', {
            in_scope: instanceData.admin_scope,
            in_limit: CHUNK_SIZE,
            in_offset: offset,
          });

          if (affectedError) {
            console.error('Error getting affected ADM3 codes:', affectedError);
            break;
          }

          if (!affectedData || affectedData.length === 0) {
            hasMore = false;
            break;
          }

          const codes = affectedData.map((item: any) => 
            typeof item === 'string' ? item : (item.admin_pcode || item.pcode || item.code)
          ).filter(Boolean);
          
          affectedCodes = [...affectedCodes, ...codes];

          if (affectedData.length < CHUNK_SIZE) {
            hasMore = false;
          } else {
            offset += affectedData.length;
          }
        }
      }

      if (affectedCodes.length === 0) {
        throw new Error('No affected areas found for this instance');
      }

      setProgress(`Loading scores for ${affectedCodes.length} locations...`);

      // 3. Get overall scores for affected areas
      const { data: scoresData, error: scoresError } = await supabase
        .from('v_instance_admin_scores')
        .select('admin_pcode, name, avg_score')
        .eq('instance_id', instanceId)
        .in('admin_pcode', affectedCodes);

      if (scoresError) throw scoresError;

      // Create a map of scores
      const scoreMap = new Map<string, { name: string; score: number | null }>();
      (scoresData || []).forEach((s: any) => {
        scoreMap.set(s.admin_pcode, {
          name: s.name || '',
          score: s.avg_score !== null ? Number(s.avg_score) : null
        });
      });

      // Get admin names for locations without scores
      const codesWithoutNames = affectedCodes.filter(code => !scoreMap.has(code));
      if (codesWithoutNames.length > 0) {
        const { data: adminNames } = await supabase
          .from('admin_boundaries')
          .select('admin_pcode, name')
          .in('admin_pcode', codesWithoutNames);
        
        (adminNames || []).forEach((a: any) => {
          if (!scoreMap.has(a.admin_pcode)) {
            scoreMap.set(a.admin_pcode, { name: a.name || '', score: null });
          }
        });
      }

      // 4. Get population data
      setProgress('Loading population data...');
      const populationMap = new Map<string, number>();
      
      // Auto-detect population dataset if not set on instance
      let populationDatasetId = instanceData?.population_dataset_id;
      if (!populationDatasetId && instanceData?.country_id) {
        const { data: autoPopDataset } = await supabase
          .from('datasets')
          .select('id, admin_level, name')
          .or('name.ilike.%population%,name.ilike.%pop%')
          .eq('type', 'numeric')
          .eq('country_id', instanceData.country_id)
          .in('admin_level', ['ADM3', 'ADM4'])
          .order('name', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (autoPopDataset) {
          populationDatasetId = autoPopDataset.id;
        }
      }

      if (populationDatasetId) {
        // Get population dataset admin level
        const { data: popDataset } = await supabase
          .from('datasets')
          .select('admin_level')
          .eq('id', populationDatasetId)
          .single();

        const popAdminLevel = popDataset?.admin_level?.toUpperCase();

        if (popAdminLevel === 'ADM3') {
          // Direct ADM3 match
          const { data: popData } = await supabase
            .from('dataset_values_numeric')
            .select('admin_pcode, value')
            .eq('dataset_id', populationDatasetId)
            .in('admin_pcode', affectedCodes);
          
          (popData || []).forEach((row: any) => {
            const value = Number(row.value);
            if (!isNaN(value)) {
              populationMap.set(row.admin_pcode, value);
            }
          });
        } else if (popAdminLevel === 'ADM4') {
          // Aggregate ADM4 to ADM3
          const { data: boundaries } = await supabase
            .from('admin_boundaries')
            .select('admin_pcode, parent_pcode')
            .in('parent_pcode', affectedCodes)
            .eq('admin_level', 'ADM4');
          
          if (boundaries && boundaries.length > 0) {
            const adm4Codes = boundaries.map((b: any) => b.admin_pcode);
            
            const { data: popData } = await supabase
              .from('dataset_values_numeric')
              .select('admin_pcode, value')
              .eq('dataset_id', populationDatasetId)
              .in('admin_pcode', adm4Codes);
            
            if (popData) {
              const adm4ToAdm3 = new Map(boundaries.map((b: any) => [b.admin_pcode, b.parent_pcode]));
              
              popData.forEach((row: any) => {
                const adm3Code = adm4ToAdm3.get(row.admin_pcode);
                if (adm3Code && affectedCodes.includes(adm3Code)) {
                  const value = Number(row.value);
                  if (!isNaN(value) && value > 0) {
                    const current = populationMap.get(adm3Code) || 0;
                    populationMap.set(adm3Code, current + value);
                  }
                }
              });
            }
          }
        }
      }

      // 5. Get poverty data
      setProgress('Loading poverty data...');
      const povertyMap = new Map<string, number>();

      // Find poverty dataset
      let povertyDataset: any = null;
      const searchPatterns = ['%poverty%', '%pov%', '%poor%'];
      for (const pattern of searchPatterns) {
        let query = supabase
          .from('datasets')
          .select('id, admin_level, name')
          .ilike('name', pattern)
          .eq('type', 'numeric');
        
        if (instanceData?.country_id) {
          query = query.eq('country_id', instanceData.country_id);
        }
        
        const { data, error } = await query.limit(1).maybeSingle();
        
        if (!error && data) {
          povertyDataset = data;
          break;
        }
      }

      if (povertyDataset) {
        const povAdminLevel = povertyDataset.admin_level?.toUpperCase();
        
        if (povAdminLevel === 'ADM3') {
          const { data: povData } = await supabase
            .from('dataset_values_numeric')
            .select('admin_pcode, value')
            .eq('dataset_id', povertyDataset.id)
            .in('admin_pcode', affectedCodes);
          
          (povData || []).forEach((row: any) => {
            const value = Number(row.value);
            if (!isNaN(value)) {
              povertyMap.set(row.admin_pcode, value);
            }
          });
        } else if (povAdminLevel === 'ADM4') {
          // Aggregate ADM4 poverty to ADM3 using weighted average
          const { data: boundaries } = await supabase
            .from('admin_boundaries')
            .select('admin_pcode, parent_pcode')
            .in('parent_pcode', affectedCodes)
            .eq('admin_level', 'ADM4');
          
          if (boundaries && boundaries.length > 0) {
            const adm4Codes = boundaries.map((b: any) => b.admin_pcode);
            
            const { data: povData } = await supabase
              .from('dataset_values_numeric')
              .select('admin_pcode, value')
              .eq('dataset_id', povertyDataset.id)
              .in('admin_pcode', adm4Codes);
            
            if (povData) {
              const adm4ToAdm3 = new Map(boundaries.map((b: any) => [b.admin_pcode, b.parent_pcode]));
              const adm3PovMap = new Map<string, { sum: number; count: number }>();
              
              povData.forEach((row: any) => {
                const adm3Code = adm4ToAdm3.get(row.admin_pcode);
                if (adm3Code && affectedCodes.includes(adm3Code)) {
                  const value = Number(row.value);
                  if (!isNaN(value)) {
                    const current = adm3PovMap.get(adm3Code) || { sum: 0, count: 0 };
                    adm3PovMap.set(adm3Code, {
                      sum: current.sum + value,
                      count: current.count + 1,
                    });
                  }
                }
              });
              
              adm3PovMap.forEach((stats, code) => {
                if (stats.count > 0) {
                  povertyMap.set(code, stats.sum / stats.count);
                }
              });
            }
          }
        }
      }

      // 6. Build the export data
      setProgress('Building export data...');
      const locations: LocationData[] = affectedCodes.map(code => {
        const scoreData = scoreMap.get(code);
        const population = populationMap.get(code) ?? null;
        const povertyRate = povertyMap.get(code) ?? null;
        
        // Calculate PIN = population × (poverty_rate / 100)
        let peopleInNeed: number | null = null;
        if (population !== null && povertyRate !== null) {
          peopleInNeed = Math.round(population * (povertyRate / 100));
        }

        return {
          admin_pcode: code,
          name: scoreData?.name || '',
          overall_score: scoreData?.score ?? null,
          population,
          poverty_rate: povertyRate,
          people_in_need: peopleInNeed,
        };
      });

      // Sort by overall score (highest first), then by name
      locations.sort((a, b) => {
        if (a.overall_score === null && b.overall_score === null) return a.name.localeCompare(b.name);
        if (a.overall_score === null) return 1;
        if (b.overall_score === null) return -1;
        return b.overall_score - a.overall_score;
      });

      // 7. Export as CSV
      setProgress('Generating CSV...');
      exportAsCsv(locations);

    } catch (err: any) {
      console.error('Export error:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
      setProgress('');
    }
  };

  const exportAsCsv = (locations: LocationData[]) => {
    const headers = [
      'Admin Code',
      'Admin Name',
      'Overall Score',
      'Population',
      'Poverty Rate (%)',
      'People in Need (PIN)',
    ];
    
    const rows = locations.map(loc => [
      loc.admin_pcode,
      `"${(loc.name || '').replace(/"/g, '""')}"`,
      loc.overall_score !== null ? loc.overall_score.toFixed(2) : '',
      loc.population !== null ? Math.round(loc.population).toString() : '',
      loc.poverty_rate !== null ? loc.poverty_rate.toFixed(2) : '',
      loc.people_in_need !== null ? loc.people_in_need.toString() : '',
    ]);

    // Add summary rows
    const totalPopulation = locations.reduce((sum, loc) => sum + (loc.population || 0), 0);
    const totalPIN = locations.reduce((sum, loc) => sum + (loc.people_in_need || 0), 0);
    const avgScore = locations.filter(l => l.overall_score !== null).length > 0
      ? locations.filter(l => l.overall_score !== null).reduce((sum, l) => sum + (l.overall_score || 0), 0) / locations.filter(l => l.overall_score !== null).length
      : null;
    const areasOfConcern = locations.filter(l => l.overall_score !== null && l.overall_score >= 3).length;
    const locationsWithScores = locations.filter(l => l.overall_score !== null).length;

    const csv = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
      '', // Empty line before summary
      '--- Summary ---',
      `Total Locations,${locations.length}`,
      `Locations with Scores,${locationsWithScores}`,
      `Areas of Concern (Score >= 3),${areasOfConcern}`,
      `Average Overall Score,${avgScore !== null ? avgScore.toFixed(2) : 'N/A'}`,
      `Total Population,${Math.round(totalPopulation)}`,
      `Total People in Need,${Math.round(totalPIN)}`,
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `${sanitizeFilename(instanceName)}_adm3_scores.csv`);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sanitizeFilename = (name: string) => {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  };

  return (
    <button
      onClick={exportData}
      disabled={exporting}
      className="btn btn-secondary flex items-center gap-1"
      title="Export ADM3 scores and PIN data as CSV"
    >
      {exporting ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs">{progress || 'Exporting...'}</span>
        </>
      ) : (
        <>
          <FileSpreadsheet size={16} />
          Export CSV
        </>
      )}
    </button>
  );
}
