'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface InstanceScoringModalProps {
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface Dataset {
  id: string;
  name: string;
  type: string;
  adm_level?: string;
  rollup_method?: string;
  weight: number;
}

interface Category {
  category: string;
  active: boolean;
  expanded: boolean;
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
        .select('dataset_id,dataset_name,category,type,adm_level,rollup_method')
        .eq('instance_id', instance.id);

      if (error) {
        console.error('Error loading instance datasets:', error);
        // Create placeholder so UI renders
        setCategories([
          {
            category: 'SSC Framework - P1',
            active: true,
            expanded: true,
            weight: 1,
            datasets: [],
          },
        ]);
        return;
      }

      const grouped: Record<string, Dataset[]> = {};
      (data || []).forEach((d: any) => {
        if (!grouped[d.category]) grouped[d.category] = [];
        grouped[d.category].push({
          id: d.dataset_id,
          name: d.dataset_name,
          type: d.type,
          adm_level: d.adm_level || 'ADM3',
          rollup_method: d.rollup_method || 'direct',
          weight: 1,
        });
      });

      setCategories(
        Object.keys(grouped).map((cat) => ({
          category: cat,
          active: true,
          expanded: true,
          weight: 1,
          datasets: grouped[cat],
        }))
      );
    };
    if (instance?.id) load();
  }, [instance]);

  const toggleCategory = (cat: string) =>
    setCategories((prev) =>
      prev.map((c) =>
        c.category === cat ? { ...c, active: !c.active } : c
      )
    );

  const toggleExpand = (cat: string) =>
    setCategories((prev) =>
      prev.map((c) =>
        c.category === cat ? { ...c, expanded: !c.expanded } : c
      )
    );

  const updateCategoryWeight = (cat: string, newWeight: number) =>
    setCategories((prev) =>
      prev.map((c) =>
        c.category === cat ? { ...c, weight: newWeight } : c
      )
    );

  const updateDatasetWeight = (cat: string, dsId: string, newWeight: number) =>
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

        <h3 className="font-medium mt-4 mb-2 text-gray-700 text-sm">Calibration Tree</h3>

        <div className="border rounded-md max-h-[50vh] overflow-y-auto text-sm bg-gray-50">
          {categories.length === 0 ? (
            <p className="text-center text-gray-500 p-4 text-sm">
              No datasets available. Define datasets before calibration.
            </p>
          ) : (
            categories.map((cat, i) => (
              <div key={i} className="border-b last:border-b-0 p-2 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleExpand(cat.category)} className="text-gray-600">
                      {cat.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <input
                      type="checkbox"
                      checked={cat.active}
                      onChange={() => toggleCategory(cat.category)}
                    />
                    <span className="font-medium text-gray-800">{cat.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Weight</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={cat.weight}
                      onChange={(e) => updateCategoryWeight(cat.category, parseFloat(e.target.value))}
                      className="w-16 border border-gray-300 rounded px-1 py-0.5 text-right"
                    />
                  </div>
                </div>

                {cat.expanded && cat.datasets.length > 0 && (
                  <table className="w-full border-collapse ml-6 mt-2">
                    <thead>
                      <tr className="text-gray-500 text-xs">
                        <th className="text-left p-1 w-1/2">Dataset</th>
                        <th className="text-left p-1">ADM</th>
                        <th className="text-left p-1">Rollup</th>
                        <th className="text-right p-1 w-24">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.datasets.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="p-1 text-gray-800">{d.name}</td>
                          <td className="p-1 text-xs text-gray-500">{d.adm_level}</td>
                          <td className="p-1 text-xs text-gray-500">{d.rollup_method}</td>
                          <td className="p-1 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={d.weight}
                              onChange={(e) =>
                                updateDatasetWeight(
                                  cat.category,
                                  d.id,
                                  parseFloat(e.target.value)
                                )
                              }
                              className="w-16 border border-gray-300 rounded px-1 py-0.5 text-right"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
        </div>

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
