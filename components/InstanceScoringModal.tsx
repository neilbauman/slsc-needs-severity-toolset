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
  const [categories, setCategories] = useState<
    Record<string, { name: string; datasets: any[]; categoryWeight: number }>
  >({});
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
    const ds = categories[cat].datasets;
    const total = ds.reduce((sum, d) => sum + (weights[d.id] || 0), 0);
    if (total === 0) return;

    const newWeights = { ...weights };
    const step = 5;

    let sum = 0;
    ds.forEach((d) => {
      newWeights[d.id] = snapToStep((weights[d.id] / total) * 100, step);
      sum += newWeights[d.id];
    });

    const diff = 100 - sum;
    if (diff !== 0 && ds.length > 0) {
      const largest = ds.reduce((a, b) =>
        (newWeights[a.id] || 0) > (newWeights[b.id] || 0) ? a : b
      );
      newWeights[largest.id] = Math.max(0, Math.min(100, newWeights[largest.id] + diff));
    }

    setWeights(newWeights);
  };

  // Normalize all category weights
  const normalizeAllCategories = () => {
    const total = Object.values(categories).reduce((sum, c) => sum + (c.categoryWeight || 0), 0);
    if (total === 0) return;

    const newCats = { ...categories };
    const step = 5;
    let sum = 0;

    Object.keys(newCats).forEach((cat) => {
      newCats[cat].categoryWeight = snapToStep(
        (newCats[cat].categoryWeight / total) * 100,
        step
      );
      sum += newCats[cat].categoryWeight;
    });

    const diff = 100 - sum;
    if (diff !== 0) {
      const largestCat = Object.keys(newCats).reduce((a, b) =>
        newCats[a].categoryWeight > newCats[b].categoryWeight ? a : b
      );
      newCats[largestCat].categoryWeight = Math.max(
        0,
        Math.min(100, newCats[largestCat].categoryWeight + diff)
      );
    }

    setCategories(newCats);
  };

  const handleWeightChange = (datasetId: string, value: number) => {
    setWeights((prev) => ({ ...prev, [datasetId]: Math.max(0, value) }));
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
      }));

      const { data: savedWeights } = await supabase
        .from('instance_scoring_weights')
        .select('*')
        .eq('instance_id', instance.id);

      const weightMap: Record<string, number> = {};
      (savedWeights || []).forEach((w: any) => {
        weightMap[w.dataset_id] = (w.dataset_weight ?? 0) * 100;
      });

      const grouped: Record<string, { name: string; datasets: any[]; categoryWeight: number }> = {};
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
        for (const d of obj.datasets) {
          const weightDecimal = (weights[d.id] || 0) / 100;
          const catDecimal = (obj.categoryWeight || 0) / 100;

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

        {Object.entries(categories).map(([cat, obj]) => (
          <div key={cat} className="mb-3 border rounded p-2 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-gray-800">{cat}</span>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">Category Weight:</span>
                <input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={Math.round(obj.categoryWeight)}
                  onChange={(e) =>
                    handleCategoryWeightChange(cat, parseFloat(e.target.value))
                  }
                  onBlur={normalizeAllCategories}
                  className="w-16 border rounded px-1 py-0.5 text-right"
                />
                <span>%</span>
              </div>
            </div>

            {/* Visual weight bar for category */}
            <div className="h-1 bg-gray-200 rounded mb-2 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${obj.categoryWeight}%` }}
              />
            </div>

            {obj.datasets.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between pl-4 py-1 border-t text-gray-700"
              >
                <span className="truncate">{d.name}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="5"
                    min="0"
                    max="100"
                    value={Math.round(weights[d.id] ?? 0)}
                    onChange={(e) => handleWeightChange(d.id, parseFloat(e.target.value))}
                    onBlur={() => normalizeCategory(cat)}
                    className="w-16 text-sm border rounded px-1 py-0.5 text-right"
                  />
                  <span>%</span>
                </div>
              </div>
            ))}

            {/* Visual weight bar for dataset group */}
            <div className="h-1 bg-gray-100 mt-2 rounded overflow-hidden flex gap-0.5">
              {obj.datasets.map((d) => (
                <div
                  key={d.id}
                  className="bg-green-500 transition-all"
                  style={{ width: `${weights[d.id] || 0}%` }}
                />
              ))}
            </div>
          </div>
        ))}

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
