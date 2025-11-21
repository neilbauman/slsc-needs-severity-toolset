"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface ScoreLayerSelectorProps {
  instanceId: string;
  onSelect?: (selection: { type: 'overall' | 'dataset' | 'category', datasetId?: string, category?: string, datasetName?: string }) => void;
}

export default function ScoreLayerSelector({ instanceId, onSelect }: ScoreLayerSelectorProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [activeSelection, setActiveSelection] = useState<{ type: 'overall' | 'dataset' | 'category', datasetId?: string, category?: string }>({ type: 'overall' });
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [datasetCategories, setDatasetCategories] = useState<Record<string, string[]>>({});
  const [loadingCategories, setLoadingCategories] = useState<Record<string, boolean>>({});

  // ✅ Load datasets linked to this instance
  useEffect(() => {
    const loadDatasets = async () => {
      setLoading(true);
      try {
        // Load instance_datasets with dataset info
        const { data: instanceDatasets, error: idError } = await supabase
          .from("instance_datasets")
          .select(`
            dataset_id,
            datasets (
              id,
              name,
              type,
              admin_level
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
      } catch (err) {
        console.error("Error loading datasets:", err);
        setDatasets([]);
      }
      setLoading(false);
    };
    loadDatasets();
  }, [instanceId]);

  // ✅ Handle selection
  const handleSelect = (type: 'overall' | 'dataset' | 'category', datasetId?: string, category?: string, datasetName?: string) => {
    const selection = { type, datasetId, category };
    setActiveSelection(selection);
    if (onSelect) {
      onSelect({ ...selection, datasetName });
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

  if (loading) return <p className="text-sm text-gray-500">Loading layers...</p>;

  return (
    <div className="text-sm text-gray-800">
      {/* Overall Score Option */}
      <div className="mb-3">
        <button
          onClick={() => handleSelect('overall')}
          className={`block w-full text-left px-2 py-1.5 rounded font-semibold text-sm ${
            activeSelection.type === 'overall'
              ? "bg-blue-600 text-white"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          Overall Score
        </button>
      </div>

      {Object.keys(grouped).length === 0 && (
        <p className="text-gray-400 italic text-sm">No datasets configured.</p>
      )}

      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} className="mb-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-700 mb-1 text-sm">{cat}</h4>
            {list.length > 0 && (
              <button
                onClick={() => toggleCategory(cat)}
                className="text-sm text-gray-500 hover:text-gray-700 px-1"
              >
                {expandedCategories.has(cat) ? '−' : '+'}
              </button>
            )}
          </div>
          {expandedCategories.has(cat) && (
            <div className="space-y-1 ml-2">
              {list.map((d) => (
                <div key={d.dataset_id}>
                  <button
                    onClick={() => {
                      handleSelect('dataset', d.dataset_id, undefined, d.dataset_name);
                      if (d.type === 'categorical') {
                        loadCategoriesForDataset(d.dataset_id);
                      }
                    }}
                    className={`block w-full text-left px-2 py-1.5 rounded text-sm ${
                      activeSelection.type === 'dataset' && activeSelection.datasetId === d.dataset_id && !activeSelection.category
                        ? "bg-blue-600 text-white"
                        : activeSelection.type === 'category' && activeSelection.datasetId === d.dataset_id
                        ? "bg-blue-500 text-white"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {d.dataset_name}
                    {d.avg_score !== null && (
                      <span className="float-right text-sm opacity-75">
                        {Number(d.avg_score).toFixed(1)}
                      </span>
                    )}
                  </button>
                  {d.type === 'categorical' && activeSelection.datasetId === d.dataset_id && (
                    <div className="ml-4 mt-1 space-y-1">
                      <button
                        onClick={() => handleSelect('category', d.dataset_id, 'overall', d.dataset_name)}
                        className={`block w-full text-left px-2 py-1 rounded text-sm ${
                          activeSelection.type === 'category' && activeSelection.category === 'overall'
                            ? "bg-blue-500 text-white"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        Overall
                      </button>
                      {loadingCategories[d.dataset_id] && (
                        <div className="text-sm text-gray-400 px-2 py-1">Loading categories...</div>
                      )}
                      {!loadingCategories[d.dataset_id] && datasetCategories[d.dataset_id]?.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleSelect('category', d.dataset_id, cat, d.dataset_name)}
                          className={`block w-full text-left px-2 py-1 rounded text-sm ${
                            activeSelection.type === 'category' && activeSelection.category === cat
                              ? "bg-blue-500 text-white"
                              : "bg-gray-50 hover:bg-gray-100"
                          }`}
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
    </div>
  );
}
