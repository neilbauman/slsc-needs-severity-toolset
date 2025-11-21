'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Method = 'average' | 'median' | 'worst_case' | 'custom_weighted';

type GroupKey =
  | 'SSC Framework - P1'
  | 'SSC Framework - P2'
  | 'SSC Framework - P3'
  | 'Hazard'
  | 'Underlying Vulnerability';

type UiDataset = {
  dataset_id: string;
  dataset_name: string;
  category: GroupKey;
  type: 'numeric' | 'categorical';
  avg_score?: number | null;
};

type CategoryCfg = {
  key: GroupKey;
  include: boolean;
  method: Method;
  weights: Record<string, number>;
};

type RollupCfg = {
  method: Method;
  weights: Record<string, number>;
};

interface Props {
  instance: { id: string; name: string };
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const ALL_CATEGORY_KEYS: GroupKey[] = [
  'SSC Framework - P1',
  'SSC Framework - P2',
  'SSC Framework - P3',
  'Hazard',
  'Underlying Vulnerability',
];

export default function FrameworkScoringModal({ instance, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState<UiDataset[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryCfg[]>(
    ALL_CATEGORY_KEYS.map((k) => ({
      key: k,
      include: true,
      method: 'average',
      weights: {},
    }))
  );

  const [sscRollup, setSscRollup] = useState<RollupCfg>({
    method: 'worst_case',
    weights: { 'SSC Framework - P1': 1 / 3, 'SSC Framework - P2': 1 / 3, 'SSC Framework - P3': 1 / 3 },
  });

  const [overallRollup, setOverallRollup] = useState<RollupCfg>({
    method: 'average',
    weights: { 'SSC Framework': 0.6, 'Hazard': 0.2, 'Underlying Vulnerability': 0.2 },
  });

  useEffect(() => {
    const load = async () => {
      setError(null);
      const { data, error } = await supabase
        .from('instance_datasets')
        .select(`dataset_id:id, datasets!inner(id, name, category, type)`)
        .eq('instance_id', instance.id);

      if (error) {
        setError(error.message);
        return;
      }

      const datasetIds = (data || []).map((r: any) => r.dataset_id).filter(Boolean);
      
      // Load average scores for each dataset
      let avgScores: Record<string, number> = {};
      if (datasetIds.length > 0) {
        const { data: scoresData } = await supabase
          .from('instance_dataset_scores')
          .select('dataset_id, score')
          .eq('instance_id', instance.id)
          .in('dataset_id', datasetIds);

        if (scoresData) {
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
      }

      const mapped: UiDataset[] = (data || []).map((r: any) => ({
        dataset_id: r.dataset_id,
        dataset_name: r.datasets.name,
        category: r.datasets.category,
        type: r.datasets.type,
        avg_score: avgScores[r.dataset_id] || null,
      }));

      setDatasets(mapped);

      // Initialize weights with equal distribution
      const next = [...categories];
      for (const key of ALL_CATEGORY_KEYS) {
        const ds = mapped.filter((d) => d.category === key);
        if (ds.length > 0) {
          const w = 1 / ds.length;
          const weights: Record<string, number> = {};
          ds.forEach((d) => (weights[d.dataset_id] = Number(w.toFixed(3))));
          const idx = next.findIndex((c) => c.key === key);
          if (idx >= 0) {
            next[idx].weights = weights;
            // If no datasets, set include to false
            if (ds.length === 0) {
              next[idx].include = false;
            }
          }
        }
      }
      setCategories(next);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id]);

  const grouped = useMemo(() => {
    const m: Record<GroupKey, UiDataset[]> = {
      'SSC Framework - P1': [],
      'SSC Framework - P2': [],
      'SSC Framework - P3': [],
      'Hazard': [],
      'Underlying Vulnerability': [],
    };
    for (const d of datasets) {
      if (m[d.category]) m[d.category].push(d);
    }
    return m;
  }, [datasets]);

  const updateCategory = (key: GroupKey, patch: Partial<CategoryCfg>) => {
    setCategories((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const sumWeights = (w: Record<string, number>) =>
    Object.values(w).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

  const normalizeWeights = (weights: Record<string, number>) => {
    const sum = sumWeights(weights);
    if (sum === 0) return weights;
    const normalized: Record<string, number> = {};
    Object.keys(weights).forEach((key) => {
      normalized[key] = Number((weights[key] / sum).toFixed(3));
    });
    return normalized;
  };

  const validate = () => {
    // Validate category weights
    for (const cat of categories) {
      if (!cat.include) continue;
      if (cat.method === 'custom_weighted') {
        const s = sumWeights(cat.weights);
        if (Math.abs(s - 1) > 0.01) {
          setError(`Weights for ${cat.key} must sum to 1.0 (currently ${s.toFixed(3)})`);
          return false;
        }
      }
    }
    
    // Validate SSC rollup weights
    if (sscRollup.method === 'custom_weighted') {
      const s = sumWeights(sscRollup.weights);
      if (Math.abs(s - 1) > 0.01) {
        setError(`SSC Framework rollup weights must sum to 1.0 (currently ${s.toFixed(3)})`);
        return false;
      }
    }
    
    // Validate overall rollup weights
    if (overallRollup.method === 'custom_weighted') {
      const s = sumWeights(overallRollup.weights);
      if (Math.abs(s - 1) > 0.01) {
        setError(`Overall rollup weights must sum to 1.0 (currently ${s.toFixed(3)})`);
        return false;
      }
    }
    
    setError(null);
    return true;
  };

  const handleApply = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);

    const cfg = {
      categories: categories
        .filter((c) => c.include)
        .map((c) => ({
          key: c.key,
          method: c.method,
          weights: c.method === 'custom_weighted' ? c.weights : {},
        })),
      ssc_overall: {
        method: sscRollup.method,
        weights: sscRollup.method === 'custom_weighted' ? sscRollup.weights : {},
      },
      overall: {
        method: overallRollup.method,
        weights: overallRollup.method === 'custom_weighted' ? overallRollup.weights : {},
      },
    };

    const { error: frameworkError } = await supabase.rpc('score_framework_aggregate', {
      in_instance_id: instance.id,
      in_config: cfg,
    });

    if (frameworkError) {
      setError(frameworkError.message);
      setLoading(false);
      return;
    }

    // Also compute final overall scores after framework aggregation
    console.log("Computing final overall scores...");
    const { error: finalError } = await supabase.rpc('score_final_aggregate', {
      in_instance_id: instance.id,
    });

    if (finalError) {
      console.warn("Error computing final overall scores:", finalError);
      // Don't fail the whole operation if final aggregate fails
      // The framework scores are still saved
      setError(`Framework scores saved, but error computing overall scores: ${finalError.message}`);
      setLoading(false);
      return;
    }

    console.log("Scoring configuration applied successfully");
    await onSaved();
    onClose();
    setLoading(false);
  };

  const renderMethodSelect = (value: Method, onChange: (m: Method) => void, label?: string) => (
    <div className="space-y-1">
      {label && <label className="text-xs font-medium text-gray-700">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Method)}
        className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
      >
        <option value="average">Average (Mean)</option>
        <option value="median">Median</option>
        <option value="worst_case">Worst Case (Maximum)</option>
        <option value="custom_weighted">Custom Weighted</option>
      </select>
      {value !== 'custom_weighted' && (
        <p className="text-xs text-gray-500">
          {value === 'average' && 'Calculates the mean of all scores'}
          {value === 'median' && 'Uses the middle value when scores are sorted'}
          {value === 'worst_case' && 'Takes the highest (worst) score'}
        </p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b px-6 py-4 bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Framework & Overall Scoring</h2>
            <p className="text-sm text-gray-600 mt-1">{instance.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg font-semibold"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm border-b border-red-200 px-6 py-3">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">How Scoring Works</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li><strong>Dataset Scores:</strong> Individual datasets are scored first (configured separately)</li>
              <li><strong>Category Scores:</strong> Dataset scores within each category are aggregated using the method below</li>
              <li><strong>SSC Framework Score:</strong> P1, P2, and P3 category scores are combined</li>
              <li><strong>Overall Score:</strong> SSC Framework, Hazard, and Underlying Vulnerability are combined</li>
            </ol>
          </div>

          {/* Category Configuration */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Step 1: Category Aggregation
            </h3>
            <p className="text-sm text-gray-600">
              Configure how individual dataset scores are combined within each category.
            </p>
            
            {ALL_CATEGORY_KEYS.map((key) => {
              const cat = categories.find((c) => c.key === key)!;
              const list = grouped[key];
              const hasDatasets = list.length > 0;
              
              return (
                <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center bg-gray-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cat.include}
                          onChange={(e) => updateCategory(key, { include: e.target.checked })}
                          disabled={!hasDatasets}
                          className="w-4 h-4"
                        />
                        <span className="font-semibold text-gray-900">{key}</span>
                      </label>
                      {!hasDatasets && (
                        <span className="text-xs text-gray-500">(No datasets in this category)</span>
                      )}
                    </div>
                    {hasDatasets && cat.include && (
                      <span className="text-xs text-gray-600">
                        {list.length} dataset{list.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  
                  {cat.include && hasDatasets && (
                    <div className="p-4 space-y-4 bg-white">
                      {/* Aggregation Method */}
                      <div>
                        {renderMethodSelect(cat.method, (m) => updateCategory(key, { method: m }), 'Aggregation Method')}
                      </div>

                      {/* Dataset List */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Datasets in this Category:</h4>
                        <div className="space-y-2">
                          {list.map((d) => (
                            <div key={d.dataset_id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900">{d.dataset_name}</div>
                                {d.avg_score !== null && (
                                  <div className="text-xs text-gray-500">
                                    Avg Score: {Number(d.avg_score).toFixed(2)}
                                  </div>
                                )}
                              </div>
                              {cat.method === 'custom_weighted' && (
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-gray-600">Weight:</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    value={cat.weights[d.dataset_id] ?? 0}
                                    onChange={(e) => {
                                      const newWeights = {
                                        ...cat.weights,
                                        [d.dataset_id]: parseFloat(e.target.value) || 0,
                                      };
                                      // Auto-normalize if sum > 1
                                      const sum = sumWeights(newWeights);
                                      if (sum > 1.01) {
                                        updateCategory(key, { weights: normalizeWeights(newWeights) });
                                      } else {
                                        updateCategory(key, { weights: newWeights });
                                      }
                                    }}
                                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {cat.method === 'custom_weighted' && (
                          <div className="mt-2 text-xs text-gray-600">
                            <span className={Math.abs(sumWeights(cat.weights) - 1) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                              Total Weight: {sumWeights(cat.weights).toFixed(3)} 
                              {Math.abs(sumWeights(cat.weights) - 1) < 0.01 ? ' ✓' : ' (must equal 1.0)'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* SSC Framework Roll-up */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-teal-100 px-4 py-3 border-b border-teal-200">
              <h3 className="text-lg font-semibold text-gray-900">Step 2: SSC Framework Roll-up</h3>
              <p className="text-sm text-gray-600 mt-1">
                Combine P1, P2, and P3 category scores into a single SSC Framework score.
              </p>
            </div>
            <div className="p-4 bg-white space-y-4">
              {renderMethodSelect(sscRollup.method, (m) => setSscRollup((p) => ({ ...p, method: m })), 'Aggregation Method')}
              {sscRollup.method === 'custom_weighted' && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Category Weights:</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {(['SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3'] as GroupKey[]).map((k) => {
                      const cat = categories.find((c) => c.key === k);
                      const hasData = cat && cat.include && grouped[k].length > 0;
                      return (
                        <div key={k} className={`p-3 rounded border ${hasData ? 'bg-gray-50 border-gray-300' : 'bg-gray-100 border-gray-200 opacity-50'}`}>
                          <label className="text-xs font-medium text-gray-700 block mb-1">{k}</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={sscRollup.weights[k] ?? 0}
                            onChange={(e) => {
                              const newWeights = {
                                ...sscRollup.weights,
                                [k]: parseFloat(e.target.value) || 0,
                              };
                              const sum = sumWeights(newWeights);
                              if (sum > 1.01) {
                                setSscRollup((p) => ({ ...p, weights: normalizeWeights(newWeights) }));
                              } else {
                                setSscRollup((p) => ({ ...p, weights: newWeights }));
                              }
                            }}
                            disabled={!hasData}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className={Math.abs(sumWeights(sscRollup.weights) - 1) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                      Total Weight: {sumWeights(sscRollup.weights).toFixed(3)}
                      {Math.abs(sumWeights(sscRollup.weights) - 1) < 0.01 ? ' ✓' : ' (must equal 1.0)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Final Overall Roll-up */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-amber-100 px-4 py-3 border-b border-amber-200">
              <h3 className="text-lg font-semibold text-gray-900">Step 3: Final Overall Roll-up</h3>
              <p className="text-sm text-gray-600 mt-1">
                Combine SSC Framework, Hazard, and Underlying Vulnerability into the final overall score.
              </p>
            </div>
            <div className="p-4 bg-white space-y-4">
              {renderMethodSelect(overallRollup.method, (m) => setOverallRollup((p) => ({ ...p, method: m })), 'Aggregation Method')}
              {overallRollup.method === 'custom_weighted' && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Category Weights:</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'SSC Framework', label: 'SSC Framework' },
                      { key: 'Hazard', label: 'Hazard' },
                      { key: 'Underlying Vulnerability', label: 'Underlying Vulnerability' },
                    ].map(({ key, label }) => {
                      const catKey = key === 'SSC Framework' ? null : key as GroupKey;
                      const hasData = catKey 
                        ? (categories.find((c) => c.key === catKey)?.include && grouped[catKey]?.length > 0)
                        : true; // SSC Framework always has data if P1/P2/P3 exist
                      return (
                        <div key={key} className={`p-3 rounded border ${hasData ? 'bg-gray-50 border-gray-300' : 'bg-gray-100 border-gray-200 opacity-50'}`}>
                          <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={overallRollup.weights[key] ?? 0}
                            onChange={(e) => {
                              const newWeights = {
                                ...overallRollup.weights,
                                [key]: parseFloat(e.target.value) || 0,
                              };
                              const sum = sumWeights(newWeights);
                              if (sum > 1.01) {
                                setOverallRollup((p) => ({ ...p, weights: normalizeWeights(newWeights) }));
                              } else {
                                setOverallRollup((p) => ({ ...p, weights: newWeights }));
                              }
                            }}
                            disabled={!hasData}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className={Math.abs(sumWeights(overallRollup.weights) - 1) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                      Total Weight: {sumWeights(overallRollup.weights).toFixed(3)}
                      {Math.abs(sumWeights(overallRollup.weights) - 1) < 0.01 ? ' ✓' : ' (must equal 1.0)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {loading && <span className="text-blue-600">Applying scoring configuration...</span>}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 text-sm font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Applying...' : 'Apply Scoring Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
