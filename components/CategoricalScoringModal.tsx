'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CategoricalScoringModalProps {
  dataset: any;
  instanceId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function CategoricalScoringModal({
  dataset,
  instanceId,
  onClose,
  onSaved,
}: CategoricalScoringModalProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryScores, setCategoryScores] = useState<Record<string, number>>({});
  const [evaluationMethod, setEvaluationMethod] = useState('20_percent_rule');
  const [threshold, setThreshold] = useState<number>(0.2);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataset?.id) return;
    loadCategories();
  }, [dataset]);

  async function loadCategories() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('dataset_values_categorical')
        .select('category')
        .eq('dataset_id', dataset.id)
        .limit(5000);

      if (error) throw error;

      const unique = Array.from(new Set(data.map((d: any) => d.category))).sort();
      setCategories(unique);
      const initialScores: Record<string, number> = {};
      unique.forEach((c) => (initialScores[c] = 3));
      setCategoryScores(initialScores);
    } catch (err: any) {
      console.error(err);
      setError('Error loading categories');
    } finally {
      setLoading(false);
    }
  }

  const handleScoreChange = (category: string, value: number) => {
    setCategoryScores((prev) => ({ ...prev, [category]: value }));
  };

  async function handleSave() {
    try {
      setSaving(true);
      const { error } = await supabase.from('instance_scoring_config').insert([
        {
          instance_id: instanceId,
          dataset_id: dataset.id,
          method: 'categorical',
          config: {
            categoryScores,
            evaluationMethod,
            threshold,
          },
        },
      ]);

      if (error) throw error;
      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Configure Categorical Scoring — {dataset?.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 text-sm text-gray-700">
          {loading ? (
            <p className="text-gray-500 text-center">Loading categories…</p>
          ) : error ? (
            <p className="text-red-600 text-center">{error}</p>
          ) : (
            <>
              <div className="mb-4">
                <label className="block font-medium mb-1">
                  Evaluation Method
                </label>
                <select
                  value={evaluationMethod}
                  onChange={(e) => setEvaluationMethod(e.target.value)}
                  className="border rounded-md px-2 py-1 w-full text-sm"
                >
                  <option value="20_percent_rule">20% Rule</option>
                  <option value="custom_percent_rule">Custom % Rule</option>
                  <option value="most_prevalent">Most Prevalent</option>
                  <option value="median_score">Median Score</option>
                  <option value="weighted_mean">Weighted Mean</option>
                </select>
              </div>

              {evaluationMethod === 'custom_percent_rule' && (
                <div className="mb-4">
                  <label className="block font-medium mb-1">
                    Custom Threshold (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="border rounded-md px-2 py-1 w-24 text-sm"
                  />
                  <span className="ml-2 text-gray-500 text-xs">
                    (e.g. 0.2 = 20%)
                  </span>
                </div>
              )}

              <h3 className="text-sm font-semibold mb-2">Category Scoring</h3>
              <div className="border rounded-md overflow-y-auto max-h-[40vh]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">
                        Category
                      </th>
                      <th className="text-left px-3 py-2 font-medium">
                        Score (1–5)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">{cat}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={categoryScores[cat]}
                            onChange={(e) =>
                              handleScoreChange(cat, Number(e.target.value))
                            }
                            className="border rounded-md px-2 py-1 w-20 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t p-3">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm text-gray-700 border hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
