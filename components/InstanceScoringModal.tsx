'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface InstanceScoringModalProps {
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function InstanceScoringModal({ instance, onClose, onSaved }: InstanceScoringModalProps) {
  const [categories, setCategories] = useState<
    Record<string, { name: string; datasets: any[]; categoryWeight: number }>
  >({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<'mean' | 'weighted_mean' | '20_percent' | 'custom'>('weighted_mean');
  const [threshold, setThreshold] = useState<number>(0.2);
  const [loading, setLoading] = useState(false);

  const CATEGORY_ORDER = [
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Hazard',
    'Underlying Vulnerability',
  ];

  // Fetch datasets + weights
  useEffect(() => {
    if (!instance?.id) return;

    const load = async () => {
      const { data: datasets, error: dsErr } = await supabase
        .from('instance_datasets')
        .select('dataset_id, datasets (id, name, category, type)')
        .eq('instance_id', instance.id);

      if (dsErr) return console.error('Dataset load error:', dsErr);

      const flat = (datasets || []).map((d: any) => ({
        id: d.datasets.id,
        name: d.datasets.name,
        category: d.datasets.category || 'Uncategorized',
      }));

      const { data: savedWeights, error: wtErr } = await supabase
        .from('instance_scoring_weights')
        .select('*')
        .eq('instance_id', instance.id);

      if (wtErr) console.error('Weight load error:', wtErr);

      const weightMap: Record<string, number> = {};
      (savedWeights || []).forEach((w: any) => {
        weightMap[w.dataset_id] = w.dataset_weight ?? 0;
      });

      // Group datasets by category
      const grouped: Record<string, { name: string; datasets: any[]; categoryWeight: number }> = {};
      for (const d of flat) {
        const cat = d.category;
        if (!grouped[cat]) grouped[cat] = { name: cat, datasets: [], categoryWeight: 1.0 };
        grouped[cat].datasets.push(d);
        if (!weightMap[d.id]) weightMap[d.id] = 1.0;
      }

      // Sort categories by the specified order
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

      setCategories(sorted);
      setWeights(weightMap);
    };
    load();
  }, [instance]);

  // Normalize dataset weights within a category
  const normalizeCategory = (cat: string) => {
    const ds = categories[cat].datasets;
    const total = ds.reduce((sum, d) => sum + (weights[d.id] || 0), 0);
    if (total === 0) return;
    const newWeights = { ...weights };
    ds.forEach(d => (newWeights[d.id] = (weights[d.id] / total) * 100));
    setWeights(newWeights);
  };

  // Normalize all categories to total 100%
  const normalizeAllCategories = () => {
    const total = Object.values(categories).reduce((sum, c) => sum + (c.categoryWeight || 0), 0);
    if (total === 0) return;
    const newCats = { ...categories };
    Object.keys(newCats).forEach(cat => {
      newCats[cat].categoryWeight = (newCats[cat].categoryWeight / total) * 100;
    });
    setCategories(newCats);
  };

  const handleWeightChange = (datasetId: string, value: number) => {
    setWeights(prev => ({ ...prev, [datasetId]: Math.max(0, value) }));
  };

  const handleCategoryWeightChange = (cat: string, value: number) => {
    const updated = { ...categories };
    updated[cat].categoryWeight = Math.max(0, value);
    setCategories(updated);
  };

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
          Adjust weights per dataset and category. All levels auto-normalize to 100%.
        </p>

        {/* Aggregation method */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1">Aggregation method</label>
          <select
            value={method}
            onChange={e => setMethod(e.target.value as any)}
            className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
          >
            <option value="mean">Simple average</option>
            <option value="weighted_mean">Weighted mean</option>
            <option value="20_percent">20% rule (≥20%)</option>
            <option value="custom">Custom % rule</option>
          </select>
        </div>

        {method === 'custom' && (
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1">Custom threshold (0–1)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
            />
          </div>
        )}

        {/* Category panels */}
        {Object.entries(categories).map(([cat, obj]) => (
          <div key={cat} className="mb-3 border rounded p-2 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-gray-800">{cat}</span>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">Category Weight:</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={obj.categoryWeight}
                  onChange={e => handleCategoryWeightChange(cat, parseFloat(e.target.value))}
                  onBlur={normalizeAllCategories}
                  className="w-16 border rounded px-1 py-0.5 text-right"
                />
                <span>%</span>
              </div>
            </div>

            {obj.datasets.map(d => (
              <div key={d.id} className="flex items-center justify-between pl-4 py-1 border-t text-gray-700">
                <span className="truncate">{d.name}</span>
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={weights[d.id] ?? 0}
                    onChange={e => handleWeightChange(d.id, parseFloat(e.target.value))}
                    onBlur={() => normalizeCategory(cat)}
                    className="w-16 text-sm border rounded px-1 py-0.5 text-right"
                  />
                  <span>%</span>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100">
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
