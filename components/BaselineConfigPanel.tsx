'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabaseClient';
import { useCountry } from '@/lib/countryContext';
import { Plus, Trash2, Save, RefreshCw, Settings, CheckCircle, X, Info, ChevronDown } from 'lucide-react';

/** One display section in Framework Datasets, derived from DB framework (pillar/theme/subtheme) */
export type FrameworkSection = { code: string; name: string; level: 'pillar' | 'theme' | 'subtheme' };
import ScoringFlowDiagram from './ScoringFlowDiagram';
import HierarchicalCategorySelector from './HierarchicalCategorySelector';

interface Props {
  baselineId: string;
  onUpdate?: () => void;
}

type Dataset = {
  id: string;
  name: string;
  admin_level: string;
  type: string;
};

type BaselineDataset = {
  id: string;
  dataset_id: string;
  category: string;
  weight: number;
  scoring_config: any;
  aggregation_method?: string;
  dataset?: Dataset;
};

// Framework structure will be loaded from database

const ADMIN_LEVELS = ['ADM1', 'ADM2', 'ADM3', 'ADM4'];

const AGGREGATION_METHODS = [
  { value: 'auto', label: 'Auto (based on level)' },
  { value: 'sum', label: 'Sum (aggregate up)' },
  { value: 'average', label: 'Average (aggregate up)' },
  { value: 'weighted_average', label: 'Weighted Average (aggregate up)' },
  { value: 'distribute', label: 'Distribute (disaggregate down)' },
  { value: 'inherit', label: 'Inherit (disaggregate down)' },
];

