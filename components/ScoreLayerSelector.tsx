"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface ScoreLayerSelectorProps {
  instanceId: string;
  onSelect?: (selection: { type: 'overall' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, datasetName?: string, categoryName?: string, hazardEventId?: string }) => void;
}

export default function ScoreLayerSelector({ instanceId, onSelect }: ScoreLayerSelectorProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [categoryScores, setCategoryScores] = useState<Record<string, number>>({}); // Average scores per category
  const [activeSelection, setActiveSelection] = useState<{ type: 'overall' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, hazardEventId?: string }>({ type: 'overall' });
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [datasetCategories, setDatasetCategories] = useState<Record<string, string[]>>({});
  const [loadingCategories, setLoadingCategories] = useState<Record<string, boolean>>({});
  const [hazardEvents, setHazardEvents] = useState<any[]>([]);
  const [hazardEventScores, setHazardEventScores] = useState<Record<string, number>>({});

  // ✅ Load datasets linked to this instance
  useEffect(() => {
    const loadDatasets = async () => {
      setLoading(true);
      try {
        // Load instance_datasets with dataset info (including category)
        const { data: instanceDatasets, error: idError } = await supabase
          .from("instance_datasets")
          .select(`
            dataset_id,
            datasets (
              id,
              name,
              type,
              admin_level,
              category
            )
          `)
          .eq("instance_id", instanceId);

        if (idError) {
          console.error("Error loading instance datasets:", idError);
          setDatasets([]);
          setLoading(false);
          return;
        }

        if (!instanceDatasets || instanceDatasets.length === 0) {
          setDatasets([]);
          setLoading(false);
          return;
        }

        // Get dataset IDs
        const datasetIds = instanceDatasets
          .map((id: any) => id.dataset_id)
          .filter((id: string) => id);

        if (datasetIds.length === 0) {
          setDatasets([]);
          setLoading(false);
          return;
        }

        // Load configs separately (no direct FK relationship)
        const { data: configs } = await supabase
          .from("instance_dataset_config")
          .select("dataset_id, score_config")
          .eq("instance_id", instanceId)
          .in("dataset_id", datasetIds);

        // Create config map
        const configMap = new Map(
          (configs || []).map((c: any) => [c.dataset_id, c.score_config])
        );

        // Get average scores for each dataset
        let avgScores: Record<string, number> = {};
        const { data: scoresData } = await supabase
          .from("instance_dataset_scores")
          .select("dataset_id, score")
          .eq("instance_id", instanceId)
          .in("dataset_id", datasetIds);

        if (scoresData) {
          // Calculate average score per dataset
          const scoreMap: Record<string, { sum: number; count: number }> = {};
          scoresData.forEach((s: any) => {
            if (!scoreMap[s.dataset_id]) {
              scoreMap[s.dataset_id] = { sum: 0, count: 0 };
            }
            scoreMap[s.dataset_id].sum += Number(s.score);
            scoreMap[s.dataset_id].count += 1;
          });

          Object.keys(scoreMap).forEach((datasetId) => {
            avgScores[datasetId] = scoreMap[datasetId].sum / scoreMap[datasetId].count;
          });
          
          // Calculate average score per category (aggregate of all datasets in category)
          // Create a map of dataset_id to category
          const datasetToCategory: Record<string, string> = {};
          instanceDatasets.forEach((id: any) => {
            const category = id.datasets?.category;
            if (category) {
              datasetToCategory[id.dataset_id] = category;
            }
          });
          
          const categoryScoreMap: Record<string, { sum: number; count: number }> = {};
          scoresData.forEach((s: any) => {
            const category = datasetToCategory[s.dataset_id];
            if (category) {
              if (!categoryScoreMap[category]) {
                categoryScoreMap[category] = { sum: 0, count: 0 };
              }
              categoryScoreMap[category].sum += Number(s.score);
              categoryScoreMap[category].count += 1;
            }
          });
          
          const categoryAvgs: Record<string, number> = {};
          Object.keys(categoryScoreMap).forEach((category) => {
            categoryAvgs[category] = categoryScoreMap[category].sum / categoryScoreMap[category].count;
          });
          setCategoryScores(categoryAvgs);
        }

        // Transform data
        const transformed = instanceDatasets.map((id: any) => {
          const dataset = id.datasets;
          const config: any = configMap.get(id.dataset_id) || {};
          // Use dataset.category first, then config.category, then default
          const category = dataset?.category || config?.category || "Uncategorized";
          
          return {
            dataset_id: id.dataset_id,
            dataset_name: dataset?.name || `Dataset ${id.dataset_id}`,
            type: dataset?.type || 'numeric',
            category: category,
            avg_score: avgScores[id.dataset_id] || null,
          };
        });

        setDatasets(transformed);

        // Load hazard events
        // Try RPC function first, fallback to direct table query
        let hazardEventsData: any[] = [];
        const { data: rpcData, error: hazardError } = await supabase
          .rpc('get_hazard_events_for_instance', { in_instance_id: instanceId });

        if (hazardError) {
          console.warn('RPC function failed, trying direct query:', hazardError);
          // Fallback: query table directly
          const { data: tableData, error: tableError } = await supabase
            .from('hazard_events')
            .select('id, name, description, event_type, magnitude_field, metadata, created_at')
            .eq('instance_id', instanceId)
            .order('created_at', { ascending: false });

          if (tableError) {
            console.error('Error loading hazard events:', tableError);
          } else if (tableData) {
            // Convert to expected format with geojson from metadata
            hazardEventsData = tableData.map((event: any) => ({
              ...event,
              geojson: event.metadata?.original_geojson || null,
            }));
          }
        } else if (rpcData) {
          hazardEventsData = rpcData;
        }

        if (hazardEventsData && hazardEventsData.length > 0) {
          console.log(`Loaded ${hazardEventsData.length} hazard events`);
          setHazardEvents(hazardEventsData);

          // Get average scores for each hazard event
          const hazardEventIds = hazardEventsData.map((e: any) => e.id);
          if (hazardEventIds.length > 0) {
            const { data: scoresData } = await supabase
              .from("hazard_event_scores")
              .select("hazard_event_id, score")
              .eq("instance_id", instanceId)
              .in("hazard_event_id", hazardEventIds);

            if (scoresData) {
              const scoreMap: Record<string, { sum: number; count: number }> = {};
              scoresData.forEach((s: any) => {
                if (!scoreMap[s.hazard_event_id]) {
                  scoreMap[s.hazard_event_id] = { sum: 0, count: 0 };
                }
                scoreMap[s.hazard_event_id].sum += Number(s.score);
                scoreMap[s.hazard_event_id].count += 1;
              });

              const avgScores: Record<string, number> = {};
              Object.keys(scoreMap).forEach((eventId) => {
                avgScores[eventId] = scoreMap[eventId].sum / scoreMap[eventId].count;
              });
              setHazardEventScores(avgScores);
            }
          }
        }
      } catch (err) {
        console.error("Error loading datasets:", err);
        setDatasets([]);
      }
      setLoading(false);
    };
    loadDatasets();
  }, [instanceId]);

  // ✅ Handle selection
  const handleSelect = (type: 'overall' | 'dataset' | 'category' | 'category_score' | 'hazard_event', datasetId?: string, category?: string, datasetName?: string, categoryName?: string, hazardEventId?: string) => {
    const selection = { type, datasetId, category, hazardEventId };
    setActiveSelection(selection);
    if (onSelect) {
      onSelect({ ...selection, datasetName, categoryName });
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
  const grouped: Record<string, any[]> = datasets.reduce((acc: Record<string, any[]>, d: any) => {
    const cat = d.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {});

  // ✅ Get categories for categorical datasets
  const loadCategoriesForDataset = async (datasetId: string) => {
    if (datasetCategories[datasetId]) return; // Already loaded
    
    setLoadingCategories(prev => ({ ...prev, [datasetId]: true }));
    try {
      const { data } = await supabase
        .from("dataset_values_categorical")
        .select("category")
        .eq("dataset_id", datasetId)
        .limit(1000);
      
      const uniqueCategories = [...new Set((data || []).map((d: any) => d.category))].sort();
      setDatasetCategories(prev => ({ ...prev, [datasetId]: uniqueCategories }));
    } catch (err) {
      console.error("Error loading categories:", err);
    } finally {
      setLoadingCategories(prev => ({ ...prev, [datasetId]: false }));
    }
  };

  if (loading) return <p className="text-xs" style={{ color: 'var(--gsc-gray)' }}>Loading layers...</p>;

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

      {Object.entries(grouped).map(([cat, list]) => (
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
              {list.map((d) => (
                <div key={d.dataset_id}>
                  <button
                    onClick={() => {
                      handleSelect('dataset', d.dataset_id, undefined, d.dataset_name);
                      if (d.type === 'categorical') {
                        loadCategoriesForDataset(d.dataset_id);
                      }
                    }}
                    className="block w-full text-left px-1.5 py-1 rounded text-xs transition-colors"
                    style={{
                      backgroundColor: (activeSelection.type === 'dataset' && activeSelection.datasetId === d.dataset_id && !activeSelection.category) || 
                                     (activeSelection.type === 'category' && activeSelection.datasetId === d.dataset_id)
                        ? 'var(--gsc-blue)'
                        : 'transparent',
                      color: (activeSelection.type === 'dataset' && activeSelection.datasetId === d.dataset_id && !activeSelection.category) || 
                            (activeSelection.type === 'category' && activeSelection.datasetId === d.dataset_id)
                        ? '#fff'
                        : 'var(--gsc-gray)'
                    }}
                    onMouseEnter={(e) => {
                      if (!((activeSelection.type === 'dataset' && activeSelection.datasetId === d.dataset_id && !activeSelection.category) || 
                            (activeSelection.type === 'category' && activeSelection.datasetId === d.dataset_id))) {
                        e.currentTarget.style.backgroundColor = 'var(--gsc-light-gray)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!((activeSelection.type === 'dataset' && activeSelection.datasetId === d.dataset_id && !activeSelection.category) || 
                            (activeSelection.type === 'category' && activeSelection.datasetId === d.dataset_id))) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                  {d.dataset_name}
                  {d.avg_score !== null && (
                    <span className="float-right text-xs opacity-75">
                      {Number(d.avg_score).toFixed(1)}
                    </span>
                  )}
                </button>
                {d.type === 'categorical' && activeSelection.datasetId === d.dataset_id && (
                  <div className="ml-1.5 mt-0.5 space-y-0.5">
                    <button
                      onClick={() => handleSelect('category', d.dataset_id, 'overall', d.dataset_name)}
                      className="block w-full text-left px-1.5 py-0.5 rounded text-xs transition-colors"
                        style={{
                          backgroundColor: activeSelection.type === 'category' && activeSelection.category === 'overall'
                            ? 'rgba(0, 75, 135, 0.7)'
                            : 'var(--gsc-light-gray)',
                          color: activeSelection.type === 'category' && activeSelection.category === 'overall'
                            ? '#fff'
                            : 'var(--gsc-gray)'
                        }}
                      >
                        Overall
                      </button>
                      {loadingCategories[d.dataset_id] && (
                        <div className="text-xs px-1.5 py-0.5" style={{ color: 'var(--gsc-gray)' }}>Loading categories...</div>
                      )}
                      {!loadingCategories[d.dataset_id] && datasetCategories[d.dataset_id]?.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleSelect('category', d.dataset_id, cat, d.dataset_name)}
                          className="block w-full text-left px-1.5 py-0.5 rounded text-xs transition-colors"
                          style={{
                            backgroundColor: activeSelection.type === 'category' && activeSelection.category === cat
                              ? 'rgba(0, 75, 135, 0.7)'
                              : 'var(--gsc-light-gray)',
                            color: activeSelection.type === 'category' && activeSelection.category === cat
                              ? '#fff'
                              : 'var(--gsc-gray)'
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Hazard Events Section */}
      {hazardEvents.length > 0 && (
        <div className="mb-1 mt-3 border-t pt-2">
          <h4 className="font-semibold text-xs mb-1" style={{ color: 'var(--gsc-gray)' }}>Hazard Events</h4>
          {hazardEvents.map((event) => (
            <div key={event.id} className="mb-0.5">
              <button
                onClick={() => handleSelect('hazard_event', undefined, undefined, undefined, undefined, event.id)}
                className="block w-full text-left px-1.5 py-1 rounded text-xs transition-colors"
                style={{
                  backgroundColor: activeSelection.type === 'hazard_event' && activeSelection.hazardEventId === event.id
                    ? 'var(--gsc-blue)'
                    : 'transparent',
                  color: activeSelection.type === 'hazard_event' && activeSelection.hazardEventId === event.id
                    ? '#fff'
                    : 'var(--gsc-gray)'
                }}
                onMouseEnter={(e) => {
                  if (!(activeSelection.type === 'hazard_event' && activeSelection.hazardEventId === event.id)) {
                    e.currentTarget.style.backgroundColor = 'var(--gsc-light-gray)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(activeSelection.type === 'hazard_event' && activeSelection.hazardEventId === event.id)) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {event.name}
                {hazardEventScores[event.id] !== undefined && (
                  <span className="float-right text-xs opacity-75">
                    {Number(hazardEventScores[event.id]).toFixed(1)}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
