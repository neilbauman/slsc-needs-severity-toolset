'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CategoryRow {
  category: string;
  score: number | '';
}

interface CategoricalScoringModalProps {
  dataset: any;
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function CategoricalScoringModal({
  dataset,
  instance,
  onClose,
  onSaved,
}: CategoricalScoringModalProps) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [method, setMethod] = useState<
    'twenty_percent' | 'custom_percent' | 'median' | 'mode' | 'weighted_mean'
  >('weighted_mean');
  const [threshold, setThreshold] = useState<number>(0.2);
  const [loading, setLoading] = useState(false);

  // Load distinct categories for this dataset
  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('dataset_values_categorical')
        .select('category')
        .eq('dataset_id', dataset.id);

      if (error) {
        console.error('Error loading categories:', error);
        setLoading(false);
        return;
      }

      const distinct = Array.from(
        new Set(
          (data || [])
            .map((r) => (r.category ? r.category.trim() : null))
            .filter((v) => !!v)
        )
      ).sort();

      setRows(distinct.map((cat) => ({ category: cat, score: '' })));
      setLoading(false);
    };

    if (dataset?.id) loadCategories();
  }, [dataset]);

  const handleScoreChange = (index: number, value: string) => {
    const newRows = [...rows];
    const parsed = value === '' ? '' : Math.max(1, Math.min(5, parseInt(value)));
    newRows[index].score = parsed;
    setRows(newRows);
  };

  const handleApplyScoring = async () => {
    if (!instance?.id || !dataset?.id) {
      alert('Missing instance or dataset ID.');
      return;
    }

    setLoading(true);

    // Filter valid categories
    const categoryScores = rows
      .filter((r) => r.score !== '')
      .map((r) => ({
        category: r.category,
        score: Number(r.score),
      }));

    const { data, error } = await supabase.rpc('score_building_typology', {
      in_category_scores: categoryScores,
      in_dataset_id: dataset.id,
      in_instance_id: instance.id,
      in_method: method,
      in_threshold: threshold,
    });

    if (error) {
      console.error('Error applying scoring:', error);
      alert(`Error applying scoring: ${error.message}`);
      setLoading(false);
      return;
    }

    console.log('Scoring applied successfully:', data);

    // Close and refresh parent modal
    if (onSaved) await onSaved();
    onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
        <h2 className="text-xl font-semibold mb-1">
          {dataset?.name || 'Categorical Dataset'}
        </h2>
        <p className="text-gray-600 mb-4">
          Assign a score (1–5) to each category, then apply scoring.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Overall method
          </label>
          <select
            value={method}
            onChange={(e) =>
              setMethod(
                e.target.value as
                  | 'twenty_percent'
                  | 'custom_percent'
                  | 'median'
                  | 'mode'
                  | 'weighted_mean'
              )
            }
            className="border border-gray-300 rounded px-3 py-2 w-full"
          >
            <option value="twenty_percent">20% rule (≥ 20%)</option>
            <option value="custom_percent">Custom % rule</option>
            <option value="median">Median</option>
            <option value="mode">Most prevalent</option>
            <option value="weighted_mean">Weighted mean</option>
          </select>
        </div>

        {method === 'custom_percent' && (
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

        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="text-left p-2 font-medium">Category</th>
              <th className="text-left p-2 font-medium w-32">Score (1–5)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-2 text-gray-800">{row.category}</td>
                <td className="p-2">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={row.score}
                    onChange={(e) => handleScoreChange(i, e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 w-20"
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
            onClick={handleApplyScoring}
            disabled={loading}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {loading ? 'Applying…' : 'Apply Scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}
