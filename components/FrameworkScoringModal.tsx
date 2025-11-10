'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * FrameworkScoringModal
 * ------------------------------------------------------------
 * Power-user modal for rolling up:
 *   - per-category (multiple datasets per category)
 *   - SSC Framework (Pillar 1, Pillar 2, Pillar 3)
 *   - Final Overall (SSC + Hazards/Risks + Underlying Vulnerabilities)
 *
 * No shadcn; Tailwind only. Calls RPC: score_framework_aggregate.
 */

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
  weights: Record<string, number>; // dataset_id -> weight (only when custom_weighted)
};

type RollupCfg = {
  method: Method;
  weights: Record<string, number>; // key -> weight when custom_weighted
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

  // Per-category configuration (datasets within a category)
  const [categories, setCategories] = useState<CategoryCfg[]>(
    ALL_CATEGORY_KEYS.map((k) => ({
      key: k,
      include: true,
      method: 'average',
      weights: {},
    }))
  );

  // SSC roll-up across the 3 pillars
  const [sscRollup, setSscRollup] = useState<RollupCfg>({
    method: 'worst_case',
    weights: { 'SSC Framework - P1': 1 / 3, 'SSC Framework - P2': 1 / 3, 'SSC Framework - P3': 1 / 3 },
  });

  // Final overall roll-up across SSC, Hazards/Risks, Underlying Vulnerabilities
  const [overallRollup, setOverallRollup] = useState<RollupCfg>({
    method: 'average',
    weights: { 'SSC Framework': 0.6, 'Hazards/Risks': 0.2, 'Underlying Vulnerabilities': 0.2 },
  });

  // Load datasets attached to this instance
  useEffect(() => {
    const load = async () => {
      setError(null);
      // Prefer a view if you have it; otherwise use instance_datasets join datasets
      const { data, error } = await supabase
        .from('instance_datasets')
        .select(`
          dataset_id:id,
          datasets!inner(name, category, type)
        `)
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

      // Initialize even weights per category (for convenience)
      const next = [...categories];
      for (const key of ALL_CATEGORY_KEYS) {
        const ds = mapped.filter((d) => d.category === key);
        if (ds.length > 0) {
          const w = 1 / ds.length;
          const weights: Record<string, number> = {};
          ds.forEach((d) => (weights[d.dataset_id] = Number(w.toFixed(6))));
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
    setCategories((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c))
    );
  };

  const formatNum = (v: number) => (Number.isFinite(v) ? String(v) : '');
  const sumWeights = (weights: Record<string, number>) =>
    Object.values(weights).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

  const validate = () => {
    // category custom weights must sum to 1
    for (const cat of categories) {
      if (!cat.include) continue;
      if (cat.method === 'custom_weighted') {
        const ds = grouped[cat.key];
        if (!ds.length) continue;
        const sw = sumWeights(cat.weights);
        if (Math.abs(sw - 1) > 1e-3) {
          setError(`Weights for "${cat.key}" must sum to 1. Currently ${sw.toFixed(3)}.`);
          return false;
        }
      }
    }
    // ssc custom weights sum=1
    if (sscRollup.method === 'custom_weighted') {
      const sw =
        (sscRollup.weights['SSC Framework - P1'] || 0) +
        (sscRollup.weights['SSC Framework - P2'] || 0) +
        (sscRollup.weights['SSC Framework - P3'] || 0);
      if (Math.abs(sw - 1) > 1e-3) {
        setError(`SSC Framework weights must sum to 1. Currently ${sw.toFixed(3)}.`);
        return false;
      }
    }
    // overall custom weights sum=1
    if (overallRollup.method === 'custom_weighted') {
      const sw =
        (overallRollup.weights['SSC Framework'] || 0) +
        (overallRollup.weights['Hazards/Risks'] || 0) +
        (overallRollup.weights['Underlying Vulnerabilities'] || 0);
      if (Math.abs(sw - 1) > 1e-3) {
        setError(`Overall weights must sum to 1. Currently ${sw.toFixed(3)}.`);
        return false;
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

    if (onSaved) await onSaved();
    onClose();
    setLoading(false);
  };

  const renderMethodSelect = (value: Method, onChange: (m: Method) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Method)}
      className="border border-gray-300 rounded px-2 py-1 w-full"
    >
      <option value="average">Average</option>
      <option value="median">Median</option>
      <option value="worst_case">Worst-case (Max)</option>
      <option value="custom_weighted">Custom weighted</option>
    </select>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-6">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-xl font-semibold">
            Framework & Overall Scoring — {instance?.name}
          </h2>
          <button
            onClick={onClose}
            className="ml-4 px-3 py-1 rounded border border-gray-300 hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        <p className="text-gray-600 mb-4">
          Control how datasets roll up to categories, how categories roll up to SSC Framework, and how everything rolls up to a final overall score.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* Per-category configuration */}
        <div className="space-y-6">
          {ALL_CATEGORY_KEYS.map((key) => {
            const cat = categories.find((c) => c.key === key)!;
            const list = grouped[key];

            return (
              <div key={key} className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                  <div className="font-medium">{key}</div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cat.include}
                      onChange={(e) => updateCategory(key, { include: e.target.checked })}
                    />
                    Include in scoring
                  </label>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Method</div>
                      {renderMethodSelect(cat.method, (m) => updateCategory(key, { method: m }))}
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-sm text-gray-600 mb-1">Datasets</div>
                      <div className="text-sm">
                        {list.length
                          ? list.map((d) => d.dataset_name).join(', ')
                          : <span className="text-gray-400">None attached</span>}
                      </div>
                    </div>
                  </div>

                  {cat.method === 'custom_weighted' && list.length > 0 && (
                    <div className="mt-2">
                      <div className="text-sm font-medium mb-2">Weights (must sum to 1)</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {list.map((d) => (
                          <div key={d.dataset_id} className="flex items-center gap-2">
                            <div className="flex-1 text-sm text-gray-800">{d.dataset_name}</div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              value={formatNum(categories.find((c) => c.key === key)!.weights[d.dataset_id] ?? 0)}
                              onChange={(e) => {
                                const w = parseFloat(e.target.value);
                                updateCategory(key, {
                                  weights: {
                                    ...categories.find((c) => c.key === key)!.weights,
                                    [d.dataset_id]: Number.isFinite(w) ? w : 0,
                                  },
                                });
                              }}
                              className="w-28 border border-gray-300 rounded px-2 py-1"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Sum: {sumWeights(categories.find((c) => c.key === key)!.weights).toFixed(3)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* SSC Framework roll-up */}
        <div className="mt-6 border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-teal-50 font-medium">
            SSC Framework roll-up (Pillar 1, Pillar 2, Pillar 3)
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-sm text-gray-600 mb-1">Method</div>
                {renderMethodSelect(sscRollup.method, (m) => setSscRollup((prev) => ({ ...prev, method: m })))}
              </div>
            </div>

            {sscRollup.method === 'custom_weighted' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                {(['SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3'] as GroupKey[]).map((k) => (
                  <div key={k}>
                    <div className="text-sm text-gray-700 mb-1">{k}</div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={formatNum(sscRollup.weights[k] ?? 0)}
                      onChange={(e) =>
                        setSscRollup((prev) => ({
                          ...prev,
                          weights: { ...prev.weights, [k]: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                ))}
                <div className="md:col-span-3 text-xs text-gray-500">
                  Sum:{' '}
                  {(
                    (sscRollup.weights['SSC Framework - P1'] || 0) +
                    (sscRollup.weights['SSC Framework - P2'] || 0) +
                    (sscRollup.weights['SSC Framework - P3'] || 0)
                  ).toFixed(3)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Final overall roll-up */}
        <div className="mt-6 border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 font-medium">Final Overall roll-up</div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-sm text-gray-600 mb-1">Method</div>
                {renderMethodSelect(overallRollup.method, (m) => setOverallRollup((prev) => ({ ...prev, method: m })))}
              </div>
            </div>

            {overallRollup.method === 'custom_weighted' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                {['SSC Framework', 'Hazards/Risks', 'Underlying Vulnerabilities'].map((k) => (
                  <div key={k}>
                    <div className="text-sm text-gray-700 mb-1">{k}</div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={formatNum(overallRollup.weights[k] ?? 0)}
                      onChange={(e) =>
                        setOverallRollup((prev) => ({
                          ...prev,
                          weights: { ...prev.weights, [k]: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                ))}
                <div className="md:col-span-3 text-xs text-gray-500">
                  Sum:{' '}
                  {(
                    (overallRollup.weights['SSC Framework'] || 0) +
                    (overallRollup.weights['Hazards/Risks'] || 0) +
                    (overallRollup.weights['Underlying Vulnerabilities'] || 0)
                  ).toFixed(3)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
            onClick={handleApply}
            disabled={loading}
          >
            {loading ? 'Scoring…' : 'Apply Scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}