export default function BaselineConfigPanel({ baselineId, onUpdate }: Props) {
  const supabase = createClient();
  const { currentCountry } = useCountry();
  const [baselineCountryId, setBaselineCountryId] = useState<string | null>(null);
  const [baselineDatasets, setBaselineDatasets] = useState<BaselineDataset[]>([]);
  const [availableDatasets, setAvailableDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedWeight, setSelectedWeight] = useState<number>(1.0);
  
  // State for hierarchical category selector: when open, hold id + trigger rect + context so we can render in a portal
  type CategorySelectorOpen = { id: string; rect: DOMRect; currentCategory: string; onChange: (c: string) => void } | null;
  const [categorySelectorOpen, setCategorySelectorOpen] = useState<CategorySelectorOpen>(null);
  
  // Close popover when clicking outside (portal dropdown is in body, so check by data attribute)
  useEffect(() => {
    if (categorySelectorOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.category-selector-popover') && !target.closest('[data-category-selector-portal]')) {
          setCategorySelectorOpen(null);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [categorySelectorOpen]);
  
  // Render hierarchical category selector: trigger button in-place; dropdown rendered in portal so it is not clipped
  const renderCategorySelector = (currentCategory: string, onChange: (category: string) => void, datasetId?: string) => {
    const selectorId = datasetId || 'default';
    const isOpen = categorySelectorOpen?.id === selectorId;

    return (
      <div className="relative category-selector-popover" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen) {
              setCategorySelectorOpen(null);
            } else {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setCategorySelectorOpen({ id: selectorId, rect, currentCategory, onChange });
            }
          }}
          className="text-xs px-2 py-1 border rounded bg-white min-w-[200px] text-left flex items-center justify-between hover:bg-gray-50"
          title="Click to select framework category (Pillar → Theme → Subtheme)"
        >
          <span className={currentCategory ? 'text-gray-900' : 'text-gray-400'} title={currentCategory}>
            {currentCategory || 'Select category...'}
          </span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {/* Dropdown is rendered via portal in the component return so it is not clipped by overflow-hidden parents */}
      </div>
    );
  };
  
  // Scoring modal state
  const [scoringDataset, setScoringDataset] = useState<BaselineDataset | null>(null);
  const [showScoringModal, setShowScoringModal] = useState(false);
  
  // Scoring form state
  const [scoringMethod, setScoringMethod] = useState('normalization');
  const [scoringInverse, setScoringInverse] = useState(false);
  const [scoringThresholds, setScoringThresholds] = useState<number[]>([20, 40, 60, 80]);
  const [categoryScores, setCategoryScores] = useState<Record<string, number>>({});
  const [scoreRange, setScoreRange] = useState<{min: number, max: number}>({min: 1, max: 5});
  const [datasetCategories, setDatasetCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  
  // Baseline config state
  const [targetAdminLevel, setTargetAdminLevel] = useState<string>('ADM3');
  const [showFrameworkView, setShowFrameworkView] = useState(true);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [showEmptyThemes, setShowEmptyThemes] = useState<boolean>(false);

  type AggregationMethod = 'average' | 'worst_case' | 'custom_weighted' | 'ssc_decision_tree';
  const defaultPillarRollup = { method: 'average' as AggregationMethod, weights: { P1: 1 / 3, P2: 1 / 3, P3: 1 / 3 } };
  const defaultOverallRollup = { method: 'average' as AggregationMethod, weights: { 'SSC Framework': 0.6, 'Hazard': 0.2, 'Underlying Vulnerability': 0.2 } };
  const [pillarRollup, setPillarRollup] = useState<{ method: AggregationMethod; weights: Record<string, number> }>(defaultPillarRollup);
  const [overallRollup, setOverallRollup] = useState<{ method: AggregationMethod; weights: Record<string, number> }>(defaultOverallRollup);
  
  // Framework structure loaded from database
  const [frameworkStructure, setFrameworkStructure] = useState<any>(null);
  const FALLBACK_SECTIONS: FrameworkSection[] = [
    { code: 'P1', name: 'The Shelter', level: 'pillar' },
    { code: 'P2', name: 'The Living Conditions', level: 'pillar' },
    { code: 'P3', name: 'The Settlement', level: 'pillar' },
    { code: 'P3.2', name: 'Hazards (P3.2)', level: 'theme' },
    { code: 'P3.1', name: 'Underlying Vulnerabilities (P3.1)', level: 'theme' },
  ];
  const [frameworkSections, setFrameworkSections] = useState<FrameworkSection[]>(FALLBACK_SECTIONS); // DB-driven; fallback until loaded
  const [categories, setCategories] = useState<string[]>([]);
  const [frameworkLoading, setFrameworkLoading] = useState(true);

  useEffect(() => {
    // Load data first, then framework structure
    loadData();
    // Load framework structure separately - don't block on it
    loadFrameworkStructure().catch(err => {
      console.error('Failed to load framework structure:', err);
      // Component will use fallback categories
    });
  }, [baselineId]);

  // Load framework structure from database
  const loadFrameworkStructure = async () => {
    setFrameworkLoading(true);
    try {
      // First set fallback categories so component can render
      const fallbackCategories = [
        'P1 - Pillar 1',
        'P1.1 - Impact',
        'P1.2 - Humanitarian Conditions',
        'P1.3 - Current & Forecasted Priority Needs',
        'P2 - Pillar 2',
        'P2.1 - Living Standards',
        'P2.2 - Coping Mechanisms',
        'P2.3 - Physical & Mental Wellbeing',
        'P3 - Pillar 3',
        'P3.1 - Underlying Vulnerability',
        'P3.2 - Hazard Exposure',
      ];
      setCategories(fallbackCategories);
      if (!selectedCategory) {
        setSelectedCategory(fallbackCategories[0]);
      }

      const { data, error } = await supabase.rpc('get_framework_structure');
      
      if (error) {
        console.error('Error loading framework structure:', error);
        // Already set fallback above
        setFrameworkStructure(null);
        setFrameworkLoading(false);
        return;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        // Build framework structure object, categories, and DB-driven display sections from database
        const framework: Record<string, any> = {};
        const categoryList: string[] = [];
        const sections: FrameworkSection[] = [];

        data.forEach((pillar: any) => {
          const pillarKey = pillar.code; // e.g., 'P1', 'P2', 'P3'
          
          // Add pillar-level category and section
          const pillarCategory = `${pillarKey} - ${pillar.name}`;
          categoryList.push(pillarCategory);
          sections.push({ code: pillarKey, name: pillar.name || pillarKey, level: 'pillar' });
          
          // Build categories and sections from themes and subthemes
          const pillarCategories: string[] = [pillarCategory];
          
          if (pillar.themes && Array.isArray(pillar.themes)) {
            const sortedThemes = [...pillar.themes].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
            
            sortedThemes.forEach((theme: any) => {
              const themeNum = (theme.order_index || 0) + 1;
              const themeCode = `${pillarKey}.${themeNum}`;
              const categoryName = `${themeCode} - ${theme.name}`;
              pillarCategories.push(categoryName);
              categoryList.push(categoryName);
              sections.push({ code: themeCode, name: theme.name || themeCode, level: 'theme' });
              
              if (theme.subthemes && Array.isArray(theme.subthemes) && theme.subthemes.length > 0) {
                const sortedSubthemes = [...theme.subthemes].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
                sortedSubthemes.forEach((subtheme: any) => {
                  const subthemeNum = (subtheme.order_index || 0) + 1;
                  const subthemeCode = `${themeCode}.${subthemeNum}`;
                  const subthemeCategoryName = `${subthemeCode} - ${subtheme.name}`;
                  pillarCategories.push(subthemeCategoryName);
                  categoryList.push(subthemeCategoryName);
                  sections.push({ code: subthemeCode, name: subtheme.name || subthemeCode, level: 'subtheme' });
                });
              }
            });
          }

          framework[pillarKey] = {
            name: pillar.name,
            code: pillar.code,
            categories: pillarCategories,
          };
        });

        setFrameworkStructure(framework);
        setFrameworkSections(sections);
        setCategories(categoryList);
        // Set default selected category if not already set
        if (categoryList.length > 0 && selectedCategory === '') {
          setSelectedCategory(categoryList[0]);
        }
      } else {
        // No framework data - use minimal fallback sections so UI still works
        setFrameworkStructure(null);
        setFrameworkSections([
          { code: 'P1', name: 'P1 - The Shelter', level: 'pillar' },
          { code: 'P2', name: 'P2 - The Living Conditions', level: 'pillar' },
          { code: 'P3', name: 'P3 - The Settlement', level: 'pillar' },
          { code: 'P3.2', name: 'Hazards (P3.2)', level: 'theme' },
          { code: 'P3.1', name: 'Underlying Vulnerabilities (P3.1)', level: 'theme' },
        ]);
        setCategories([
          'P1.1 - Impact',
          'P1.2 - Humanitarian Conditions',
          'P1.3 - Current & Forecasted Priority Needs',
          'P2.1 - Living Standards',
          'P2.2 - Coping Mechanisms',
          'P2.3 - Physical & Mental Wellbeing',
          'P3.1 - Underlying Vulnerability',
          'P3.2 - Hazard Exposure',
        ]);
      }
    } catch (err: any) {
      console.error('Error loading framework:', err);
      setFrameworkStructure(null);
      setFrameworkSections([
        { code: 'P1', name: 'P1 - The Shelter', level: 'pillar' },
        { code: 'P2', name: 'P2 - The Living Conditions', level: 'pillar' },
        { code: 'P3', name: 'P3 - The Settlement', level: 'pillar' },
        { code: 'P3.2', name: 'Hazards (P3.2)', level: 'theme' },
        { code: 'P3.1', name: 'Underlying Vulnerabilities (P3.1)', level: 'theme' },
      ]);
      setCategories([
        'P1 - Pillar 1',
        'P1.1 - Impact',
        'P1.2 - Humanitarian Conditions',
        'P1.3 - Current & Forecasted Priority Needs',
        'P2 - Pillar 2',
        'P2.1 - Living Standards',
        'P2.2 - Coping Mechanisms',
        'P2.3 - Physical & Mental Wellbeing',
        'P3 - Pillar 3',
        'P3.1 - Underlying Vulnerability',
        'P3.2 - Hazard Exposure',
      ]);
    } finally {
      setFrameworkLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // First, resolve baselineId - it might be a slug or UUID
      let resolvedBaselineId = baselineId;
      let baselineCountryId: string | null = null;
      
      // Check if it's a UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baselineId);
      
      if (!isUUID) {
        // It's a slug, need to resolve to UUID
        const { data: baselineData, error: resolveError } = await supabase
          .from('country_baselines')
          .select('id, config, country_id')
          .eq('slug', baselineId)
          .single();
        
        if (resolveError || !baselineData) {
          throw new Error(`Baseline not found: ${baselineId}`);
        }
        
        resolvedBaselineId = baselineData.id;
        baselineCountryId = baselineData.country_id;
        
        if (baselineData?.config?.target_admin_level) {
          setTargetAdminLevel(baselineData.config.target_admin_level);
        }
        const ac = baselineData?.config?.aggregation_config;
        if (ac?.pillar_rollup) setPillarRollup(ac.pillar_rollup);
        if (ac?.overall_rollup) setOverallRollup(ac.overall_rollup);
      } else {
        // It's a UUID, load config
        const { data: baselineData } = await supabase
          .from('country_baselines')
          .select('config, country_id')
          .eq('id', baselineId)
          .single();
        
        if (baselineData) {
          baselineCountryId = baselineData.country_id;
          
          if (baselineData?.config?.target_admin_level) {
            setTargetAdminLevel(baselineData.config.target_admin_level);
          }
          const ac = baselineData?.config?.aggregation_config;
          if (ac?.pillar_rollup) setPillarRollup(ac.pillar_rollup);
          if (ac?.overall_rollup) setOverallRollup(ac.overall_rollup);
        }
      }
      
      // Store baseline's country_id for filtering datasets
      if (baselineCountryId) {
        setBaselineCountryId(baselineCountryId);
      }

      // Load baseline datasets with scoring config using resolved UUID
      const { data: bdData, error: bdError } = await supabase
        .from('baseline_datasets')
        .select('id, dataset_id, category, weight, scoring_config, aggregation_method')
        .eq('baseline_id', resolvedBaselineId);

      if (bdError) {
        console.error('Error loading baseline_datasets:', bdError);
        throw bdError;
      }

      // Load dataset details - also filter by country to ensure data integrity
      const datasetIds = (bdData || []).map(bd => bd.dataset_id);
      let datasetsMap: Map<string, Dataset> = new Map();
      
      if (datasetIds.length > 0) {
        const countryIdToFilter = baselineCountryId || currentCountry?.id;
        
        let datasetsQuery = supabase
          .from('datasets')
          .select('id, name, admin_level, type, country_id')
          .in('id', datasetIds);
        
        // Filter by country if we have a country ID
        if (countryIdToFilter) {
          datasetsQuery = datasetsQuery.eq('country_id', countryIdToFilter);
        }
        
        const { data: dsData } = await datasetsQuery;
        
        (dsData || []).forEach(ds => datasetsMap.set(ds.id, ds));
      }

      const enrichedData = (bdData || []).map(bd => ({
        ...bd,
        dataset: datasetsMap.get(bd.dataset_id)
      }));

      setBaselineDatasets(enrichedData);

      // Load all available datasets for adding - FILTER BY COUNTRY
      // Use baseline's country_id if available, otherwise fall back to currentCountry
      const countryIdToFilter = baselineCountryId || currentCountry?.id;
      
      let datasetsQuery = supabase
        .from('datasets')
        .select('id, name, admin_level, type, country_id')
        .order('name');
      
      // Only filter by country if we have a country ID
      if (countryIdToFilter) {
        datasetsQuery = datasetsQuery.eq('country_id', countryIdToFilter);
      } else {
        // If no country context, show warning but don't filter (shouldn't happen in normal flow)
        console.warn('[BaselineConfigPanel] No country context available for filtering datasets');
      }

      const { data: allDatasets, error: allDatasetsError } = await datasetsQuery;

      if (allDatasetsError) {
        console.error('Error loading available datasets:', allDatasetsError);
      }

      setAvailableDatasets(allDatasets || []);
      
      console.log(`[BaselineConfigPanel] Loaded ${enrichedData.length} baseline datasets, ${allDatasets?.length || 0} available datasets`);
    } catch (err: any) {
      console.error('Error loading baseline data:', err);
      // Show error to user if it's a critical error
      if (err?.message && !err.message.includes('PGRST116')) {
        alert(`Error loading datasets: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddDataset = async () => {
    if (!selectedDatasetId) {
      alert('Please select a dataset');
      return;
    }
    if (!selectedCategory || selectedCategory === '') {
      alert('Please select a category');
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('baseline_datasets')
        .insert({
          baseline_id: baselineId,
          dataset_id: selectedDatasetId,
          category: selectedCategory,
          weight: selectedWeight
        });

      if (error) throw error;

      setShowAddModal(false);
      setSelectedDatasetId('');
      setSelectedCategory(categories.length > 0 ? categories[0] : '');
      setSelectedWeight(1.0);
      await loadData();
      onUpdate?.();
    } catch (err: any) {
      console.error('Error adding dataset:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDataset = async (bdId: string) => {
    if (!confirm('Remove this dataset from the baseline?')) return;
    
    try {
      const { error } = await supabase
        .from('baseline_datasets')
        .delete()
        .eq('id', bdId);

      if (error) throw error;
      await loadData();
      onUpdate?.();
    } catch (err: any) {
      console.error('Error removing dataset:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateWeight = async (bdId: string, newWeight: number) => {
    try {
      const { error } = await supabase
        .from('baseline_datasets')
        .update({ weight: newWeight })
        .eq('id', bdId);

      if (error) throw error;
      
      setBaselineDatasets(prev => 
        prev.map(bd => bd.id === bdId ? { ...bd, weight: newWeight } : bd)
      );
    } catch (err: any) {
      console.error('Error updating weight:', err);
    }
  };

  // Update dataset category
  const handleUpdateCategory = async (bdId: string, newCategory: string) => {
    if (!newCategory || newCategory.trim() === '') {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('baseline_datasets')
        .update({ category: newCategory })
        .eq('id', bdId);

      if (error) throw error;
      
      setBaselineDatasets(prev => 
        prev.map(bd => bd.id === bdId ? { ...bd, category: newCategory } : bd)
      );
      setEditingCategory(null);
    } catch (err: any) {
      console.error('Error updating category:', err);
      alert(`Error updating category: ${err.message}`);
    }
  };

  // Update aggregation method
  const handleUpdateAggregation = async (bdId: string, method: string) => {
    try {
      const { error } = await supabase
        .from('baseline_datasets')
        .update({ aggregation_method: method })
        .eq('id', bdId);

      if (error) throw error;
      
      setBaselineDatasets(prev => 
        prev.map(bd => bd.id === bdId ? { ...bd, aggregation_method: method } : bd)
      );
    } catch (err: any) {
      console.error('Error updating aggregation method:', err);
    }
  };

  // Save target admin level
  const handleSaveTargetLevel = async (level: string) => {
    try {
      const { data: current } = await supabase
        .from('country_baselines')
        .select('config')
        .eq('id', baselineId)
        .single();
      const newConfig = { ...(current?.config || {}), target_admin_level: level };
      const { error } = await supabase.from('country_baselines').update({ config: newConfig }).eq('id', baselineId);
      if (error) throw error;
      setTargetAdminLevel(level);
      onUpdate?.();
    } catch (err: any) {
      console.error('Error updating target level:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Normalize weights to sum to 1
  const normalizeWeights = (w: Record<string, number>): Record<string, number> => {
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    if (sum === 0) return w;
    const out: Record<string, number> = {};
    Object.keys(w).forEach((k) => { out[k] = Number((w[k] / sum).toFixed(3)); });
    return out;
  };

  // Save pillar & overall aggregation config
  const handleSaveAggregationConfig = async () => {
    try {
      const { data: current } = await supabase
        .from('country_baselines')
        .select('config')
        .eq('id', baselineId)
        .single();
      const newConfig = {
        ...(current?.config || {}),
        aggregation_config: { pillar_rollup: pillarRollup, overall_rollup: overallRollup },
      };
      const { error } = await supabase.from('country_baselines').update({ config: newConfig }).eq('id', baselineId);
      if (error) throw error;
      onUpdate?.();
    } catch (err: any) {
      console.error('Error saving aggregation config:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Map category string to section code using DB framework sections (longest matching code)
  const getSectionCodeForCategory = (category: string): string => {
    const raw = (category || '').trim();
    if (!raw) return 'Uncategorized';
    const codePart = raw.split(' - ')[0]?.trim() || raw;
    if (!codePart) return 'Uncategorized';
    const matches = frameworkSections.filter(
      (s) => codePart === s.code || codePart.startsWith(s.code + '.')
    );
    if (matches.length === 0) {
      const prefixMatch = frameworkSections.filter((s) => codePart.startsWith(s.code));
      const best = prefixMatch.sort((a, b) => b.code.length - a.code.length)[0];
      return best ? best.code : 'Uncategorized';
    }
    const best = matches.sort((a, b) => b.code.length - a.code.length)[0];
    return best?.code ?? 'Uncategorized';
  };

  // Group datasets by section code (DB-driven sections)
  const groupedBySection = baselineDatasets.reduce(
    (acc, bd) => {
      const code = getSectionCodeForCategory(bd.category);
      if (!acc[code]) acc[code] = [];
      acc[code].push(bd);
      return acc;
    },
    {} as Record<string, BaselineDataset[]>
  );

  // Build pillar → themes structure so we always show P1, P2, P3, and under each its themes (e.g. P3.1 Underlying Vuln, P3.2 Hazard)
  type PillarWithThemes = { pillar: FrameworkSection; themes: FrameworkSection[] };
  const pillarThemeStructure: PillarWithThemes[] = (() => {
    const orderRank = (s: FrameworkSection): number => {
      const code = (s.code || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      if (code === 'p1' || code.startsWith('p1')) return 10;
      if (code === 'p2' || code.startsWith('p2')) return 20;
      if (code === 'p3' || code.startsWith('p3')) return 30;
      if (code.startsWith('haz') || name.includes('hazard')) return 40;
      if (code.startsWith('uv') || name.includes('underlying') || name.includes('vulnerab')) return 50;
      return 100;
    };

    const pillars = frameworkSections
      .filter((s) => s.level === 'pillar')
      .sort((a, b) => {
        const ra = orderRank(a);
        const rb = orderRank(b);
        if (ra !== rb) return ra - rb;
        return a.code.localeCompare(b.code);
      });
    const themes = frameworkSections.filter((s) => s.level === 'theme' || s.level === 'subtheme');
    return pillars.map((pillar) => ({
      pillar,
      themes: themes.filter((t) => t.code === pillar.code || t.code.startsWith(pillar.code + '.')),
    }));
  })();

  // Get pillar for a category (for framework structure display)
  const getPillar = (category: string): string => {
    if (category.startsWith('P1')) return 'P1';
    if (category.startsWith('P2')) return 'P2';
    if (category.startsWith('P3')) return 'P3';
    return 'Other';
  };

  // Open scoring modal
  const openScoringModal = async (bd: BaselineDataset) => {
    setScoringDataset(bd);
    setDatasetCategories([]);
    
    // Load existing config if present
    if (bd.scoring_config) {
      setScoringMethod(bd.scoring_config.method || 'normalization');
      setScoringInverse(bd.scoring_config.inverse || false);
      setScoringThresholds(bd.scoring_config.thresholds || [20, 40, 60, 80]);
      setCategoryScores(bd.scoring_config.category_scores || {});
      setScoreRange(bd.scoring_config.score_range || {min: 1, max: 5});
    } else {
      // Reset to defaults
      setScoringMethod('normalization');
      setScoringInverse(false);
      setScoringThresholds([20, 40, 60, 80]);
      setCategoryScores({});
      setScoreRange({min: 1, max: 5});
    }
    
    setShowScoringModal(true);
    
    // Load actual categories for categorical datasets
    if (bd.dataset?.type === 'categorical' && bd.dataset_id) {
      setLoadingCategories(true);
      try {
        const { data: catData, error } = await supabase
          .from('dataset_values_categorical')
          .select('category')
          .eq('dataset_id', bd.dataset_id);
        
        if (!error && catData) {
          // Get unique categories
          const uniqueCategories = [...new Set(catData.map(c => c.category))].filter(Boolean).sort();
          setDatasetCategories(uniqueCategories);
        }
      } catch (err) {
        console.error('Error loading categories:', err);
      } finally {
        setLoadingCategories(false);
      }
    }
  };

  // Save scoring configuration
  const handleSaveScoring = async () => {
    if (!scoringDataset) return;
    
    const config = scoringDataset.dataset?.type === 'categorical'
      ? { method: 'category_mapping', category_scores: categoryScores, score_range: scoreRange }
      : { method: scoringMethod, inverse: scoringInverse, thresholds: scoringThresholds, score_range: scoreRange };
    
    try {
      const { error } = await supabase
        .from('baseline_datasets')
        .update({ scoring_config: config })
        .eq('id', scoringDataset.id);

      if (error) throw error;
      
      // Update local state
      setBaselineDatasets(prev => 
        prev.map(bd => bd.id === scoringDataset.id ? { ...bd, scoring_config: config } : bd)
      );
      
      setShowScoringModal(false);
      setScoringDataset(null);
      onUpdate?.();
    } catch (err: any) {
      console.error('Error saving scoring config:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Check if scoring is configured
  const hasScoringConfig = (bd: BaselineDataset) => {
    return bd.scoring_config && Object.keys(bd.scoring_config).length > 0;
  };

  // Group datasets by category
  const groupedDatasets = baselineDatasets.reduce((acc, bd) => {
    const cat = bd.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(bd);
    return acc;
  }, {} as Record<string, BaselineDataset[]>);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 py-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
          Loading baseline configuration...
        </div>
      </div>
    );
  }

  // Render dataset row with all controls
  const renderDatasetRow = (bd: BaselineDataset) => {
    const levelMismatch = bd.dataset && bd.dataset.admin_level !== targetAdminLevel;
    
    return (
      <div key={bd.id} className="px-3 py-3 bg-white border-b last:border-b-0">
        <div className="flex items-start justify-between gap-4">
          {/* Dataset info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
              {bd.dataset?.name || 'Unknown Dataset'}
              {hasScoringConfig(bd) && (
                <CheckCircle size={14} className="text-green-500" />
              )}
              {levelMismatch && (
                <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                  {bd.dataset?.admin_level}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {bd.dataset?.type}
              {hasScoringConfig(bd) && (
                <span className="ml-2 text-green-600">
                  • {bd.scoring_config?.method}
                  {bd.scoring_config?.score_range && ` (${bd.scoring_config.score_range.min}-${bd.scoring_config.score_range.max})`}
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Category selector - hierarchical */}
            {renderCategorySelector(bd.category || '', (newCategory) => handleUpdateCategory(bd.id, newCategory), bd.id)}

            {/* Aggregation method (show if level mismatch) */}
            {levelMismatch && (
              <div className="relative" title="Aggregation method: How to transform this dataset to match the target admin level">
                <select
                  value={bd.aggregation_method || 'auto'}
                  onChange={(e) => handleUpdateAggregation(bd.id, e.target.value)}
                  className="text-xs px-2 py-1 border rounded bg-white"
                  title={`How to transform this dataset from ${bd.dataset?.admin_level} to ${targetAdminLevel}. Auto = choose method based on dataset type and level difference.`}
                >
                  {AGGREGATION_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Weight */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Wt:</span>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={bd.weight}
                onChange={(e) => handleUpdateWeight(bd.id, parseFloat(e.target.value) || 1)}
                className="w-14 px-1 py-1 text-xs border rounded"
              />
            </div>

            {/* Score button */}
            <button
              onClick={() => openScoringModal(bd)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                hasScoringConfig(bd) 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
              title="Configure scoring"
            >
              <Settings size={12} />
              {hasScoringConfig(bd) ? 'Edit' : 'Score'}
            </button>

            {/* Delete button */}
            <button
              onClick={() => handleRemoveDataset(bd.id)}
              className="text-red-500 hover:text-red-700 p-1"
              title="Remove from baseline"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
      {/* Compact Scoring Flow Diagram - At Top */}
      {baselineDatasets.length > 0 && (
        <ScoringFlowDiagram compact={true} />
      )}

      {/* Target Admin Level Configuration */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-blue-900">Scoring Configuration</h4>
            <p className="text-sm text-blue-700 mt-1">
              All scores will be calculated at the target admin level. Datasets at different levels will be aggregated/disaggregated.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-blue-900">Target Level:</label>
            <select
              value={targetAdminLevel}
              onChange={(e) => handleSaveTargetLevel(e.target.value)}
              className="px-3 py-2 border border-blue-300 rounded-lg bg-white"
            >
              {ADMIN_LEVELS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Proposed baseline scoring (from instance flow) */}
      <details className="group/proposal border border-gray-200 rounded-lg bg-gray-50/50 overflow-hidden">
        <summary className="px-3 py-2 text-xs text-gray-600 cursor-pointer hover:bg-gray-100/80 list-none flex items-center justify-between gap-2">
          <span className="font-medium text-gray-700">Proposed baseline scoring (from instances)</span>
          <ChevronDown size={14} className="text-gray-400 transition-transform group-open/proposal:rotate-180" />
        </summary>
        <div className="px-3 pb-3 pt-1 text-xs text-gray-600 space-y-2">
          <p className="font-medium text-gray-700">Instance flow (reference):</p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Per-dataset: <code className="bg-gray-200 px-1 rounded">score_numeric_auto</code> / <code className="bg-gray-200 px-1 rounded">score_building_typology</code> → <code className="bg-gray-200 px-1 rounded">instance_dataset_scores</code>, <code className="bg-gray-200 px-1 rounded">instance_category_scores</code></li>
            <li>Category aggregation: weighted mean (or configurable) per theme/pillar</li>
            <li>Framework rollup: <code className="bg-gray-200 px-1 rounded">score_framework_aggregate</code> → P1, P2, P3 with methods/weights</li>
            <li>Final: <code className="bg-gray-200 px-1 rounded">score_final_aggregate</code> → SSC Framework + Hazard + Underlying Vuln → Overall</li>
          </ol>
          <p className="font-medium text-gray-700 mt-2">Current baseline (<code className="bg-gray-200 px-1 rounded">score_baseline</code>):</p>
          <p className="ml-1">Per-dataset min-max or categorical → <code className="bg-gray-200 px-1 rounded">baseline_scores</code> by category. No theme-level aggregation; no P1/P2/P3 rollup; no Overall.</p>
          <p className="font-medium text-gray-700 mt-2">Proposed baseline scoring (align with instances):</p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Per-dataset: use <code className="bg-gray-200 px-1 rounded">baseline_datasets.scoring_config</code> (normalization, thresholds, category_scores) and write per-dataset scores (e.g. <code className="bg-gray-200 px-1 rounded">baseline_dataset_scores</code> or in-memory).</li>
            <li>Category aggregation: for each (baseline_id, admin_pcode, category), weighted mean of dataset scores in that category → <code className="bg-gray-200 px-1 rounded">baseline_scores</code> or <code className="bg-gray-200 px-1 rounded">baseline_category_scores</code>.</li>
            <li>Framework rollup: same logic as <code className="bg-gray-200 px-1 rounded">score_framework_aggregate</code> but for baseline (P1, P2, P3 → SSC Framework).</li>
            <li>Final: SSC + Hazard + Underlying Vuln → Overall, stored for baseline.</li>
          </ol>
          <p className="ml-1 text-gray-500 italic">This would let responses use baseline Overall/theme scores in the same way instances do, and keep category keys (P1.1, P3.2, etc.) aligned.</p>
        </div>
      </details>

      {/* Pillar & overall aggregation config panel */}
      <div className="border border-teal-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-teal-50 px-4 py-2.5 border-b border-teal-200">
          <h4 className="font-semibold text-teal-900">Pillar & overall aggregation</h4>
          <p className="text-xs text-teal-700 mt-0.5">
            How P1/P2/P3 combine into SSC Framework, and how SSC Framework + Hazard + Underlying Vuln combine into Overall (used when computing baseline scores).
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Pillar rollup (P1, P2, P3 → SSC Framework)</label>
            <select
              value={pillarRollup.method}
              onChange={(e) => setPillarRollup((p) => ({ ...p, method: e.target.value as AggregationMethod }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="average">Average (Mean)</option>
              <option value="worst_case">Worst Case (Maximum)</option>
              <option value="custom_weighted">Custom weights</option>
              <option value="ssc_decision_tree">Decision Tree</option>
            </select>
            {pillarRollup.method === 'ssc_decision_tree' && (
              <p className="text-xs text-gray-500 mt-1">
                Uses the SSC lookup: P1 (shelter) dominates, then P2/P3. Edit in Admin → Decision Tree.
              </p>
            )}
            {pillarRollup.method === 'custom_weighted' && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {['P1', 'P2', 'P3'].map((k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="text-xs w-6">{k}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={((pillarRollup.weights[k] ?? 0) * 100)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) / 100;
                        const next = { ...pillarRollup.weights, [k]: v };
                        setPillarRollup((p) => ({ ...p, weights: normalizeWeights(next) }));
                      }}
                      className="flex-1 h-2"
                    />
                    <span className="text-xs w-8">{((pillarRollup.weights[k] ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Overall rollup (SSC Framework + Hazard + Underlying Vuln → Overall)</label>
            <select
              value={overallRollup.method}
              onChange={(e) => setOverallRollup((p) => ({ ...p, method: e.target.value as AggregationMethod }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="average">Average (Mean)</option>
              <option value="worst_case">Worst Case (Maximum)</option>
              <option value="custom_weighted">Custom weights</option>
            </select>
            {overallRollup.method === 'custom_weighted' && (
              <div className="mt-2 space-y-1.5">
                {[
                  { key: 'SSC Framework', label: 'SSC Framework' },
                  { key: 'Hazard', label: 'Hazard' },
                  { key: 'Underlying Vulnerability', label: 'Underlying Vuln' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs w-32">{label}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={((overallRollup.weights[key] ?? 0) * 100)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) / 100;
                        const next = { ...overallRollup.weights, [key]: v };
                        setOverallRollup((p) => ({ ...p, weights: normalizeWeights(next) }));
                      }}
                      className="flex-1 h-2"
                    />
                    <span className="text-xs w-8">{((overallRollup.weights[key] ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleSaveAggregationConfig}
            className="btn btn-primary text-sm"
          >
            Save aggregation config
          </button>
        </div>
      </div>

      {/* Header with actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <h3 className="font-semibold">Framework Datasets</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium" title="Sections come from get_framework_structure (DB)">from DB</span>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">{baselineDatasets.length} datasets</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showEmptyThemes}
              onChange={(e) => setShowEmptyThemes(e.target.checked)}
              className="rounded"
            />
            Show empty categories
          </label>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary flex items-center gap-1"
          >
            <Plus size={16} />
            Add Dataset
          </button>
          <button 
            onClick={loadData}
            className="btn btn-secondary flex items-center gap-1"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {baselineDatasets.length === 0 && availableDatasets.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center border rounded-lg">
          <p className="mb-2">No datasets available for this country.</p>
          <p className="text-xs text-gray-400">
            {baselineCountryId || currentCountry?.id 
              ? 'Upload datasets for this country to add them to the baseline.'
              : 'Please select a country first.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {baselineDatasets.length === 0 && (
            <div className="text-sm text-gray-500 py-4 text-center border rounded-lg bg-gray-50/50">
              No datasets configured yet. Add datasets below to define the baseline vulnerability analysis.
            </div>
          )}
          {/* Overall structure: each pillar (P1, P2, P3) with its themes (Hazard, Underlying Vuln under P3, etc.) always visible */}
          {pillarThemeStructure.map(({ pillar, themes }) => {
            const pillarItems = groupedBySection[pillar.code] || [];
            const pillarBg = 'bg-red-50';
            const pillarText = 'text-red-900';
            const filteredThemes =
              pillar.code === 'P3'
                ? themes.filter((t) => t.code !== 'P3.2' && t.code !== 'P3.1')
                : themes;
            return (
              <div key={pillar.code} className="border rounded-lg overflow-hidden border-red-100">
                <div className={`px-4 py-2.5 ${pillarBg} border-b border-red-100`}>
                  <h4 className={`font-semibold ${pillarText}`}>
                    {pillar.code} – {pillar.name}
                    {pillarItems.length > 0 && (
                      <span className="font-normal text-red-700 ml-1">
                        ({pillarItems.length} at pillar level)
                      </span>
                    )}
                  </h4>
                </div>
                <div className="divide-y divide-gray-100">
                  {(showEmptyThemes ? filteredThemes : filteredThemes.filter((t) => (groupedBySection[t.code]?.length ?? 0) > 0)).map((theme) => {
                    const items = groupedBySection[theme.code] || [];
                    const isHazardOrVuln = theme.code === 'P3.2' || theme.code === 'P3.1';
                    const themeBg = isHazardOrVuln ? (theme.code === 'P3.2' ? 'bg-orange-50' : 'bg-amber-50') : 'bg-gray-50';
                    const themeText = isHazardOrVuln ? (theme.code === 'P3.2' ? 'text-orange-900' : 'text-amber-900') : 'text-gray-800';
                    if (items.length > 0) {
                      return (
                        <div key={theme.code} className="border-t border-gray-100">
                          <div className={`px-4 py-2 ${themeBg} border-b border-gray-100`}>
                            <h5 className={`text-sm font-semibold ${themeText}`}>
                              {theme.code} – {theme.name} ({items.length} dataset{items.length !== 1 ? 's' : ''})
                            </h5>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {items.map((bd) => renderDatasetRow(bd))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={theme.code}
                        className={`px-4 py-1.5 text-xs ${themeBg} border-t border-gray-100 text-gray-500 italic`}
                      >
                        {theme.code} – {theme.name} (0 datasets)
                      </div>
                    );
                  })}
                  {pillarItems.length > 0 && (
                    <div className="border-t border-gray-100">
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <h5 className="text-sm font-semibold text-gray-800">
                          {pillar.code} (pillar-level datasets)
                        </h5>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {pillarItems.map((bd) => renderDatasetRow(bd))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Hazards + Underlying Vulnerabilities AFTER pillars (Hazards first) */}
          {(['P3.2', 'P3.1'] as const).map((code) => {
            const items = groupedBySection[code] || [];
            const title = code === 'P3.2' ? 'Haz – Hazards' : 'UV – Underlying Vulnerabilities';
            const bg = code === 'P3.2' ? 'bg-orange-50' : 'bg-amber-50';
            const border = code === 'P3.2' ? 'border-orange-200' : 'border-amber-200';
            const text = code === 'P3.2' ? 'text-orange-900' : 'text-amber-900';
            const theme = frameworkSections.find((s) => s.code === code);
            const themeName = theme?.name || (code === 'P3.2' ? 'Hazards (P3.2)' : 'Underlying Vulnerabilities (P3.1)');
            if (!showEmptyThemes && items.length === 0) return null;
            return (
              <div key={code} className={`border rounded-lg overflow-hidden ${border}`}>
                <div className={`px-4 py-2.5 ${bg} border-b ${border}`}>
                  <h4 className={`font-semibold ${text}`}>
                    {title}
                    <span className="font-normal ml-2 text-xs text-gray-600">
                      {code} — {themeName}
                    </span>
                    {items.length > 0 && (
                      <span className="font-normal ml-2 text-xs text-gray-600">
                        ({items.length} dataset{items.length !== 1 ? 's' : ''})
                      </span>
                    )}
                  </h4>
                </div>
                {items.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {items.map((bd) => renderDatasetRow(bd))}
                  </div>
                ) : (
                  <div className={`px-4 py-2 text-xs ${bg} text-gray-500 italic`}>
                    No datasets.
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized datasets */}
          {groupedBySection['Uncategorized'] && groupedBySection['Uncategorized'].length > 0 && (
            <div className="border border-yellow-300 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-300">
                <h4 className="font-semibold text-yellow-900">⚠️ Uncategorized Datasets</h4>
                <p className="text-xs text-yellow-700 mt-0.5">
                  These datasets need to be assigned to a framework category
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {groupedBySection['Uncategorized'].map((bd) => renderDatasetRow(bd))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* Add Dataset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">Add Dataset to Baseline</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Dataset</label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select a dataset...</option>
                  {availableDatasets.length === 0 ? (
                    <option value="" disabled>
                      {baselineCountryId || currentCountry?.id 
                        ? 'No datasets available for this country' 
                        : 'No country selected - please select a country first'}
                    </option>
                  ) : (
                    availableDatasets
                      .filter(ds => !baselineDatasets.some(bd => bd.dataset_id === ds.id))
                      .map(ds => (
                        <option key={ds.id} value={ds.id}>
                          {ds.name} ({ds.admin_level}, {ds.type})
                        </option>
                      ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Framework Category</label>
                <p className="text-xs text-gray-500 mb-2">
                  Click to drill down through Pillar → Theme → Subtheme hierarchy
                </p>
                {renderCategorySelector(selectedCategory, setSelectedCategory, 'add-dataset')}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Weight</label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={selectedWeight}
                  onChange={(e) => setSelectedWeight(parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher weight = more influence on category score (default: 1.0)
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedDatasetId('');
                  setSelectedCategory(categories.length > 0 ? categories[0] : '');
                  setSelectedWeight(1.0);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDataset}
                disabled={!selectedDatasetId || saving}
                className="btn btn-primary"
              >
                {saving ? 'Adding...' : 'Add Dataset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scoring Configuration Modal */}
      {showScoringModal && scoringDataset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Configure Scoring</h3>
              <button 
                onClick={() => { setShowScoringModal(false); setScoringDataset(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="font-medium">{scoringDataset.dataset?.name}</div>
              <div className="text-sm text-gray-500">
                {scoringDataset.dataset?.admin_level} • {scoringDataset.dataset?.type}
              </div>
            </div>

            {scoringDataset.dataset?.type === 'numeric' ? (
              /* Numeric Dataset Scoring */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Scoring Method</label>
                  <select
                    value={scoringMethod}
                    onChange={(e) => setScoringMethod(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="normalization">Normalization (Min-Max)</option>
                    <option value="percentile">Percentile (Quintiles)</option>
                    <option value="equal_interval">Equal Interval</option>
                    <option value="natural_breaks">Natural Breaks (Jenks)</option>
                    <option value="custom">Custom Thresholds</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {scoringMethod === 'normalization' && 'Linear scaling: min value → lowest score, max value → highest score, continuous values in between'}
                    {scoringMethod === 'percentile' && 'Divides data into equal groups by rank (assigns discrete scores 1, 2, 3, etc.)'}
                    {scoringMethod === 'equal_interval' && 'Divides the value range into equal intervals (assigns discrete scores)'}
                    {scoringMethod === 'natural_breaks' && 'Uses statistical clustering to find natural groupings (assigns discrete scores)'}
                    {scoringMethod === 'custom' && 'Define your own threshold values for discrete score assignment'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Score Range</label>
                  <div className="flex items-center gap-3">
                    <select
                      value={`${scoreRange.min}-${scoreRange.max}`}
                      onChange={(e) => {
                        const [min, max] = e.target.value.split('-').map(Number);
                        setScoreRange({min, max});
                      }}
                      className="px-3 py-2 border rounded-lg"
                    >
                      <option value="1-3">1-3 (Low/Medium/High)</option>
                      <option value="1-4">1-4 (Four levels)</option>
                      <option value="1-5">1-5 (Five levels - standard)</option>
                    </select>
                    <span className="text-sm text-gray-500">
                      {scoreRange.max} = highest vulnerability
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="inverse"
                    checked={scoringInverse}
                    onChange={(e) => setScoringInverse(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="inverse" className="text-sm">
                    <span className="font-medium">Inverse scoring</span>
                    <p className="text-gray-500 text-xs">
                      Check if higher data values mean LOWER vulnerability (e.g., population density, income, access to services)
                    </p>
                  </label>
                </div>

                {scoringMethod === 'custom' && (
                  <div className="border rounded-lg p-4 bg-white">
                    <label className="block text-sm font-medium mb-3">
                      Define Thresholds
                    </label>
                    <div className="space-y-3">
                      {Array.from({length: scoreRange.max - scoreRange.min}, (_, i) => {
                        const scoreAbove = scoringInverse ? i + 1 : scoreRange.max - i;
                        const scoreBelow = scoringInverse ? i + 2 : scoreRange.max - i - 1;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <input
                              type="number"
                              placeholder={`Threshold ${i + 1}`}
                              value={scoringThresholds[i] || ''}
                              onChange={(e) => {
                                const newThresholds = [...scoringThresholds];
                                newThresholds[i] = parseFloat(e.target.value) || 0;
                                setScoringThresholds(newThresholds);
                              }}
                              className="w-28 px-3 py-2 border rounded text-sm"
                            />
                            <span className="text-sm text-gray-600">
                              {scoringInverse 
                                ? `Above → Score ${scoreAbove}, Below → Score ${scoreBelow}`
                                : `Below → Score ${scoreBelow}, Above → Score ${scoreAbove}`
                              }
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Example preview */}
                    {scoringThresholds.filter(t => t > 0).length === scoreRange.max - scoreRange.min && (
                      <div className="mt-4 p-3 bg-blue-50 rounded text-xs">
                        <strong>Preview:</strong>
                        <ul className="mt-1 space-y-1">
                          {scoringInverse ? (
                            <>
                              <li>• Values {'>'} {scoringThresholds[0]} → Score 1</li>
                              {scoringThresholds.slice(0, -1).map((t, i) => (
                                <li key={i}>• Values {scoringThresholds[i+1]} - {t} → Score {i + 2}</li>
                              ))}
                              <li>• Values {'<'} {scoringThresholds[scoringThresholds.length - 1]} → Score {scoreRange.max}</li>
                            </>
                          ) : (
                            <>
                              <li>• Values {'<'} {scoringThresholds[0]} → Score 1</li>
                              {scoringThresholds.slice(0, -1).map((t, i) => (
                                <li key={i}>• Values {t} - {scoringThresholds[i+1]} → Score {i + 2}</li>
                              ))}
                              <li>• Values {'>'} {scoringThresholds[scoringThresholds.length - 1]} → Score {scoreRange.max}</li>
                            </>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 bg-blue-50 rounded-lg flex gap-2">
                  <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-800">
                    Scores will be normalized to a {scoreRange.min}-{scoreRange.max} scale where {scoreRange.max} indicates highest vulnerability.
                    The scoring will be computed when you click "Compute Baseline Scores".
                  </p>
                </div>
              </div>
            ) : (
              /* Categorical Dataset Scoring */
              <div className="space-y-4">
                <div className="p-3 bg-yellow-50 rounded-lg flex gap-2">
                  <Info size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-800">
                    Assign a vulnerability score ({scoreRange.min}-{scoreRange.max}) to each category. Higher scores indicate higher vulnerability.
                    Categories not assigned will use the average score.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Score Range</label>
                  <select
                    value={`${scoreRange.min}-${scoreRange.max}`}
                    onChange={(e) => {
                      const [min, max] = e.target.value.split('-').map(Number);
                      setScoreRange({min, max});
                    }}
                    className="px-3 py-2 border rounded-lg"
                  >
                    <option value="1-3">1-3 (Low/Medium/High)</option>
                    <option value="1-4">1-4 (Four levels)</option>
                    <option value="1-5">1-5 (Five levels - standard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Category Scores</label>
                  {loadingCategories ? (
                    <div className="text-sm text-gray-500 py-4 text-center">
                      Loading categories from dataset...
                    </div>
                  ) : datasetCategories.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {datasetCategories.map(cat => (
                        <div key={cat} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded">
                          <span className="text-sm flex-1 truncate" title={cat}>{cat}</span>
                          <select
                            value={categoryScores[cat] || Math.ceil((scoreRange.max - scoreRange.min + 1) / 2)}
                            onChange={(e) => setCategoryScores(prev => ({
                              ...prev,
                              [cat]: parseInt(e.target.value)
                            }))}
                            className="px-2 py-1 border rounded text-sm min-w-[120px]"
                          >
                            {Array.from({length: scoreRange.max - scoreRange.min + 1}, (_, i) => scoreRange.min + i).map(score => {
                              const labels: Record<number, string[]> = {
                                3: ['Low', 'Medium', 'High'],
                                4: ['Very Low', 'Low', 'High', 'Very High'],
                                5: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
                              };
                              const range = scoreRange.max - scoreRange.min + 1;
                              const label = labels[range]?.[score - scoreRange.min] || `Level ${score}`;
                              return (
                                <option key={score} value={score}>{score} - {label}</option>
                              );
                            })}
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 py-4 text-center border rounded">
                      No categories found in dataset. The dataset may not have categorical values.
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {datasetCategories.length} categories found in dataset
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowScoringModal(false); setScoringDataset(null); }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScoring}
                className="btn btn-primary"
              >
                Save Scoring Config
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Category selector dropdown in portal; open upward when near bottom so it stays on screen */}
      {categorySelectorOpen && typeof document !== 'undefined' && createPortal(
        (() => {
          const DROPDOWN_MAX_H = 320;
          const rect = categorySelectorOpen.rect;
          const openUp = typeof window !== 'undefined' && rect.bottom + DROPDOWN_MAX_H + 8 > window.innerHeight;
          return (
        <div
          data-category-selector-portal
          className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-y-auto"
          style={{
            position: 'fixed',
            left: rect.left,
            ...(openUp
              ? { bottom: window.innerHeight - rect.top + 4, maxHeight: DROPDOWN_MAX_H }
              : { top: rect.bottom + 4, maxHeight: DROPDOWN_MAX_H }
            ),
            minWidth: 350,
            maxWidth: 450,
            zIndex: 99999,
          }}
        >
          <HierarchicalCategorySelector
            value={categorySelectorOpen.currentCategory}
            onChange={(c) => {
              categorySelectorOpen.onChange(c);
              setCategorySelectorOpen(null);
            }}
            onClose={() => setCategorySelectorOpen(null)}
          />
        </div>
          );
        })(),
        document.body
      )}
    </>
  );
}
