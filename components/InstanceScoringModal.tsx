'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface InstanceScoringModalProps {
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface Dataset {
  id: string;
  name: string;
  type: string;
  weight: number;
}

interface Category {
  category: string;
  active: boolean;
  weight: number;
  datasets: Dataset[];
}

export default function InstanceScoringModal({
  instance,
  onClose,
  onSaved,
}: InstanceScoringModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [method, setMethod] = useState<'mean' | 'weighted_mean' | '20_percent' | 'custom'>(
    'weighted_mean'
  );
  const [threshold, setThreshold] = useState<number>(0.2);
  const [loading, setLoading] = useState(false);

  // Load dataset categories belonging to this instance
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('instance_datasets_view')
        .select('dataset_id,dataset_name,category,type')
        .eq('instance_id', instance.id);

      if (error) {
        console.error('Error loading instance datasets:', error);
        return;
      }

      const grouped: Record<string, Dataset[]> = {};
      (data || []).forEach((d: any) => {
        if (!grouped[d.category]) grouped[d.category] = [];
        grouped[d.category].push({
          id: d.dataset_id,
          name: d.dataset_name,
          type: d.type,
          weight: 1,
        });
      });

      const catArray: Category[] = Object.keys(grouped).map((cat) => ({
        category: cat,
        active: true,
        weight: 1,
        datasets: grouped[cat],
      }));

      setCategories(catArray);
    };
    if (instance?.id) load();
  }, [instance]);

  // Toggle category inclusion
  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.category === cat ? { ...c, active: !c.active } : c))
    );
  };

  // Adjust category weight
  const updateCategoryWeight = (cat: string, newWeight: number) => {
    setCategories((prev) =>
      prev.map((c) => (c.category === cat ? { ...c, weight: newWeight } : c))
    );
  };

  // Adjust dataset weight
  const updateDatasetWeight = (cat: string, dsId: string, newWeight: number) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.category === cat
          ? {
              ...c,
              datasets: c.datasets.map((d) =>
                d.id === dsId ? { ...d, weight: newWeight } : d
              ),
            }
          : c
      )
    );
  };

  const handleApply = async () => {
    setLoading(true);

    const activeCategories = categories.filter((c) => c.active);
    if (!activeCategories.length) {
      alert('Select at least one category to aggregate.');
      setLoading(false);
      return;
    }

    // Existing RPC call (weights are not yet persisted or applied)
    const { data, error } = await supabase.rpc('score_instance_overall', {
      in_instance_id: instance.id,
      in_method: method,
      in_threshold: threshold,
      in_categories: activeCategories.map((c) => c.category),
    });

    if (error) {
      console.error('Error computing instance score:', error);
      alert(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    console.log('Instance scoring complete:', data);
    if (onSaved) await onSaved();
    onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl text-sm">
        <h2 className="text-lg font-semibold mb-2">
          Calibration & Overall Scoring – {instance?.name}
        </h2>
        <p className="text-gray-600 mb-4">
          Adjust weights for datasets and categories to calibrate how overall SSC vulnerability
          scores are computed. (Weights are local only until backend persistence is added.)
        </p>

        {/* Aggregation method */}
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1">Aggregation method</label>
          <select
            value={method}
            onChange={(e) =>
              setMethod(e.target.value as 'mean' | 'weighted_mean' | '20_percent' | 'custom')
            }
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
          >
            <option value="mean">Simple average</option>
            <option value="weighted_mean">Weighted mean</option>
            <option value="20_percent">20% rule (≥ 20%)</option>
            <option value="custom">Custom % rule</option>
          </select>
        </div>

        {/* Custom threshold */}
        {method === 'custom' && (
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1">
              Custom threshold (% as decimal)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
            />
          </div>
        )}

        {/* Calibration Tree */}
        <h3 className="font-medium mt-4 mb-2 text-gray-700 text-sm">Calibration Tree</h3>
        <div className="border rounded-md max-h-[50vh] overflow-y-auto text-sm">
          {categories.map((cat, i) => (
            <div key={i} className="border-b last:border-b-0 p-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cat.active}
                    onChange={() => toggleCategory(cat.category)}
                  />
                  <span className="font-medium text-gray-800">{cat.category}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600">Weight:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={cat.weight}
                    onChange={(e) =>
                      updateCategoryWeight(cat.category, parseFloat(e.target.value) || 0)
                    }
                    className="w-20 border border-gray-300 rounded px-1 py-0.5 text-right"
                  />
                </div>
              </div>

              <table className="w-full border-collapse ml-6 mb-1">
                <thead>
                  <tr className="text-gray-500 text-xs">
                    <th className="text-left p-1 w-2/3">Dataset</th>
                    <th className="text-left p-1">Type</th>
                    <th className="text-right p-1 w-24">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.datasets.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="p-1 text-gray-800">{d.name}</td>
                      <td className="p-1 text-gray-500 text-xs">{d.type}</td>
                      <td className="p-1 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={d.weight}
                          onChange={(e) =>
                            updateDatasetWeight(cat.category, d.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-16 border border-gray-300 rounded px-1 py-0.5 text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end space-x-3 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={loading}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          >
            {loading ? 'Scoring…' : 'Apply Scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}
