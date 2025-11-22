'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

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
  const [categories, setCategories] = useState<Record<string, CategoryData>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<'mean' | 'weighted_mean' | '20_percent' | 'custom'>(
    'weighted_mean'
  );
  const [loading, setLoading] = useState(false);

  const CATEGORY_ORDER = [
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Hazard',
    'Underlying Vulnerability',
  ];

  // Snap to nearest multiple of 5
  const snapToStep = (value: number, step = 5) => Math.round(value / step) * step;

  // Normalize dataset weights within a category
  const normalizeCategory = (cat: string) => {
    const categoryData = categories[cat] as CategoryData;
    if (!categoryData) return;
    
    const ds = categoryData.datasets;
    const total = ds.reduce((sum, d) => sum + (weights[d.id] || 0), 0);
    
    if (total === 0) {
      // If total is 0, distribute equally
      const equalWeight = 100 / ds.length;
      const newWeights = { ...weights };
      ds.forEach((d) => {
        newWeights[d.id] = snapToStep(equalWeight, 5);
      });
      setWeights(newWeights);
      return;
    }

    // Only normalize if total is significantly off from 100%
    // This allows users to adjust weights freely as long as they're close to 100%
    if (Math.abs(total - 100) < 0.5) {
      // Already close to 100%, just snap to exact 100%
      const scale = 100 / total;
      const newWeights = { ...weights };
      let sum = 0;
      
      ds.forEach((d) => {
        const scaled = (weights[d.id] || 0) * scale;
        newWeights[d.id] = scaled;
        sum += scaled;
      });
      
      // Adjust for any rounding differences
      const diff = 100 - sum;
      if (Math.abs(diff) > 0.01 && ds.length > 0) {
        const largest = ds.reduce((a, b) =>
          (newWeights[a.id] || 0) > (newWeights[b.id] || 0) ? a : b
        );
        newWeights[largest.id] = Math.max(0, Math.min(100, newWeights[largest.id] + diff));
      }
      
      setWeights(newWeights);
      return;
    }

    // If total is far from 100%, normalize proportionally
    const newWeights = { ...weights };
    const step = 1; // Use smaller step for smoother adjustment

    let sum = 0;
    ds.forEach((d) => {
      const normalized = (weights[d.id] || 0) / total * 100;
      newWeights[d.id] = normalized;
      sum += normalized;
    });

    // Adjust for rounding
    const diff = 100 - sum;
    if (Math.abs(diff) > 0.01 && ds.length > 0) {
      const largest = ds.reduce((a, b) =>
        (newWeights[a.id] || 0) > (newWeights[b.id] || 0) ? a : b
      );
      newWeights[largest.id] = Math.max(0, Math.min(100, newWeights[largest.id] + diff));
    }

    setWeights(newWeights);
  };

  // Normalize all category weights
  const normalizeAllCategories = () => {
    const categoryValues = Object.values(categories) as CategoryData[];
    const total = categoryValues.reduce((sum, catData) => {
      return sum + (catData.categoryWeight || 0);
    }, 0);
    if (total === 0) return;

    const newCats: Record<string, CategoryData> = { ...categories };
    const step = 5;
    let sum = 0;

    Object.keys(newCats).forEach((cat) => {
      const catData = newCats[cat] as CategoryData;
      const currentWeight = catData.categoryWeight || 0;
      const newWeight = snapToStep(
        (currentWeight / total) * 100,
        step
      );
      catData.categoryWeight = newWeight;
      sum += newWeight;
    });

    const diff = 100 - sum;
    if (diff !== 0) {
      const largestCat = Object.keys(newCats).reduce((a, b) => {
        const aData = newCats[a] as CategoryData;
        const bData = newCats[b] as CategoryData;
        return aData.categoryWeight > bData.categoryWeight ? a : b;
      });
      const largestCatData = newCats[largestCat] as CategoryData;
      largestCatData.categoryWeight = Math.max(
        0,
        Math.min(100, largestCatData.categoryWeight + diff)
      );
    }

    setCategories(newCats);
  };

  const handleWeightChange = (datasetId: string, value: number) => {
    const newValue = Math.max(0, Math.min(100, value));
    setWeights((prev) => {
      const updated = { ...prev, [datasetId]: newValue };
      
      // Check if we need to normalize (only if total exceeds 100%)
      const categoryData = Object.values(categories).find((cat: CategoryData) => 
        cat.datasets.some((d: any) => d.id === datasetId)
      ) as CategoryData | undefined;
      
      if (categoryData) {
        const total = categoryData.datasets.reduce((sum, d) => sum + (updated[d.id] || 0), 0);
        // Only normalize if total exceeds 100%, otherwise let user adjust freely
        if (total > 100.1) {
          // Normalize proportionally, but preserve the user's intent
          const scale = 100 / total;
          categoryData.datasets.forEach((d) => {
            updated[d.id] = (updated[d.id] || 0) * scale;
          });
        }
      }
      
      return updated;
    });
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

      const numCats = Object.keys(sorted).length;
      Object.keys(sorted).forEach((cat) => {
        sorted[cat].categoryWeight = 100 / numCats;
        const numDs = sorted[cat].datasets.length;
        sorted[cat].datasets.forEach((d) => {
          if (!weightMap[d.id]) weightMap[d.id] = 100 / numDs;
        });
      });

      setCategories(sorted);
      setWeights(weightMap);
      normalizeAllCategories();
    };
    load();
  }, [instance]);

  const handleSave = async () => {
    setLoading(true);
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

      await supabase.rpc('score_instance_overall', { in_instance_id: instance.id });
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
      <div className="bg-white rounded-lg shadow-lg p-4 w-[900px] max-h-[85vh] overflow-y-auto text-sm">
        <h2 className="text-base font-semibold mb-2">Calibration – {instance?.name}</h2>
        <p className="text-gray-600 mb-4">
          Adjust weights per dataset and category. All levels auto-balance to 100%.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium mb-1">Aggregation method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
          >
            <option value="mean">Simple average</option>
            <option value="weighted_mean">Weighted mean</option>
            <option value="20_percent">20% rule (≥20%)</option>
            <option value="custom">Custom % rule</option>
          </select>
        </div>

        {Object.entries(categories).map(([cat, obj]) => {
          const categoryData = obj as CategoryData;
          return (
          <div key={cat} className="mb-3 border rounded p-2 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-gray-800">{cat}</span>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">Category Weight:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(categoryData.categoryWeight)}
                    onChange={(e) => {
                      handleCategoryWeightChange(cat, parseFloat(e.target.value));
                      normalizeAllCategories();
                    }}
                    className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${categoryData.categoryWeight}%, #e5e7eb ${categoryData.categoryWeight}%, #e5e7eb 100%)`
                    }}
                  />
                  <span className="w-12 text-right font-semibold">{Math.round(categoryData.categoryWeight)}%</span>
                </div>
              </div>
            </div>

            {/* Visual weight bar for category */}
            <div className="h-1 bg-gray-200 rounded mb-2 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${categoryData.categoryWeight}%` }}
              />
            </div>

            {categoryData.datasets.map((d) => (
              <div
                key={d.id}
                className="pl-4 py-2 border-t text-gray-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="truncate font-medium text-sm flex items-center gap-2">
                    {d.name}
                    {d.is_hazard_event && (
                      <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                        Hazard Event
                      </span>
                    )}
                  </span>
                  <span className="w-12 text-right font-semibold text-sm">{Math.round(weights[d.id] ?? 0)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(weights[d.id] ?? 0)}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      handleWeightChange(d.id, newValue);
                      // Don't auto-normalize on every change - let user adjust freely
                      // Only normalize if total exceeds 100% (handled in handleWeightChange)
                    }}
                    onMouseUp={() => {
                      // Normalize when user releases the slider to ensure clean 100% total
                      normalizeCategory(cat);
                    }}
                    onTouchEnd={() => {
                      // Also normalize on touch devices
                      normalizeCategory(cat);
                    }}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${weights[d.id] || 0}%, #e5e7eb ${weights[d.id] || 0}%, #e5e7eb 100%)`
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Visual weight bar for dataset group */}
            <div className="h-1 bg-gray-100 mt-2 rounded overflow-hidden flex gap-0.5">
              {categoryData.datasets.map((d) => (
                <div
                  key={d.id}
                  className="bg-green-500 transition-all"
                  style={{ width: `${weights[d.id] || 0}%` }}
                />
              ))}
            </div>
          </div>
          );
        })}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Apply & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
