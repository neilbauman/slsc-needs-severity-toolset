'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Method = 'average' | 'median' | 'worst_case' | 'custom_weighted';

type GroupKey =
  | 'SSC Framework - P1'
  | 'SSC Framework - P2'
  | 'SSC Framework - P3'
  | 'Hazards/Risks'
  | 'Underlying Vulnerabilities';

type UiDataset = {
  dataset_id: string;
  dataset_name: string;
  category: GroupKey;
  type: 'numeric' | 'categorical';
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
  'Hazards/Risks',
  'Underlying Vulnerabilities',
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
    weights: { 'SSC Framework': 0.6, 'Hazards/Risks': 0.2, 'Underlying Vulnerabilities': 0.2 },
  });

  useEffect(() => {
    const load = async () => {
      setError(null);
      const { data, error } = await supabase
        .from('instance_datasets')
        .select(`dataset_id:id, datasets!inner(name, category, type)`)
        .eq('instance_id', instance.id);

      if (error) {
        setError(error.message);
        return;
      }

      const mapped: UiDataset[] = (data || []).map((r: any) => ({
        dataset_id: r.dataset_id,
        dataset_name: r.datasets.name,
        category: r.datasets.category,
        type: r.datasets.type,
      }));

      setDatasets(mapped);

      const next = [...categories];
      for (const key of ALL_CATEGORY_KEYS) {
        const ds = mapped.filter((d) => d.category === key);
        if (ds.length > 0) {
          const w = 1 / ds.length;
          const weights: Record<string, number> = {};
          ds.forEach((d) => (weights[d.dataset_id] = Number(w.toFixed(3))));
          const idx = next.findIndex((c) => c.key === key);
          if (idx >= 0) next[idx].weights = weights;
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
      'Hazards/Risks': [],
      'Underlying Vulnerabilities': [],
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

  const validate = () => {
    for (const cat of categories) {
      if (!cat.include) continue;
      if (cat.method === 'custom_weighted') {
        const s = sumWeights(cat.weights);
        if (Math.abs(s - 1) > 0.01) {
          setError(`Weights for ${cat.key} must sum to 1 (now ${s.toFixed(2)})`);
          return false;
        }
      }
    }
    setError(null);
    return true;
  };

  const handleApply = async () => {
    if (!validate()) return;
    setLoading(true);

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

    const { error } = await supabase.rpc('score_framework_aggregate', {
      in_instance_id: instance.id,
      in_config: cfg,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await onSaved();
    onClose();
    setLoading(false);
  };

  const renderMethodSelect = (value: Method, onChange: (m: Method) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Method)}
      className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
    >
      <option value="average">Average</option>
      <option value="median">Median</option>
      <option value="worst_case">Worst case</option>
      <option value="custom_weighted">Custom weighted</option>
    </select>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-md shadow-lg w-full max-w-4xl h-[90vh] flex flex-col text-sm">
        <div className="flex justify-between items-center border-b px-4 py-2">
          <div className="font-semibold text-base">
            Framework & Overall Scoring — {instance.name}
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-black text-xs border px-2 py-1 rounded"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs border-b border-red-200 px-3 py-2">
            {error}
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-3 py-2 space-y-3">
          {ALL_CATEGORY_KEYS.map((key) => {
            const cat = categories.find((c) => c.key === key)!;
            const list = grouped[key];
            return (
              <div key={key} className="border rounded">
                <div className="flex justify-between items-center bg-gray-50 px-3 py-1.5">
                  <div className="font-medium">{key}</div>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={cat.include}
                      onChange={(e) => updateCategory(key, { include: e.target.checked })}
                    />
                    Include
                  </label>
                </div>
                <div className="p-2 space-y-1">
                  <div className="grid grid-cols-3 gap-2">
                    <div>{renderMethodSelect(cat.method, (m) => updateCategory(key, { method: m }))}</div>
                    <div className="col-span-2 text-gray-700 truncate">
                      {list.length
                        ? list.map((d) => d.dataset_name).join(', ')
                        : <span className="text-gray-400">No datasets</span>}
                    </div>
                  </div>
                  {cat.method === 'custom_weighted' && list.length > 0 && (
                    <div className="space-y-1">
                      {list.map((d) => (
                        <div key={d.dataset_id} className="flex justify-between items-center text-xs">
                          <span>{d.dataset_name}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={cat.weights[d.dataset_id] ?? 0}
                            onChange={(e) =>
                              updateCategory(key, {
                                weights: {
                                  ...cat.weights,
                                  [d.dataset_id]: parseFloat(e.target.value) || 0,
                                },
                              })
                            }
                            className="w-16 border rounded px-1 py-0.5"
                          />
                        </div>
                      ))}
                      <div className="text-[10px] text-gray-500">
                        Sum: {sumWeights(cat.weights).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="border rounded">
            <div className="bg-teal-50 px-3 py-1.5 font-medium">SSC Framework Roll-up</div>
            <div className="p-2 space-y-1">
              {renderMethodSelect(sscRollup.method, (m) => setSscRollup((p) => ({ ...p, method: m })))}
              {sscRollup.method === 'custom_weighted' && (
                <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                  {(['SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3'] as GroupKey[]).map((k) => (
                    <div key={k}>
                      <div>{k}</div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={sscRollup.weights[k] ?? 0}
                        onChange={(e) =>
                          setSscRollup((p) => ({
                            ...p,
                            weights: { ...p.weights, [k]: parseFloat(e.target.value) || 0 },
                          }))
                        }
                        className="w-full border rounded px-1 py-0.5"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border rounded">
            <div className="bg-amber-50 px-3 py-1.5 font-medium">Final Overall Roll-up</div>
            <div className="p-2 space-y-1">
              {renderMethodSelect(overallRollup.method, (m) => setOverallRollup((p) => ({ ...p, method: m })))}
              {overallRollup.method === 'custom_weighted' && (
                <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                  {['SSC Framework', 'Hazards/Risks', 'Underlying Vulnerabilities'].map((k) => (
                    <div key={k}>
                      <div>{k}</div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={overallRollup.weights[k] ?? 0}
                        onChange={(e) =>
                          setOverallRollup((p) => ({
                            ...p,
                            weights: { ...p.weights, [k]: parseFloat(e.target.value) || 0 },
                          }))
                        }
                        className="w-full border rounded px-1 py-0.5"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t bg-gray-50 px-4 py-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="border px-3 py-1 rounded text-xs hover:bg-gray-100"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
            disabled={loading}
          >
            {loading ? 'Scoring…' : 'Apply Scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}
