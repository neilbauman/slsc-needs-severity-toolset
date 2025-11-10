'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Method =
  | 'average'
  | 'median'
  | 'worst_case'
  | 'custom_weighted';

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
  weights: Record<string, number>; // dataset_id -> weight (only for custom_weighted)
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
  const [categories, setCategories] = useState<CategoryCfg[]>(
    ALL_CATEGORY_KEYS.map((k) => ({
      key: k,
      include: true,
      method: 'average',
      weights: {},
    }))
  );

  // SSC overall rollup across the three pillars
  const [sscRollup, setSscRollup] = useState<RollupCfg>({
    method: 'worst_case',
    weights: { 'SSC Framework - P1': 1 / 3, 'SSC Framework - P2': 1 / 3, 'SSC Framework - P3': 1 / 3 },
  });

  // Final overall rollup across SSC Framework, Hazards/Risks, Underlying Vulnerabilities
  const [overallRollup, setOverallRollup] = useState<RollupCfg>({
    method: 'average',
    weights: { 'SSC Framework': 0.6, 'Hazards/Risks': 0.2, 'Underlying Vulnerabilities': 0.2 },
  });

  // Load the instance’s datasets grouped by category
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('instance_datasets')
        .select(`
          dataset_id:id,
          datasets!inner(name, category, type)
        `)
        .eq('instance_id', instance.id);

      if (error) {
        alert(`Error loading datasets: ${error.message}`);
        return;
      }

      const mapped: UiDataset[] = (data || []).map((r: any) => ({
        dataset_id: r.dataset_id,
        dataset_name: r.datasets.name,
        category: r.datasets.category,
        type: r.datasets.type,
      }));

      setDatasets(mapped);

      // Pre-fill custom weights (evenly) per category
      const next = [...categories];
      for (const key of ALL_CATEGORY_KEYS) {
        const ds = mapped.filter((d) => d.category === key);
        if (ds.length) {
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

  const formatPct = (v: number) => (Number.isFinite(v) ? String(v) : '');

  const sumWeights = (weights: Record<string, number>) =>
    Object.values(weights).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

  const validate = () => {
    // For each category with custom weights: weights must sum ~ 1.0 (tolerance)
    for (const cat of categories) {
      if (!cat.include) continue;
      if (cat.method === 'custom_weighted') {
        const ds = grouped[cat.key];
        if (!ds.length) continue;
        const sw = sumWeights(cat.weights);
        if (Math.abs(sw - 1) > 1e-3) {
          alert(`Weights for "${cat.key}" must sum to 1. Currently ${sw.toFixed(3)}.`);
          return false;
        }
      }
    }
    if (sscRollup.method === 'custom_weighted') {
      const sw =
        (sscRollup.weights['SSC Framework - P1'] || 0) +
        (sscRollup.weights['SSC Framework - P2'] || 0) +
        (sscRollup.weights['SSC Framework - P3'] || 0);
      if (Math.abs(sw - 1) > 1e-3) {
        alert(`SSC Framework weights must sum to 1. Currently ${sw.toFixed(3)}.`);
        return false;
      }
    }
    if (overallRollup.method === 'custom_weighted') {
      const sw =
        (overallRollup.weights['SSC Framework'] || 0) +
        (overallRollup.weights['Hazards/Risks'] || 0) +
        (overallRollup.weights['Underlying Vulnerabilities'] || 0);
      if (Math.abs(sw - 1) > 1e-3) {
        alert(`Overall weights must sum to 1. Currently ${sw.toFixed(3)}.`);
        return false;
      }
    }
    return true;
  };

  const handleApply = async () => {
    if (!validate()) return;
    setLoading(true);

    // Build config JSON for the RPC
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

    const { data, error } = await supabase.rpc('score_framework_aggregate', {
      in_instance_id: instance.id,
      in_config: cfg,
    });

    if (error) {
      alert(`Error saving & computing: ${error.message}`);
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
        <h2
