'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, X } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';

type FrameworkStructure = {
  pillars: Array<{
    id: string;
    code: string;
    name: string;
    order_index?: number;
    indicators?: Array<{ id: string; code: string; name: string }>;
    themes?: Array<{
      id: string;
      code: string;
      name: string;
      order_index?: number;
      indicators?: Array<{ id: string; code: string; name: string }>;
      subthemes?: Array<{
        id: string;
        code: string;
        name: string;
        order_index?: number;
        indicators?: Array<{ id: string; code: string; name: string }>;
      }>;
    }>;
  }>;
};

type CategoryOption = {
  value: string;
  label: string;
  level: 'pillar' | 'theme' | 'subtheme' | 'hazard' | 'underlying';
  path: string[]; // Full path for display
};

interface Props {
  value: string;
  onChange: (category: string) => void;
  onClose?: () => void;
}

export default function HierarchicalCategorySelector({ value, onChange, onClose }: Props) {
  const supabase = createClient();
  const [structure, setStructure] = useState<FrameworkStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string[]>([]);

  // Load framework structure
  useEffect(() => {
    let cancelled = false;
    
    const loadStructure = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        // Query framework structure directly
        const [pillarsRes, themesRes, subthemesRes, indicatorsRes] = await Promise.all([
          supabase.from('framework_pillars').select('*').eq('is_active', true).order('order_index'),
          supabase.from('framework_themes').select('*').eq('is_active', true).order('order_index'),
          supabase.from('framework_subthemes').select('*').eq('is_active', true).order('order_index'),
          supabase.from('framework_indicators')
            .select('id, pillar_id, theme_id, subtheme_id, code, name')
            .eq('is_active', true)
            .order('order_index')
        ]);

        if (cancelled) return;

        if (pillarsRes.error) throw pillarsRes.error;
        if (themesRes.error) throw themesRes.error;
        if (subthemesRes.error) throw subthemesRes.error;
        if (indicatorsRes.error) throw indicatorsRes.error;

        const pillars = (pillarsRes.data || []).map(p => ({
          ...p,
          indicators: (indicatorsRes.data || []).filter(i => i.pillar_id === p.id),
          themes: (themesRes.data || [])
            .filter(t => t.pillar_id === p.id)
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
            .map(t => ({
              ...t,
              indicators: (indicatorsRes.data || []).filter(i => i.theme_id === t.id),
              subthemes: (subthemesRes.data || [])
                .filter(st => st.theme_id === t.id)
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map(st => ({
                  ...st,
                  indicators: (indicatorsRes.data || []).filter(i => i.subtheme_id === st.id)
                }))
            }))
        }));

        if (cancelled) return;

        setStructure({ pillars });
        
        // Batch all expansion updates into a single setState call
        const expandedKeys = new Set<string>();
        
        // Auto-expand P3 if it exists and has themes
        const p3 = pillars.find(p => p.code === 'P3');
        if (p3 && p3.themes && p3.themes.length > 0) {
          expandedKeys.add(`p-${p3.id}`);
        }
        
        // Parse current value to set selected path and expand
        let selectedPath: string[] = [];
        if (value && typeof value === 'string') {
          const parts = value.split(' - ');
          if (parts.length > 0) {
            const codePart = parts[0];
            selectedPath = codePart.split('.').filter(Boolean);
            
            // Auto-expand to show the selected path
            if (selectedPath.length >= 1) {
              const selectedPillar = pillars.find(p => p.code === selectedPath[0]);
              if (selectedPillar) {
                expandedKeys.add(`p-${selectedPillar.id}`);
                
                if (selectedPath.length >= 2 && selectedPillar.themes) {
                  const themeNum = parseInt(selectedPath[1]) || 1;
                  const theme = selectedPillar.themes.find(t => (t.order_index || 0) + 1 === themeNum);
                  if (theme) {
                    expandedKeys.add(`t-${theme.id}`);
                  }
                }
              }
            }
          }
        }
        
        // Update state in a single batch
        if (!cancelled) {
          setExpanded(expandedKeys);
          setSelectedPath(selectedPath);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[HierarchicalCategorySelector] Error loading framework structure:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    loadStructure();
    
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only load once on mount

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const buildCategoryString = (path: string[]): string => {
    if (path.length === 0) return '';
    
    // Find the item in the structure
    const pillar = structure?.pillars.find(p => p.code === path[0]);
    if (!pillar) return path.join('.');

    if (path.length === 1) {
      return `${pillar.code} - ${pillar.name}`;
    }

    const themeNum = parseInt(path[1]) || 1;
    const theme = pillar.themes?.find(t => (t.order_index || 0) + 1 === themeNum);

    if (!theme) return path.join('.');

    if (path.length === 2) {
      return `${path.join('.')} - ${theme.name}`;
    }

    const subthemeNum = parseInt(path[2]) || 1;
    const subtheme = theme.subthemes?.find(st => (st.order_index || 0) + 1 === subthemeNum);

    if (!subtheme) return path.join('.');

    return `${path.join('.')} - ${subtheme.name}`;
  };

  const handleSelect = (path: string[], label: string) => {
    if (!structure) return;
    
    const categoryString = buildCategoryString(path);
    
    if (!categoryString || categoryString === path.join('.')) {
      console.warn('[HierarchicalCategorySelector] Invalid category string, using path fallback');
    }
    
    setSelectedPath(path);
    // Call onChange - this triggers the parent's update
    onChange(categoryString);
    
    // Close the modal after a brief delay
    if (onClose) {
      setTimeout(() => {
        onClose();
      }, 100);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading framework structure...
      </div>
    );
  }

  if (!structure || structure.pillars.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No framework structure found. Please configure the framework first.
      </div>
    );
  }

  return (
    <div 
      className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between z-10">
        <h3 className="font-semibold text-sm text-gray-900">Select Framework Category</h3>
        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600"
            type="button"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Top-level categories */}
      <div className="p-2">
        {/* Pillars */}
        {structure.pillars.map((pillar) => {
          const pillarKey = `p-${pillar.id}`;
          const pillarPath = [pillar.code];
          const isExpanded = expanded.has(pillarKey);
          const isSelected = selectedPath.length === 1 && selectedPath[0] === pillar.code;
          const hasThemes = pillar.themes && pillar.themes.length > 0;

          return (
            <div key={pillar.id} className="mb-1">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                }`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (hasThemes) {
                          toggleExpand(pillarKey);
                        } else {
                          handleSelect(pillarPath, pillar.name);
                        }
                      }}
              >
                {pillar.themes && pillar.themes.length > 0 ? (
                  isExpanded ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )
                ) : (
                  <div className="w-4" />
                )}
                <span className="font-medium text-sm text-gray-900">
                  {pillar.code} - {pillar.name}
                </span>
                {pillar.indicators && pillar.indicators.length > 0 && (
                  <span className="text-xs text-gray-500 ml-auto">
                    {pillar.indicators.length} indicator{pillar.indicators.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Themes */}
              {isExpanded && pillar.themes && pillar.themes.map((theme) => {
                const themeNum = (theme.order_index || 0) + 1;
                const themeKey = `t-${theme.id}`;
                const themePath = [pillar.code, `${themeNum}`];
                const isThemeExpanded = expanded.has(themeKey);
                const isThemeSelected = selectedPath.length === 2 && 
                  selectedPath[0] === pillar.code && 
                  selectedPath[1] === `${themeNum}`;
                const hasSubthemes = theme.subthemes && theme.subthemes.length > 0;

                return (
                  <div key={theme.id} className="ml-6 mb-1">
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                        isThemeSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (hasSubthemes) {
                          toggleExpand(themeKey);
                        } else {
                          handleSelect(themePath, theme.name);
                        }
                      }}
                    >
                      {theme.subthemes && theme.subthemes.length > 0 ? (
                        isThemeExpanded ? (
                          <ChevronDown size={14} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={14} className="text-gray-400" />
                        )
                      ) : (
                        <div className="w-3.5" />
                      )}
                      <span className="text-sm text-gray-700">
                        {pillar.code}.{themeNum} - {theme.name}
                      </span>
                      {theme.indicators && theme.indicators.length > 0 && (
                        <span className="text-xs text-gray-500 ml-auto">
                          {theme.indicators.length} indicator{theme.indicators.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Subthemes */}
                    {isThemeExpanded && theme.subthemes && theme.subthemes.map((subtheme) => {
                      const subthemeNum = (subtheme.order_index || 0) + 1;
                      const subthemePath = [pillar.code, `${themeNum}`, `${subthemeNum}`];
                      const isSubthemeSelected = selectedPath.length === 3 &&
                        selectedPath[0] === pillar.code &&
                        selectedPath[1] === `${themeNum}` &&
                        selectedPath[2] === `${subthemeNum}`;

                      return (
                        <div
                          key={subtheme.id}
                          className={`ml-8 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                            isSubthemeSelected ? 'bg-blue-50 border border-blue-200 font-medium' : 'hover:bg-gray-50'
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSelect(subthemePath, subtheme.name);
                          }}
                        >
                          <span className="text-sm text-gray-600">
                            {pillar.code}.{themeNum}.{subthemeNum} - {subtheme.name}
                          </span>
                          {subtheme.indicators && subtheme.indicators.length > 0 && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({subtheme.indicators.length} indicator{subtheme.indicators.length !== 1 ? 's' : ''})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Hazards and Underlying Vulnerabilities */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="px-2 mb-2">
            <div className="text-xs font-semibold text-gray-500 uppercase">Other Categories</div>
          </div>
          <div
            className={`px-3 py-2 rounded cursor-pointer hover:bg-gray-50 ${
              selectedPath.length === 1 && selectedPath[0] === 'Hazard' ? 'bg-orange-50 border border-orange-200' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(['Hazard'], 'Hazard');
            }}
          >
            <span className="font-medium text-sm text-orange-700">
              Hazards
            </span>
          </div>
          <div
            className={`px-3 py-2 rounded cursor-pointer hover:bg-gray-50 ${
              selectedPath.length === 1 && selectedPath[0] === 'Underlying Vulnerability' ? 'bg-purple-50 border border-purple-200' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(['Underlying Vulnerability'], 'Underlying Vulnerability');
            }}
          >
            <span className="font-medium text-sm text-purple-700">
              Underlying Vulnerabilities
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
