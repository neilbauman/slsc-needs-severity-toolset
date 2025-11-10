'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CategoricalScoringModalProps {
  dataset: any;
  instance: any; // ✅ unified naming
  onClose: () => void;
  onSaved?: () => void;
}

export default function CategoricalScoringModal({
  dataset,
  instance,
  onClose,
  onSaved,
}: CategoricalScoringModalProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [evaluationRule, setEvaluationRule] = useState<'20percent' | 'median' | 'mostPrevalent'>(
    '20percent'
  );
  const [threshold, setThreshold] = useState<number>(20);

  useEffect(() => {
    if (dataset) loadCategories();
  }, [dataset]);

  const loadCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('dataset_values_categorical')
      .select('category')
      .eq('dataset_id', dataset.id);
    if (!error && data) {
      const unique = Array.from(new Set(data.map((d) => d.category))).sort();
      setCategories(unique);
      const defaultScores: Record<string, number> = {};
      unique.forEach((cat) => (defaultScores[cat] = 3)); // midpoint default
      setScores(defaultScores);
    }
    setLoading(false);
  };

  const handleScoreChange = (cat: string, value: number) => {
    setScores((prev) => ({ ...prev, [cat]: value }));
  };

  const handleSave = async () => {
    const config = {
      scores,
      evaluationRule,
      threshold,
    };

    await supabase.from('scoring_configs').upsert({
      instance_id: instance.id,
      dataset_id: dataset.id,
      method: 'categorical',
      config,
    });

    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Configure Categorical Scoring — {dataset.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-light"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm text-gray-700">
          {loading ? (
            <p>Loading categories…</p>
          ) : categories.length === 0 ? (
            <p className="text-gray-500">No categories found for this dataset.</p>
          ) : (
            <>
              <table className="min-w-full border text-sm">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Score (1–5)</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2">{cat}</td>
                      <td className="px-3 py-2">
                        <select
                          value={scores[cat]}
                          onChange={(e) => handleScoreChange(cat, Number(e.target.value))}
                          className="border rounded px-2 py-1"
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-wrap gap-4 mt-4">
                <div>
                  <label className="block font-medium mb-1">Evaluation Rule</label>
                  <select
                    value={evaluationRule}
                    onChange={(e) =>
                      setEvaluationRule(
                        e.target.value as '20percent' | 'median' | 'mostPrevalent'
                      )
                    }
                    className="border rounded px-2 py-1"
                  >
                    <option value="20percent">20% Rule (worst score ≥ threshold)</option>
                    <option value="median">Median Score</option>
                    <option value="mostPrevalent">Most Prevalent Score</option>
                  </select>
                </div>

                {evaluationRule === '20percent' && (
                  <div>
                    <label className="block font-medium mb-1">Threshold %</label>
                    <input
                      type="number"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="border rounded px-2 py-1 w-20"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md border text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
