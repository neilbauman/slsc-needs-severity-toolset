'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchHazardEventScores } from '@/lib/fetchHazardEventScoresClient';
import { AGGREGATION_METHODS, AggregationMethod, recommendMethod, getMethodById } from '@/lib/aggregationMethods';

// Slider styles
const sliderStyles = `
  <style>
    input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--gsc-gray);
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    input[type="range"]::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--gsc-gray);
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    input[type="range"]:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
`;

interface InstanceScoringModalProps {
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function InstanceScoringModal({
  instance,
  onClose,
  onSaved,
}: InstanceScoringModalProps) {
  type CategoryData = { name: string; datasets: any[]; categoryWeight: number };
  type ImpactLocation = {
    admin_pcode: string;
    admin_name: string;
    currentScore: number;
    projectedScore: number;
    change: number;
    rank: number;
  };
  
  const [categories, setCategories] = useState<Record<string, CategoryData>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<'mean' | 'weighted_mean' | 'compounding_hazards' | '20_percent' | 'custom'>(
    'weighted_mean'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImpact, setShowImpact] = useState(true);
  const [impactLocations, setImpactLocations] = useState<ImpactLocation[]>([]);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [currentScores, setCurrentScores] = useState<Record<string, number>>({});
  const [isNormalizing, setIsNormalizing] = useState(false); // Lock to prevent UI jumping
  const [overallMethod, setOverallMethod] = useState<string>('weighted_mean'); // Overall aggregation method
  const [showMethodComparison, setShowMethodComparison] = useState(false);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [showMethodGuidance, setShowMethodGuidance] = useState(false);
  const [weightInputMode, setWeightInputMode] = useState<'slider' | 'number' | 'percentage'>('slider');

  const CATEGORY_ORDER = [
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Hazard',
    'Underlying Vulnerability',
  ];

  // Snap to nearest multiple of 5
  const snapToStep = (value: number, step = 5) => Math.round(value / step) * step;

  // Normalize dataset weights within a category (only on release, less aggressive)
  const normalizeCategory = useCallback((cat: string) => {
    if (isNormalizing) return; // Prevent re-entry during normalization
    
    setIsNormalizing(true);
    
    // Use requestAnimationFrame to normalize after current render cycle
    requestAnimationFrame(() => {
      const categoryData = categories[cat] as CategoryData;
      if (!categoryData) {
        setIsNormalizing(false);
        return;
      }
      
      const ds = categoryData.datasets;
    const total = ds.reduce((sum, d) => sum + (weights[d.id] || 0), 0);
      
      if (total === 0) {
        // If total is 0, distribute equally
        const equalWeight = 100 / ds.length;
        const newWeights = { ...weights };
        ds.forEach((d) => {
          newWeights[d.id] = Math.round(equalWeight);
        });
        setWeights(newWeights);
        setIsNormalizing(false);
        return;
      }

      // Only normalize if total is significantly off from 100% (more than 2%)
      // This allows users to adjust weights freely as long as they're reasonably close
      if (Math.abs(total - 100) < 2) {
        // Close to 100%, just make minor adjustment to exact 100%
        const scale = 100 / total;
    const newWeights = { ...weights };
        let sum = 0;
        
        ds.forEach((d) => {
          const scaled = (weights[d.id] || 0) * scale;
          // Round to whole number (1% precision)
          newWeights[d.id] = Math.round(scaled);
          sum += newWeights[d.id];
        });
        
        // Adjust for any rounding differences (add/subtract from largest)
        const diff = 100 - sum;
        if (Math.abs(diff) >= 1 && ds.length > 0) {
          const largest = ds.reduce((a, b) =>
            (newWeights[a.id] || 0) > (newWeights[b.id] || 0) ? a : b
          );
          newWeights[largest.id] = Math.max(0, Math.min(100, Math.round(newWeights[largest.id] + diff)));
        }
        
        setWeights(newWeights);
        setIsNormalizing(false);
        return;
      }

      // If total is far from 100%, normalize proportionally but preserve relative ratios
      const newWeights = { ...weights };
      const scale = 100 / total;

    let sum = 0;
    ds.forEach((d) => {
        const normalized = (weights[d.id] || 0) * scale;
        // Round to whole number (1% precision)
        newWeights[d.id] = Math.round(normalized);
      sum += newWeights[d.id];
    });

      // Adjust for rounding (add/subtract from largest)
    const diff = 100 - sum;
      if (Math.abs(diff) >= 1 && ds.length > 0) {
      const largest = ds.reduce((a, b) =>
        (newWeights[a.id] || 0) > (newWeights[b.id] || 0) ? a : b
      );
        newWeights[largest.id] = Math.max(0, Math.min(100, Math.round(newWeights[largest.id] + diff)));
    }

    setWeights(newWeights);
      setIsNormalizing(false);
    });
  }, [categories, weights, isNormalizing]);

  // Normalize all category weights (only on release, less aggressive)
  const normalizeAllCategories = useCallback(() => {
    if (isNormalizing) return; // Prevent re-entry during normalization
    
    setIsNormalizing(true);
    
    // Use requestAnimationFrame to normalize after current render cycle
    requestAnimationFrame(() => {
      const categoryValues = Object.values(categories) as CategoryData[];
      const total = categoryValues.reduce((sum, catData) => {
        return sum + (catData.categoryWeight || 0);
      }, 0);
      
      if (total === 0) {
        setIsNormalizing(false);
        return;
      }

      // Only normalize if significantly off (more than 2%)
      if (Math.abs(total - 100) < 2) {
        // Close to 100%, just make minor adjustment
        const scale = 100 / total;
        const newCats: Record<string, CategoryData> = { ...categories };
    let sum = 0;

    Object.keys(newCats).forEach((cat) => {
          const catData = newCats[cat] as CategoryData;
          const currentWeight = catData.categoryWeight || 0;
          // Round to whole number (1% precision)
          catData.categoryWeight = Math.round(currentWeight * scale);
          sum += catData.categoryWeight;
        });

        // Adjust for rounding
        const diff = 100 - sum;
        if (Math.abs(diff) >= 1) {
          const largestCat = Object.keys(newCats).reduce((a, b) => {
            const aData = newCats[a] as CategoryData;
            const bData = newCats[b] as CategoryData;
            return aData.categoryWeight > bData.categoryWeight ? a : b;
          });
          const largestCatData = newCats[largestCat] as CategoryData;
          largestCatData.categoryWeight = Math.max(
            0,
            Math.min(100, Math.round(largestCatData.categoryWeight + diff))
          );
        }

        setCategories(newCats);
        setIsNormalizing(false);
        return;
      }

      // If far from 100%, normalize proportionally
      const newCats: Record<string, CategoryData> = { ...categories };
      const scale = 100 / total;
      let sum = 0;

      Object.keys(newCats).forEach((cat) => {
        const catData = newCats[cat] as CategoryData;
        const currentWeight = catData.categoryWeight || 0;
        // Round to whole number (1% precision)
        catData.categoryWeight = Math.round(currentWeight * scale);
        sum += catData.categoryWeight;
    });

      // Adjust for rounding
    const diff = 100 - sum;
      if (Math.abs(diff) >= 1) {
        const largestCat = Object.keys(newCats).reduce((a, b) => {
          const aData = newCats[a] as CategoryData;
          const bData = newCats[b] as CategoryData;
          return aData.categoryWeight > bData.categoryWeight ? a : b;
        });
        const largestCatData = newCats[largestCat] as CategoryData;
        largestCatData.categoryWeight = Math.max(
        0,
          Math.min(100, Math.round(largestCatData.categoryWeight + diff))
      );
    }

    setCategories(newCats);
      setIsNormalizing(false);
    });
  }, [categories, isNormalizing]);

  const handleWeightChange = (datasetId: string, value: number) => {
    const newValue = Math.max(0, Math.min(100, value));
    setWeights((prev) => ({ ...prev, [datasetId]: newValue }));
  };

  const handleCategoryWeightChange = (cat: string, value: number) => {
    const updated = { ...categories };
    updated[cat].categoryWeight = Math.max(0, value);
    setCategories(updated);
  };

  // Load datasets and weights
  useEffect(() => {
    if (!instance?.id) return;
    const load = async () => {
      const { data: datasets, error: dsErr } = await supabase
        .from('instance_datasets')
        .select('dataset_id, datasets (id, name, category)')
        .eq('instance_id', instance.id);

      if (dsErr) {
        console.error('Dataset load error:', dsErr);
        return;
      }

      const flat = (datasets || []).map((d: any) => ({
        id: d.datasets.id,
        name: d.datasets.name,
        category: d.datasets.category || 'Uncategorized',
        is_hazard_event: false,
      }));

      // Load hazard events and add them to the Hazard category
      const { data: hazardEventsData, error: hazardError } = await supabase
        .rpc('get_hazard_events_for_instance', { in_instance_id: instance.id });

      if (!hazardError && hazardEventsData && hazardEventsData.length > 0) {
        const hazardEventDatasets = hazardEventsData.map((event: any) => ({
          id: `hazard_event_${event.id}`, // Prefix to distinguish from regular datasets
          name: event.name,
          category: 'Hazard',
          is_hazard_event: true,
          hazard_event_id: event.id,
        }));
        flat.push(...hazardEventDatasets);
        console.log('Loaded hazard events:', hazardEventDatasets.map((d: any) => d.name));
      }

      const { data: savedWeights } = await supabase
        .from('instance_scoring_weights')
        .select('*')
        .eq('instance_id', instance.id);

      const weightMap: Record<string, number> = {};
      (savedWeights || []).forEach((w: any) => {
        // Map saved weights by dataset_id (UUID)
        weightMap[w.dataset_id] = (w.dataset_weight ?? 0) * 100;
      });

      // Also load hazard event weights from metadata if available
      if (!hazardError && hazardEventsData && hazardEventsData.length > 0) {
        hazardEventsData.forEach((event: any) => {
          const hazardEventId = `hazard_event_${event.id}`;
          // Check if weight is stored in metadata
          if (event.metadata?.weight) {
            weightMap[hazardEventId] = (event.metadata.weight ?? 0) * 100;
          }
        });
      }

      const grouped: Record<string, CategoryData> = {};
      for (const d of flat) {
        const cat = d.category;
        if (!grouped[cat]) grouped[cat] = { name: cat, datasets: [], categoryWeight: 1 };
        grouped[cat].datasets.push(d);
      }

      const sorted = Object.fromEntries(
        Object.entries(grouped).sort((a, b) => {
          const ai = CATEGORY_ORDER.indexOf(a[0]);
          const bi = CATEGORY_ORDER.indexOf(b[0]);
          if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        })
      );

      // Load category weights from saved data
      const categoryWeightMap: Record<string, number> = {};
      const numCats = Object.keys(sorted).length;
      
      // Load category weights from saved weights (any dataset in the category will have the same category_weight)
      (savedWeights || []).forEach((w: any) => {
        if (w.category && w.category_weight !== undefined && w.category_weight !== null) {
          // Store as percentage (0-100)
          categoryWeightMap[w.category] = (w.category_weight ?? 0) * 100;
        }
      });
      
      // Also check hazard events for category weights
      if (!hazardError && hazardEventsData && hazardEventsData.length > 0) {
        hazardEventsData.forEach((event: any) => {
          if (event.metadata?.category_weight !== undefined) {
            categoryWeightMap['Hazard'] = (event.metadata.category_weight ?? 0) * 100;
          }
        });
      }

      // Initialize category weights - use saved values or equal distribution
      Object.keys(sorted).forEach((cat) => {
        if (categoryWeightMap[cat] !== undefined) {
          sorted[cat].categoryWeight = categoryWeightMap[cat];
        } else {
          // Default to equal distribution if not saved
        sorted[cat].categoryWeight = 100 / numCats;
        }
        
        const numDs = sorted[cat].datasets.length;
        sorted[cat].datasets.forEach((d) => {
          if (!weightMap[d.id]) weightMap[d.id] = numDs > 0 ? 100 / numDs : 0;
        });
      });
      
      // Normalize category weights to ensure they sum to 100%
      const totalCategoryWeight = Object.values(sorted).reduce((sum, catData) => {
        return sum + (catData.categoryWeight || 0);
      }, 0);
      
      if (totalCategoryWeight > 0 && Math.abs(totalCategoryWeight - 100) > 0.1) {
        // Normalize to 100%
        Object.keys(sorted).forEach((cat) => {
          sorted[cat].categoryWeight = (sorted[cat].categoryWeight / totalCategoryWeight) * 100;
        });
      }

      setCategories(sorted);
      setWeights(weightMap);
      
      // Load saved overall aggregation method from instance metadata
      if (instance.metadata?.aggregation_method) {
        setOverallMethod(instance.metadata.aggregation_method);
      } else {
        // Auto-recommend method based on data characteristics
        const hasMultipleHazards = hazardEventsData && hazardEventsData.length > 1;
        const recommended = recommendMethod({
          hasMultipleHazards,
          hasExtremeScores: false, // Could analyze scores if needed
          isBalanced: true, // Default assumption
        });
        setOverallMethod(recommended);
      }
      
      // Load current scores for impact preview
      loadImpactPreview();
    };
    load();
  }, [instance]);

  // Calculate impact preview when weights change (debounced to avoid too many calls)
  useEffect(() => {
    if (showImpact && Object.keys(categories).length > 0 && Object.keys(weights).length > 0 && Object.keys(currentScores).length > 0) {
      // Debounce the calculation to avoid excessive API calls while sliding
      const timeoutId = setTimeout(() => {
        calculateImpactPreview();
      }, 500); // Wait 500ms after last change

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, weights, showImpact, currentScores]);

  // Load current scores for impact calculation (only affected areas)
  const loadImpactPreview = async () => {
    if (!instance?.id) return;
    try {
      // Get affected ADM3 codes first
      let affectedCodes: string[] = [];
      const { data: instanceData } = await supabase
        .from('instances')
        .select('admin_scope')
        .eq('id', instance.id)
        .single();

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

      // Only load scores for affected areas
      let scoresQuery = supabase
        .from('v_instance_admin_scores')
        .select('admin_pcode, avg_score, name')
        .eq('instance_id', instance.id)
        .not('avg_score', 'is', null);

      if (affectedCodes.length > 0) {
        scoresQuery = scoresQuery.in('admin_pcode', affectedCodes);
      }

      const { data: scoresData } = await scoresQuery
        .order('avg_score', { ascending: false })
        .limit(20);

      if (scoresData) {
        const scoreMap: Record<string, number> = {};
        scoresData.forEach((s: any) => {
          scoreMap[s.admin_pcode] = Number(s.avg_score);
        });
        setCurrentScores(scoreMap);
      }
    } catch (err) {
      console.error('Error loading current scores:', err);
    }
  };

  // Calculate projected scores based on current weights
  const calculateImpactPreview = async () => {
    if (!instance?.id || Object.keys(categories).length === 0) return;
    
    setLoadingImpact(true);
    try {
      // Get sample locations (top 10 by current score)
      const topLocations = Object.entries(currentScores)
        .sort(([, a], [, b]) => {
          const aVal = Number(a) || 0;
          const bVal = Number(b) || 0;
          return bVal - aVal;
        })
        .slice(0, 10)
        .map(([pcode]) => pcode);

      if (topLocations.length === 0) {
        setImpactLocations([]);
        setLoadingImpact(false);
        return;
      }

      // Load dataset scores for these locations
      const datasetIds = Object.values(categories)
        .flatMap((cat: CategoryData) => cat.datasets.map((d: any) => d.id))
        .filter((id: string) => !id.startsWith('hazard_event_'));

      const hazardEventIds = Object.values(categories)
        .flatMap((cat: CategoryData) => 
          cat.datasets
            .filter((d: any) => d.is_hazard_event && d.hazard_event_id)
            .map((d: any) => d.hazard_event_id)
        );

      // Load dataset scores
      const datasetScores: Record<string, Record<string, number>> = {};
      if (datasetIds.length > 0) {
        const { data: scoresData } = await supabase
          .from('instance_dataset_scores')
          .select('dataset_id, admin_pcode, score')
          .eq('instance_id', instance.id)
          .in('dataset_id', datasetIds)
          .in('admin_pcode', topLocations);

        (scoresData || []).forEach((s: any) => {
          if (!datasetScores[s.admin_pcode]) {
            datasetScores[s.admin_pcode] = {};
          }
          datasetScores[s.admin_pcode][s.dataset_id] = Number(s.score);
        });
      }

      // Load hazard event scores
      if (hazardEventIds.length > 0) {
        try {
          const hazardScores = await fetchHazardEventScores({
            instanceId: instance.id,
            hazardEventIds,
            adminPcodes: topLocations,
          });

          (hazardScores || []).forEach((s: any) => {
            if (!datasetScores[s.admin_pcode]) {
              datasetScores[s.admin_pcode] = {};
            }
            datasetScores[s.admin_pcode][`hazard_event_${s.hazard_event_id}`] = Number(s.score);
          });
        } catch (error) {
          console.error('Error loading hazard event scores for impact preview:', error);
        }
      }

      // Calculate projected scores
      const impacts: ImpactLocation[] = [];
      
      for (const adminPcode of topLocations) {
        const currentScore = currentScores[adminPcode] || 0;
        
        // Calculate category scores with current weights
        const categoryScores: Record<string, number> = {};
        
        for (const [cat, catData] of Object.entries(categories)) {
          const categoryData = catData as CategoryData;
          const categoryDatasets = categoryData.datasets;
          const categoryWeight = categoryData.categoryWeight / 100;
          
          // Calculate weighted average for this category
          let categoryTotal = 0;
          let categoryWeightSum = 0;
          
          categoryDatasets.forEach((d: any) => {
            const datasetScore = datasetScores[adminPcode]?.[d.id];
            if (datasetScore !== undefined) {
              const datasetWeight = (weights[d.id] || 0) / 100;
              categoryTotal += datasetScore * datasetWeight;
              categoryWeightSum += datasetWeight;
            }
          });
          
          if (categoryWeightSum > 0) {
            categoryScores[cat] = (categoryTotal / categoryWeightSum) * categoryWeight;
          }
        }

        // Calculate overall projected score (sum of category scores)
        const projectedScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);
        
        // Get admin name - use the name from v_instance_admin_scores if available, otherwise fetch
        let adminName = adminPcode;
        const scoreData = await supabase
          .from('v_instance_admin_scores')
          .select('name')
          .eq('instance_id', instance.id)
          .eq('admin_pcode', adminPcode)
          .limit(1)
          .single();
        
        if (scoreData.data?.name) {
          adminName = scoreData.data.name;
        } else {
          // Fallback: try admin_boundaries with proper column names
          const { data: adminData } = await supabase
            .from('admin_boundaries')
            .select('admin_name, name')
            .eq('admin_pcode', adminPcode)
            .eq('admin_level', 'ADM3')
            .limit(1)
            .maybeSingle();
          
          if (adminData) {
            adminName = adminData.admin_name || adminData.name || adminPcode;
          }
        }

        impacts.push({
          admin_pcode: adminPcode,
          admin_name: adminName,
          currentScore,
          projectedScore,
          change: projectedScore - currentScore,
          rank: 0, // Will set after sorting
        });
      }

      // Sort by projected score and assign ranks
      impacts.sort((a, b) => {
        const aScore = Number(a.projectedScore) || 0;
        const bScore = Number(b.projectedScore) || 0;
        return bScore - aScore;
      });
      impacts.forEach((impact, idx) => {
        impact.rank = idx + 1;
      });

      setImpactLocations(impacts);
    } catch (err) {
      console.error('Error calculating impact preview:', err);
    } finally {
      setLoadingImpact(false);
    }
  };

  // Handle method comparison
  const handleCompareMethods = async () => {
    if (!instance?.id) return;
    
    setLoadingComparison(true);
    setShowMethodComparison(true);
    setError(null);
    
    try {
      // First, calculate all methods
      const { error: calcError } = await supabase.rpc('score_final_aggregate_all_methods', {
        in_instance_id: instance.id
      });
      
      if (calcError) {
        console.error('Error calculating methods:', calcError);
        // Check if function doesn't exist
        if (calcError.message?.includes('Could not find the function') || calcError.code === 'PGRST202') {
          setError(
            `Database function not found. Please deploy the SQL functions to your Supabase database:\n\n` +
            `1. Open Supabase SQL Editor\n` +
            `2. Run: supabase/create_instance_category_scores_comparison_table.sql\n` +
            `3. Run: supabase/score_final_aggregate_all_methods.sql\n` +
            `4. Run: supabase/get_method_comparison.sql\n\n` +
            `See docs/HOW_TO_APPLY_RPC_FUNCTION.md for detailed instructions.`
          );
        } else {
          setError(`Error calculating comparison: ${calcError.message}`);
        }
        setLoadingComparison(false);
        return;
      }
      
      // Then fetch comparison data
      const { data, error: fetchError } = await supabase.rpc('get_method_comparison', {
        in_instance_id: instance.id,
        in_category: 'Overall',
        in_limit: 20
      });
      
      if (fetchError) {
        console.error('Error fetching comparison:', fetchError);
        if (fetchError.message?.includes('Could not find the function') || fetchError.code === 'PGRST202') {
          setError(
            `Database function not found. Please deploy get_method_comparison function to your Supabase database.`
          );
        } else {
          setError(`Error fetching comparison: ${fetchError.message}`);
        }
      } else {
        setComparisonData(data || []);
        if (data && data.length === 0) {
          setError('No comparison data available. Make sure scores have been calculated first.');
        }
      }
    } catch (err: any) {
      console.error('Error in method comparison:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoadingComparison(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      for (const [cat, obj] of Object.entries(categories)) {
        const categoryData = obj as CategoryData;
        for (const d of categoryData.datasets) {
          const weightDecimal = (weights[d.id] || 0) / 100;
          const catDecimal = (categoryData.categoryWeight || 0) / 100;

          // Handle hazard events differently - they don't have a dataset_id UUID
          if (d.is_hazard_event && d.hazard_event_id) {
            // Store weight in hazard_events metadata instead
            // First get current metadata
            const { data: currentEvent } = await supabase
              .from('hazard_events')
              .select('metadata')
              .eq('id', d.hazard_event_id)
              .single();
            
            const currentMetadata = currentEvent?.metadata || {};
            const { error: hazardError } = await supabase
              .from('hazard_events')
              .update({
                metadata: {
                  ...currentMetadata,
                  weight: weightDecimal,
                  category_weight: catDecimal,
                }
              })
              .eq('id', d.hazard_event_id);
            
            if (hazardError) {
              console.error('Save hazard event weight error:', hazardError);
            }
          } else {
            // Regular datasets - save to instance_scoring_weights
            // Only save if d.id is a valid UUID (not a hazard event prefixed ID)
            try {
              // Try to parse as UUID to validate
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              if (uuidRegex.test(d.id)) {
          const { error } = await supabase.from('instance_scoring_weights').upsert({
            instance_id: instance.id,
            dataset_id: d.id,
            category: cat,
            dataset_weight: weightDecimal,
            category_weight: catDecimal,
            updated_at: new Date().toISOString(),
          });
          if (error) console.error('Save weight error:', error);
        }
            } catch (err) {
              console.error('Error saving weight for dataset:', d.id, err);
            }
          }
        }
      }

      // Save overall aggregation method to instance metadata
      if (instance.metadata) {
        const updatedMetadata = {
          ...instance.metadata,
          aggregation_method: overallMethod
        };
        const { error: metadataError } = await supabase
          .from('instances')
          .update({ metadata: updatedMetadata })
          .eq('id', instance.id);
        
        if (metadataError) {
          console.error('Error saving aggregation method:', metadataError);
        }
      }

      // Recompute framework and final scores with new weights
      // First compute framework aggregation - call with only in_instance_id (config will be NULL and loaded from DB)
      try {
        // Call with only in_instance_id - the function will load weights from database
        const { error: frameworkError } = await supabase.rpc('score_framework_aggregate', {
          in_instance_id: instance.id,
          in_config: null, // Explicitly set to null to avoid ambiguity
        });

        if (frameworkError) {
          console.error('Error computing framework scores:', frameworkError);
          const errorMsg = `Weights saved, but error recomputing framework scores: ${frameworkError.message}`;
          setError(errorMsg);
          // Continue anyway - weights are saved
        } else {
          console.log('Framework scores recomputed successfully');
        }
      } catch (err: any) {
        console.error('Exception computing framework scores:', err);
        const errorMsg = `Weights saved, but error recomputing framework scores: ${err.message}`;
        setError(errorMsg);
      }

      // Then compute final aggregation
      try {
        const { error: finalError } = await supabase.rpc('score_final_aggregate', {
          in_instance_id: instance.id,
        });

        if (finalError) {
          console.error('Error computing final scores:', finalError);
          const prevError = error || '';
          const errorMsg = prevError 
            ? `${prevError}\nError recomputing final scores: ${finalError.message}` 
            : `Weights saved, but error recomputing final scores: ${finalError.message}`;
          setError(errorMsg);
          // Continue anyway - weights are saved
        } else {
          console.log('Final scores recomputed successfully');
          
          // Automatically compute priority ranking after final scores
          try {
            const { error: priorityError } = await supabase.rpc('score_priority_ranking', {
              in_instance_id: instance.id,
            });
            if (priorityError) {
              console.warn('Warning: Could not compute priority ranking:', priorityError);
              // Don't fail the whole operation if priority ranking fails
            } else {
              console.log('Priority ranking computed successfully');
            }
          } catch (priorityErr: any) {
            console.warn('Warning: Exception computing priority ranking:', priorityErr);
            // Don't fail the whole operation if priority ranking fails
          }
        }
      } catch (err: any) {
        console.error('Exception computing final scores:', err);
        const prevError = error || '';
        const errorMsg = prevError 
          ? `${prevError}\nError recomputing final scores: ${err.message}` 
          : `Weights saved, but error recomputing final scores: ${err.message}`;
        setError(errorMsg);
      }

      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div dangerouslySetInnerHTML={{ __html: sliderStyles }} />
      <div className="bg-white rounded-lg shadow-lg p-3 w-[800px] max-h-[90vh] overflow-y-auto text-xs" style={{ color: 'var(--gsc-gray)' }}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--gsc-gray)' }}>Calibration – {instance?.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg font-semibold leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex justify-between items-center mb-3">
          <p className="text-xs flex-1" style={{ color: 'var(--gsc-gray)' }}>
            Adjust weights per dataset and category. Weights should total 100% for best results.
            {(() => {
              const selectedMethod = getMethodById(overallMethod);
              if (selectedMethod?.id === 'geometric_mean') {
                return ' Note: With Geometric Mean, category weights affect compounding - low scores in any category reduce overall significantly.';
              }
              return '';
            })()}
          </p>
        </div>

        {/* Impact Preview Panel */}
        {showImpact && (
          <div className="mb-3 p-2 rounded border" style={{ borderColor: 'var(--gsc-blue)', backgroundColor: 'rgba(0, 75, 135, 0.05)' }}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-semibold" style={{ color: 'var(--gsc-blue)' }}>📊 Impact on Most Affected Places</h3>
              <button
                onClick={() => setShowImpact(!showImpact)}
                className="text-xs hover:opacity-80"
                style={{ color: 'var(--gsc-gray)' }}
              >
                {showImpact ? 'Hide' : 'Show'}
              </button>
            </div>
            {loadingImpact ? (
              <div className="text-xs" style={{ color: 'var(--gsc-gray)' }}>Calculating impact...</div>
            ) : impactLocations.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {impactLocations.slice(0, 5).map((loc, idx) => {
                  const isPositive = loc.change > 0.01;
                  const isNegative = loc.change < -0.01;
                  const rankChange = idx + 1 - loc.rank;
                  return (
                    <div key={loc.admin_pcode} className="text-xs flex justify-between items-center py-0.5">
                      <div className="flex-1 truncate">
                        <span className="font-medium">#{loc.rank}</span> {loc.admin_name}
                        {rankChange !== 0 && (
                          <span className={`ml-1 text-xs ${rankChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ({rankChange > 0 ? '↑' : '↓'} {Math.abs(rankChange)})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{loc.currentScore.toFixed(2)}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-semibold">{loc.projectedScore.toFixed(2)}</span>
                        {(isPositive || isNegative) && (
                          <span className={`text-xs font-semibold ${isPositive ? 'text-red-600' : 'text-green-600'}`}>
                            {isPositive ? '↑' : '↓'} {Math.abs(loc.change).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs" style={{ color: 'var(--gsc-gray)' }}>No impact data available. Apply scoring first.</div>
            )}
          </div>
        )}

        {/* Overall Aggregation Method Selector */}
        <div className="mb-3 p-2 rounded border" style={{ backgroundColor: 'rgba(0, 75, 135, 0.05)', borderColor: 'var(--gsc-blue)' }}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--gsc-gray)' }}>
                Overall Aggregation Method:
              </label>
              <select
                value={overallMethod}
                onChange={(e) => setOverallMethod(e.target.value)}
                className="mt-1 text-xs px-2 py-1 border rounded w-full"
                style={{ borderColor: 'var(--gsc-light-gray)' }}
              >
                {AGGREGATION_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.icon} {m.name} {m.recommended ? '(Recommended)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowMethodGuidance(!showMethodGuidance)}
              className="ml-2 text-xs px-2 py-1 rounded hover:opacity-80"
              style={{ backgroundColor: 'var(--gsc-blue)', color: 'white' }}
            >
              {showMethodGuidance ? 'Hide' : 'Show'} Info
            </button>
          </div>
          
          {showMethodGuidance && (() => {
            const selectedMethod = getMethodById(overallMethod);
            return selectedMethod ? (
              <div className="mt-2 p-2 rounded text-xs" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
                <div className="font-semibold mb-1">{selectedMethod.icon} {selectedMethod.name}</div>
                <div className="mb-1">{selectedMethod.description}</div>
                <div className="mb-1"><strong>When to use:</strong> {selectedMethod.whenToUse}</div>
                <div className="mb-1"><strong>Example:</strong> {selectedMethod.example.explanation}</div>
                <div><strong>Best for:</strong> {selectedMethod.bestFor}</div>
                {selectedMethod.formula && (
                  <div className="mt-1 pt-1 border-t" style={{ borderColor: 'var(--gsc-light-gray)' }}>
                    <strong>Formula:</strong> <code className="text-xs">{selectedMethod.formula}</code>
                  </div>
                )}
              </div>
            ) : null;
          })()}
          
          {/* Method-Specific Guidance */}
          {(() => {
            const selectedMethod = getMethodById(overallMethod);
            if (!selectedMethod) return null;
            
            return (
              <div className="mt-2 p-2 rounded text-xs" style={{ 
                backgroundColor: selectedMethod.id === 'geometric_mean' ? 'rgba(34, 139, 34, 0.1)' : 'rgba(255, 255, 255, 0.5)',
                borderLeft: `3px solid ${selectedMethod.id === 'geometric_mean' ? 'var(--gsc-green)' : 'var(--gsc-blue)'}`
              }}>
                {selectedMethod.id === 'geometric_mean' && (
                  <div>
                    <strong>⚠️ Important for Geometric Mean:</strong> Category weights still apply, but scores compound multiplicatively. 
                    Low scores in any category will significantly reduce the overall score. Adjust category weights to reflect relative importance.
                  </div>
                )}
                {selectedMethod.id === 'weighted_mean' && (
                  <div>
                    <strong>ℹ️ Weighted Mean:</strong> Category weights determine relative importance. Scores are averaged proportionally. 
                    This is the most balanced approach and works well when factors are independent.
                  </div>
                )}
                {selectedMethod.id === 'owa_optimistic' && (
                  <div>
                    <strong>ℹ️ OWA Optimistic:</strong> Emphasizes the highest score regardless of category. 
                    Category weights have less impact - the method prioritizes areas with extreme scores in any dimension.
                  </div>
                )}
                {selectedMethod.id === 'owa_pessimistic' && (
                  <div>
                    <strong>ℹ️ OWA Pessimistic:</strong> Requires consistency across categories. 
                    Areas with balanced scores across all categories will rank higher than those with extreme scores in one category.
                  </div>
                )}
                {selectedMethod.id === 'power_mean' && (
                  <div>
                    <strong>ℹ️ Power Mean:</strong> Moderate emphasis on extremes. Category weights apply, but high scores have more influence than in weighted mean.
                  </div>
                )}
            </div>
            );
          })()}
          
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleCompareMethods}
              disabled={loadingComparison}
              className="text-xs px-3 py-1 rounded hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: 'var(--gsc-green)', color: 'white' }}
            >
              {loadingComparison ? 'Calculating...' : 'Compare All Methods'}
            </button>
            {showMethodComparison && (
              <button
                onClick={() => setShowMethodComparison(false)}
                className="text-xs px-3 py-1 rounded hover:opacity-80"
                style={{ borderColor: 'var(--gsc-light-gray)', color: 'var(--gsc-gray)' }}
              >
                Hide Comparison
              </button>
            )}
          </div>
        </div>

        {/* Method Comparison View */}
        {showMethodComparison && comparisonData.length > 0 && (
          <div className="mb-3 p-2 rounded border max-h-64 overflow-y-auto" style={{ borderColor: 'var(--gsc-blue)', backgroundColor: 'rgba(0, 75, 135, 0.02)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--gsc-gray)' }}>
              Method Comparison (Top 20 Locations)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ color: 'var(--gsc-gray)' }}>
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--gsc-light-gray)' }}>
                    <th className="text-left p-1">Location</th>
                    <th className="text-right p-1">Weighted Mean</th>
                    <th className="text-right p-1">Geometric Mean</th>
                    <th className="text-right p-1">Power Mean</th>
                    <th className="text-right p-1">OWA Optimistic</th>
                    <th className="text-right p-1">OWA Pessimistic</th>
                    <th className="text-right p-1">Current</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, idx) => (
                    <tr key={row.admin_pcode} className="border-b" style={{ borderColor: 'var(--gsc-light-gray)' }}>
                      <td className="p-1 font-medium">{row.admin_name || row.admin_pcode}</td>
                      <td className="text-right p-1">{row.weighted_mean?.toFixed(2) || '-'}</td>
                      <td className="text-right p-1">{row.geometric_mean?.toFixed(2) || '-'}</td>
                      <td className="text-right p-1">{row.power_mean?.toFixed(2) || '-'}</td>
                      <td className="text-right p-1">{row.owa_optimistic?.toFixed(2) || '-'}</td>
                      <td className="text-right p-1">{row.owa_pessimistic?.toFixed(2) || '-'}</td>
                      <td className="text-right p-1 font-semibold">{row.current_score?.toFixed(2) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info panel explaining aggregation methods */}
        <div className="mb-3 p-2 rounded border" style={{ backgroundColor: 'rgba(99, 7, 16, 0.05)', borderColor: 'var(--gsc-blue)' }}>
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--gsc-gray)' }}>Category-Level Aggregation:</div>
          <div className="text-xs space-y-1" style={{ color: 'var(--gsc-gray)' }}>
            <div><strong>Weighted Mean:</strong> Each dataset's score is multiplied by its weight, then averaged. Best for combining different types of data.</div>
            <div><strong>Compounding Hazards:</strong> Scores are normalized (1→0, 5→1), weighted, then summed with a bonus for areas hit by multiple hazards. Best when multiple hazards overlap.</div>
            <div><strong>SSC Decision Tree:</strong> Fixed tree system for compiling P1, P2, P3 framework pillar scores using predefined decision rules.</div>
          </div>
        </div>

        {/* Weight input mode selector, placed directly above scoring panel */}
        <div className="flex justify-end items-center mb-2">
          <span className="text-xs mr-2" style={{ color: 'var(--gsc-gray)' }}>
            Weight input mode:
          </span>
          <select
            value={weightInputMode}
            onChange={(e) => setWeightInputMode(e.target.value as any)}
            className="text-xs px-2 py-1 border rounded"
            style={{ borderColor: 'var(--gsc-light-gray)' }}
          >
            <option value="slider">Slider</option>
            <option value="number">Number Input</option>
            <option value="percentage">Percentage</option>
          </select>
        </div>

        <div className="space-y-2">
          {Object.entries(categories).map(([cat, obj]) => {
            const categoryData = obj as CategoryData;
            const totalDatasetWeight = categoryData.datasets.reduce((sum, d) => sum + (weights[d.id] || 0), 0);
            return (
            <div key={cat} className="border rounded p-2" style={{ borderColor: 'var(--gsc-light-gray)', backgroundColor: 'var(--gsc-beige)' }}>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex-1">
                  <span className="font-semibold text-xs" style={{ color: 'var(--gsc-gray)' }}>{cat}</span>
                  {categoryData.datasets.length > 1 && (
                    <div className="mt-0.5">
                      <select
                        value={
                          cat === 'Hazard' && categoryData.datasets.filter(d => d.is_hazard_event).length > 1 
                            ? 'compounding_hazards' 
                            : (cat === 'SSC Framework - P1' || cat === 'SSC Framework - P2' || cat === 'SSC Framework - P3')
                            ? 'ssc_decision_tree'
                            : 'weighted_mean'
                        }
                        onChange={(e) => {
                          // Method selection is handled at the framework aggregation level
                          // This is informational for now
                        }}
                        className="text-xs px-1 py-0.5 border rounded"
                        style={{ 
                          borderColor: 'var(--gsc-light-gray)',
                          backgroundColor: 
                            cat === 'Hazard' && categoryData.datasets.filter(d => d.is_hazard_event).length > 1 
                              ? 'rgba(211, 84, 0, 0.1)' 
                              : (cat === 'SSC Framework - P1' || cat === 'SSC Framework - P2' || cat === 'SSC Framework - P3')
                              ? 'rgba(34, 139, 34, 0.1)'
                              : 'transparent'
                        }}
                        disabled={true}
                        title={
                          cat === 'Hazard' && categoryData.datasets.filter(d => d.is_hazard_event).length > 1
                            ? 'Compounding Hazards: Normalizes scores (1→0, 5→1), applies weights, sums them, then adds a bonus (product × 0.5) for areas hit by multiple hazards. This emphasizes locations affected by both earthquake AND typhoon.'
                            : cat === 'Hazard'
                            ? 'Compounding method requires 2+ hazard events'
                            : (cat === 'SSC Framework - P1' || cat === 'SSC Framework - P2' || cat === 'SSC Framework - P3')
                            ? 'SSC Decision Tree: Fixed tree system for compiling P1, P2, P3 framework pillar scores using predefined decision rules.'
                            : 'Multiple datasets in this category use weighted mean'
                        }
              >
                        <option value="weighted_mean">Weighted Mean</option>
                        {cat === 'Hazard' && categoryData.datasets.filter(d => d.is_hazard_event).length > 1 && (
                          <option value="compounding_hazards">Compounding Hazards</option>
                        )}
                        {(cat === 'SSC Framework - P1' || cat === 'SSC Framework - P2' || cat === 'SSC Framework - P3') && (
                          <option value="ssc_decision_tree">🌳 SSC Decision Tree</option>
                        )}
                      </select>
                      {cat === 'Hazard' && categoryData.datasets.filter(d => d.is_hazard_event).length > 1 && (
                        <span className="ml-1 text-xs" style={{ color: 'var(--gsc-orange)' }} title="This method normalizes each hazard score to 0-1, applies your weights, sums them, then adds a compounding bonus (product of normalized scores × 0.5) to emphasize areas hit by multiple hazards. Final result is scaled back to 1-5.">
                          ⓘ Normalized + Bonus
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--gsc-gray)' }}>Category:</span>
                  {weightInputMode === 'slider' ? (
                    <>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round(categoryData.categoryWeight)}
                        onChange={(e) => {
                          handleCategoryWeightChange(cat, parseFloat(e.target.value));
                        }}
                        className="w-20 h-1.5 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, var(--gsc-blue) 0%, var(--gsc-blue) ${categoryData.categoryWeight}%, var(--gsc-light-gray) ${categoryData.categoryWeight}%, var(--gsc-light-gray) 100%)`
                        }}
                      />
                      <span className="w-10 text-right font-semibold text-xs">{Math.round(categoryData.categoryWeight)}%</span>
                    </>
                  ) : weightInputMode === 'number' ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                        step="1"
                        value={Math.round(categoryData.categoryWeight)}
                        onChange={(e) => {
                          const val = Math.round(parseFloat(e.target.value) || 0);
                          handleCategoryWeightChange(cat, Math.max(0, Math.min(100, val)));
                        }}
                        className="w-16 px-1 py-0.5 border rounded text-xs text-right"
                        style={{ borderColor: 'var(--gsc-light-gray)' }}
                      />
                      <span className="text-xs">%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={`${Math.round(categoryData.categoryWeight)}%`}
                        onChange={(e) => {
                          const val = Math.round(parseFloat(e.target.value.replace('%', '')) || 0);
                          handleCategoryWeightChange(cat, Math.max(0, Math.min(100, val)));
                        }}
                        className="w-16 px-1 py-0.5 border rounded text-xs text-right"
                        style={{ borderColor: 'var(--gsc-light-gray)' }}
                        placeholder="0%"
                      />
                    </div>
                  )}
                  {/* Category total warning and normalize button */}
                  {(() => {
                    const categoryTotal = Object.values(categories).reduce((sum, c) => sum + (c.categoryWeight || 0), 0);
                    if (Math.abs(categoryTotal - 100) >= 1) {
                      return (
                        <div className="flex items-center gap-2 ml-2">
                          <button
                            onClick={() => normalizeAllCategories()}
                            className="text-xs px-2 py-0.5 rounded hover:opacity-80"
                            style={{ backgroundColor: 'var(--gsc-blue)', color: 'white' }}
                            title="Normalize all category weights to total 100%"
                          >
                            Normalize
                          </button>
                          <span className="text-xs font-semibold" style={{ color: 'var(--gsc-red)' }} title={`Category weights total ${categoryTotal.toFixed(0)}%, not 100%`}>
                            ⚠️ Total: {Math.round(categoryTotal)}%
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Compact dataset list */}
              <div className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--gsc-blue)' }}>
                {categoryData.datasets.length > 1 && (
                  <div className="text-xs mb-1 pb-1 border-b" style={{ color: 'var(--gsc-gray)', borderColor: 'var(--gsc-light-gray)' }}>
                    <strong>Multiple datasets:</strong> {cat === 'Hazard' && categoryData.datasets.filter(d => d.is_hazard_event).length > 1 
                      ? 'Using Compounding Hazards method - areas hit by multiple hazards get a bonus'
                      : 'Using Weighted Mean - each dataset contributes proportionally to its weight'}
                  </div>
                )}
                {categoryData.datasets.map((d) => {
                  const weight = weights[d.id] ?? 0;
                  return (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-xs flex items-center gap-1.5">
                      {d.name}
                      {d.is_hazard_event && (
                        <span className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--gsc-orange)', color: '#fff' }}>
                          Hazard
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
                      {weightInputMode === 'slider' ? (
                        <>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(weight)}
                            onChange={(e) => {
                              handleWeightChange(d.id, parseFloat(e.target.value));
                            }}
                            className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, var(--gsc-green) 0%, var(--gsc-green) ${weight}%, var(--gsc-light-gray) ${weight}%, var(--gsc-light-gray) 100%)`
                            }}
                          />
                          <span className="w-8 text-right font-semibold text-xs">{Math.round(weight)}%</span>
                        </>
                      ) : weightInputMode === 'number' ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(weight)}
                            onChange={(e) => {
                              const val = Math.round(parseFloat(e.target.value) || 0);
                              handleWeightChange(d.id, Math.max(0, Math.min(100, val)));
                            }}
                            className="flex-1 px-1 py-0.5 border rounded text-xs text-right"
                            style={{ borderColor: 'var(--gsc-light-gray)' }}
                          />
                          <span className="text-xs w-4">%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={`${Math.round(weight)}%`}
                            onChange={(e) => {
                              const val = Math.round(parseFloat(e.target.value.replace('%', '')) || 0);
                              handleWeightChange(d.id, Math.max(0, Math.min(100, val)));
                            }}
                            className="flex-1 px-1 py-0.5 border rounded text-xs text-right"
                            style={{ borderColor: 'var(--gsc-light-gray)' }}
                            placeholder="0%"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
                
                {/* Total indicator with warning */}
                {categoryData.datasets.length > 1 && (
                  <div className="flex justify-between items-center gap-1 text-xs pt-0.5 border-t" style={{ borderColor: 'var(--gsc-light-gray)' }}>
                    <button
                      onClick={() => normalizeCategory(cat)}
                      className="text-xs px-2 py-0.5 rounded hover:opacity-80"
                      style={{ 
                        backgroundColor: Math.abs(totalDatasetWeight - 100) >= 1 ? 'var(--gsc-blue)' : 'transparent',
                        color: Math.abs(totalDatasetWeight - 100) >= 1 ? 'white' : 'var(--gsc-gray)',
                        border: Math.abs(totalDatasetWeight - 100) >= 1 ? 'none' : '1px solid var(--gsc-light-gray)'
                      }}
                      title="Normalize weights to total 100%"
                    >
                      Normalize
                    </button>
                    <span style={{ 
                      color: Math.abs(totalDatasetWeight - 100) >= 1 ? 'var(--gsc-red)' : 'var(--gsc-green)',
                      fontWeight: Math.abs(totalDatasetWeight - 100) >= 1 ? 'bold' : 'normal'
                    }}>
                      Total: {Math.round(totalDatasetWeight)}%
                      {Math.abs(totalDatasetWeight - 100) >= 1 && (
                        <span className="ml-1" title="Weights don't total 100%">⚠️</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-3 p-2 rounded border text-xs" style={{ 
            backgroundColor: 'rgba(220, 38, 38, 0.1)', 
            borderColor: 'var(--gsc-red)',
            color: 'var(--gsc-red)'
          }}>
            <div className="font-semibold mb-1">Error:</div>
            <div className="whitespace-pre-wrap">{error}</div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--gsc-light-gray)' }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 border rounded text-xs hover:opacity-80 transition"
            style={{ borderColor: 'var(--gsc-light-gray)', color: 'var(--gsc-gray)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-1.5 rounded text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
            style={{ backgroundColor: 'var(--gsc-blue)' }}
          >
            {loading ? 'Saving…' : 'Apply & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

