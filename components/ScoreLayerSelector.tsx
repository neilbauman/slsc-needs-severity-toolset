"use client";

import { useEffect, useMemo, useState } from "react";

export type LayerOption = {
  dataset_id: string;
  dataset_name: string;
  type?: string;
  category?: string;
  avg_score?: number | null;
  is_hazard_event?: boolean;
  hazard_event_id?: string;
};

export interface ScoreLayerSelectorProps {
  instanceId: string;
  layers?: LayerOption[];
  categoryScores?: Record<string, number>;
  onSelect?: (selection: { type: 'overall' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, datasetName?: string, categoryName?: string, hazardEventId?: string }) => void;
  onScoreHazardEvent?: (hazardEventId: string) => void; // Callback to open scoring modal
  visibleHazardEvents?: Set<string>; // Set of visible hazard event IDs
  onToggleHazardEventVisibility?: (hazardEventId: string, visible: boolean) => void; // Callback to toggle visibility
}

export default function ScoreLayerSelector({ layers = [], categoryScores = {}, onSelect, onScoreHazardEvent, visibleHazardEvents, onToggleHazardEventVisibility }: ScoreLayerSelectorProps) {
  const [activeSelection, setActiveSelection] = useState<{ type: 'overall' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, hazardEventId?: string }>({ type: 'overall' });
  // Initialize with all categories expanded by default
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // ✅ Handle selection
  const handleSelect = (type: 'overall' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, datasetName?: string, categoryName?: string, hazardEventId?: string) => {
    // If datasetId starts with 'hazard_event_', extract the actual hazard event ID
    if (datasetId && datasetId.startsWith('hazard_event_')) {
      const actualHazardEventId = datasetId.replace('hazard_event_', '');
      const selection = { type: 'hazard_event' as const, hazardEventId: actualHazardEventId };
      setActiveSelection(selection);
      if (onSelect) {
        onSelect({ ...selection, datasetName, categoryName });
      }
    } else {
      const selection = { type, datasetId, category, hazardEventId };
    setActiveSelection(selection);
    if (onSelect) {
      onSelect({ ...selection, datasetName, categoryName });
      }
    }
  };

  // ✅ Toggle category expansion
  const toggleCategory = (cat: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(cat)) {
      newExpanded.delete(cat);
    } else {
      newExpanded.add(cat);
    }
    setExpandedCategories(newExpanded);
  };

  // ✅ Group datasets by category
  const grouped: Record<string, LayerOption[]> = useMemo(() => {
    const acc: Record<string, LayerOption[]> = {};
    layers.forEach((d) => {
      const cat = d.category || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(d);
    });
    return acc;
  }, [layers]);

  // ✅ Expand all categories by default when datasets are loaded
  const categoryKeys = Object.keys(grouped);
  useEffect(() => {
    if (categoryKeys.length === 0) return;
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      let changed = false;
      categoryKeys.forEach((cat) => {
        if (!next.has(cat)) {
          next.add(cat);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [categoryKeys.join("|")]);

  const CATEGORY_ORDER = [
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Hazard',
    'Underlying Vulnerability',
  ];

  const sortCategories = (a: string, b: string) => {
    const indexA = CATEGORY_ORDER.indexOf(a);
    const indexB = CATEGORY_ORDER.indexOf(b);
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  };

  return (
    <div className="text-xs" style={{ color: 'var(--gsc-gray)' }}>
      {/* Overall Score Option */}
      <div className="mb-1">
        <button
          onClick={() => handleSelect('overall')}
          className="block w-full text-left px-1.5 py-1 rounded font-semibold text-xs transition-colors"
          style={{
            backgroundColor: activeSelection.type === 'overall' 
              ? 'var(--gsc-blue)' 
              : 'var(--gsc-light-gray)',
            color: activeSelection.type === 'overall' ? '#fff' : 'var(--gsc-gray)'
          }}
        >
          Overall Score
        </button>
      </div>

      {Object.keys(grouped).length === 0 && (
        <p className="italic text-xs" style={{ color: 'var(--gsc-gray)' }}>No datasets configured.</p>
      )}

      {Object.entries(grouped)
        .sort(([catA], [catB]) => sortCategories(catA, catB))
        .map(([cat, list]) => (
        <div key={cat} className="mb-1">
          <div className="flex items-center justify-between mb-0.5">
            <h4 className="font-semibold text-xs" style={{ color: 'var(--gsc-gray)' }}>{cat}</h4>
            {list.length > 0 && (
              <button
                onClick={() => toggleCategory(cat)}
                className="text-xs px-0.5 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--gsc-gray)' }}
              >
                {expandedCategories.has(cat) ? '−' : '+'}
              </button>
            )}
          </div>
          
          {/* Category Score Option (if category has datasets) */}
          {list.length > 0 && (
            <button
              onClick={() => handleSelect('category_score', undefined, cat, undefined, cat)}
              className="block w-full text-left px-1.5 py-1 rounded text-xs mb-0.5 font-medium border transition-colors"
              style={{
                backgroundColor: activeSelection.type === 'category_score' && activeSelection.category === cat
                  ? 'var(--gsc-blue)'
                  : 'rgba(0, 75, 135, 0.05)',
                borderColor: activeSelection.type === 'category_score' && activeSelection.category === cat
                  ? 'var(--gsc-blue)'
                  : 'rgba(0, 75, 135, 0.2)',
                color: activeSelection.type === 'category_score' && activeSelection.category === cat
                  ? '#fff'
                  : 'var(--gsc-blue)'
              }}
            >
              {cat} Score
              {categoryScores[cat] !== undefined && (
                <span className="float-right text-sm opacity-75">
                  {Number(categoryScores[cat]).toFixed(1)}
                </span>
              )}
            </button>
          )}
          
          {expandedCategories.has(cat) && (
            <div className="space-y-0.5 ml-1.5 mt-0.5">
              {list.map((d) => {
                // Check if this is a hazard event
                const isHazardEvent = (d as any).is_hazard_event || d.dataset_id?.startsWith('hazard_event_');
                const hazardEventId = isHazardEvent ? ((d as any).hazard_event_id || d.dataset_id?.replace('hazard_event_', '')) : null;
                
                return (
                <div key={d.dataset_id}>
                  <button
                    onClick={() => {
                      if (isHazardEvent && hazardEventId) {
                        handleSelect('hazard_event', d.dataset_id, undefined, d.dataset_name, undefined, hazardEventId);
                      } else {
                      handleSelect('dataset', d.dataset_id, undefined, d.dataset_name);
                      }
                    }}
                    className="block w-full text-left px-1.5 py-1 rounded text-xs transition-colors"
                    style={{
                      backgroundColor: (isHazardEvent && activeSelection.type === 'hazard_event' && activeSelection.hazardEventId === hazardEventId) ||
                                       (!isHazardEvent && ((activeSelection.type === 'dataset' && activeSelection.datasetId === d.dataset_id && !activeSelection.category) || 
                                        (activeSelection.type === 'category' && activeSelection.datasetId === d.dataset_id)))
                        ? 'var(--gsc-blue)'
                        : 'transparent',
                      color: (isHazardEvent && activeSelection.type === 'hazard_event' && activeSelection.hazardEventId === hazardEventId) ||
                             (!isHazardEvent && ((activeSelection.type === 'dataset' && activeSelection.datasetId === d.dataset_id && !activeSelection.category) || 
                              (activeSelection.type === 'category' && activeSelection.datasetId === d.dataset_id)))
                        ? '#fff'
                        : 'var(--gsc-gray)'
                    }}
                    onMouseEnter={(e) => {
                      const isSelected = (isHazardEvent && activeSelection.type === 'hazard_event' && activeSelection.hazardEventId === hazardEventId) ||
                                       (!isHazardEvent && ((activeSelection.type === 'dataset' && activeSelection.datasetId === d.dataset_id && !activeSelection.category) || 
                                        (activeSelection.type === 'category' && activeSelection.datasetId === d.dataset_id)));
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--gsc-light-gray)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const isSelected = (isHazardEvent && activeSelection.type === 'hazard_event' && activeSelection.hazardEventId === hazardEventId) ||
                                       (!isHazardEvent && ((activeSelection.type === 'dataset' && activeSelection.datasetId === d.dataset_id && !activeSelection.category) || 
                                        (activeSelection.type === 'category' && activeSelection.datasetId === d.dataset_id)));
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 flex-1">
                      {isHazardEvent && onToggleHazardEventVisibility && (
                        <input
                          type="checkbox"
                          checked={visibleHazardEvents?.has(hazardEventId || '') ?? true}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (hazardEventId && onToggleHazardEventVisibility) {
                              onToggleHazardEventVisibility(hazardEventId, e.target.checked);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-pointer"
                          title="Toggle visibility on map"
                        />
                      )}
                      <span className="flex-1">{d.dataset_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isHazardEvent && onScoreHazardEvent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hazardEventId && onScoreHazardEvent) {
                              onScoreHazardEvent(hazardEventId);
                            }
                          }}
                          className="text-xs px-1.5 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                          title="Score this hazard event"
                        >
                          Score
                        </button>
                      )}
                      {d.avg_score !== null && (
                        <span className="text-xs opacity-75">
                          {Number(d.avg_score).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                </div>
              );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
