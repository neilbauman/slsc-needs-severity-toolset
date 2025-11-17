'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface InstanceScoringModalProps {
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function InstanceScoringModal({ instance, onClose, onSaved }: InstanceScoringModalProps) {
  const [categories, setCategories] = useState<Record<string, any[]>>({});
  const [weights, setWeights] = useState<Record<string, { dataset_weight: number; category_weight: number }>>({});
  const [method, setMethod] = useState<'mean' | 'weighted_mean' | '20_percent' | 'custom'>('weighted_mean');
  const [threshold, setThreshold] = useState<number>(0.2);
  const [loading, setLoading] = useState(false);

  // Load datasets and weights
  useEffect(() => {
    if (!instance?.id) return;
    const load = async () => {
      // 1. Load datasets for instance
      const { data: datasets, error: dErr } = await supabase
        .from('instance_datasets')
        .select('dataset_id, datasets (id, name, category, type)')
        .eq('instance_id', instance.id);
      if (dErr) return console.error('Dataset load error:', dErr);

      // Flatten datasets
      const flat = (datasets || []).map((d: any) => ({
        id: d.datasets.id,
        name: d.datasets.name,
        category: d.datasets.category || 'Uncategorized',
      }));

      // 2. Load saved weights
      const { data: savedWeights, error: wErr } = await supabase
        .from('instance_scoring_weights')
        .select('*')
        .eq('instance_id', instance.id);
      if (wErr) return console.error('Weight load error:', wErr);

      // Map weights by dataset_id
      const weightMap: Record<string, any> = {};
      (savedWeights || []).forEach((w: any) => {
        weightMap[w.dataset_id] = {
          dataset_weight: w.dataset_weight ?? 1.0,
          category_weight: w.category_weight ?? 1.0,
        };
      });

      // 3. Group datasets by category
      const grouped: Record<string, any[]> = {};
      for (const d of flat) {
        if (!grouped[d.category]) grouped[d.category] = [];
        grouped[d.category].push(d);
        if (!weightMap[d.id]) {
          weightMap[d.id] = { dataset_weight: 1.0, category_weight: 1.0 };
        }
      }

      setCategories(grouped);
      setWeights(weightMap);
    };
    load();
  }, [instance]);

  const handleWeightChange = (datasetId: string, field: 'dataset_weight' | 'category_weight', value: number) => {
    setWeights(prev => ({
      ...prev,
      [datasetId]: {
        ...prev[datasetId],
        [field]: isNaN(value) ? 1.0 : value,
      },
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      for (const [datasetId, vals] of Object.entries(weights)) {
        const { error } = await supabase
          .from('instance_scoring_weights')
          .upsert({
            instance_id: instance.id,
            dataset_id: datasetId,
            category: Object.keys(categories).find(cat =>
              categories[cat].some(d => d.id === datasetId)
            ),
            dataset_weight: vals.dataset_weight,
            category_weight: vals.category_weight,
            updated_at: new Date().toISOString(),
          });
        if (error) console.error('Save weight error:', error);
      }

      // Re-run scoring aggregation
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
          Adjust dataset and category weights for the overall SSC scoring aggregation.
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

        {/* Tree of categories and datasets */}
        {Object.entries(categories).map(([cat, ds]) => (
          <div key={cat} className="mb-3 border rounded p-2 bg-gray-50">
            <div className="font-semibold text-gray-800 mb-1 flex justify-between items-center">
              <span>{cat}</span>
              <span className="text-xs text-gray-500">Category Weight:</span>
            </div>
            {ds.map(d => (
              <div key={d.id} className="flex items-center justify-between pl-4 py-1 border-t text-gray-700">
                <span className="truncate">{d.name}</span>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.1"
                    value={weights[d.id]?.dataset_weight ?? 1.0}
                    onChange={e => handleWeightChange(d.id, 'dataset_weight', parseFloat(e.target.value))}
                    className="w-20 text-sm border rounded px-2 py-0.5"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={weights[d.id]?.category_weight ?? 1.0}
                    onChange={e => handleWeightChange(d.id, 'category_weight', parseFloat(e.target.value))}
                    className="w-20 text-sm border rounded px-2 py-0.5"
                  />
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
