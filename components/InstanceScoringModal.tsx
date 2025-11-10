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
    { category: string; datasets: any[]; active: boolean }[]
  >([]);
  const [method, setMethod] = useState<
    'mean' | 'weighted_mean' | '20_percent' | 'custom'
  >('weighted_mean');
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

      const grouped: Record<string, any[]> = {};
      (data || []).forEach((d: any) => {
        if (!grouped[d.category]) grouped[d.category] = [];
        grouped[d.category].push(d);
      });

      setCategories(
        Object.keys(grouped).map((cat) => ({
          category: cat,
          datasets: grouped[cat],
          active: true,
        }))
      );
    };
    if (instance?.id) load();
  }, [instance]);

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.category === cat ? { ...c, active: !c.active } : c
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
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl">
        <h2 className="text-xl font-semibold mb-2">
          Configure Overall Scoring – {instance?.name}
        </h2>
        <p className="text-gray-600 mb-4">
          Aggregate scores across dataset categories and compute the final SSC vulnerability score per admin area.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Aggregation method
          </label>
          <select
            value={method}
            onChange={(e) =>
              setMethod(
                e.target.value as
                  | 'mean'
                  | 'weighted_mean'
                  | '20_percent'
                  | 'custom'
              )
            }
            className="border border-gray-300 rounded px-3 py-2 w-full"
          >
            <option value="mean">Simple average</option>
            <option value="weighted_mean">Weighted mean</option>
            <option value="20_percent">20% rule (≥ 20%)</option>
            <option value="custom">Custom % rule</option>
          </select>
        </div>

        {method === 'custom' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Custom threshold (% as decimal)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="border border-gray-300 rounded px-3 py-2 w-full"
            />
          </div>
        )}

        <h3 className="font-medium mt-6 mb-2 text-gray-700">
          Included Categories
        </h3>
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="text-left p-2 font-medium">Category</th>
              <th className="text-left p-2 font-medium">Datasets</th>
              <th className="text-center p-2 font-medium w-24">Include</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-2 text-gray-800">{c.category}</td>
                <td className="p-2 text-sm text-gray-600">
                  {c.datasets.map((d) => d.dataset_name).join(', ')}
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={c.active}
                    onChange={() => toggleCategory(c.category)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end space-x-3">
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
