'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ScoringPreviewModalProps {
  instance: any;
  onClose: () => void;
}

export default function ScoringPreviewModal({
  instance,
  onClose,
}: ScoringPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);

  useEffect(() => {
    if (instance) computeScores();
  }, [instance]);

  const computeScores = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1️⃣ Fetch configurations
      const [{ data: catCfg }, { data: dsCfg }, { data: datasets }] = await Promise.all([
        supabase.from('instance_category_config').select('*').eq('instance_id', instance.id),
        supabase.from('instance_dataset_config').select('*').eq('instance_id', instance.id),
        supabase.from('datasets').select('id, name, category, type'),
      ]);

      if (!catCfg || !dsCfg || !datasets) throw new Error('Missing configuration data');

      // 2️⃣ Compute per-dataset mock scores (in real deployment this would query aggregated dataset values)
      //    Here we simulate dataset-level normalized scores (0–1) for visual preview.
      const dsScores = dsCfg.map((cfg: any) => {
        const dataset = datasets.find((d) => d.id === cfg.dataset_id);
        const randomValue = Math.random(); // simulate preview
        const adjusted = cfg.direction === 'negative' ? 1 - randomValue : randomValue;
        return {
          dataset_id: cfg.dataset_id,
          name: dataset?.name || 'Unknown',
          category: dataset?.category || 'Uncategorized',
          weight: cfg.weight || 1,
          score: adjusted,
          scoring_method: cfg.scoring_method,
        };
      });

      // 3️⃣ Aggregate by category using weighted mean
      const catScores = catCfg.map((cat: any) => {
        const catItems = dsScores.filter((d) => d.category === cat.category);
        if (catItems.length === 0)
          return { category: cat.category, score: null, weight: cat.weight, datasets: [] };

        const totalWeight = catItems.reduce((acc, d) => acc + d.weight, 0);
        const weightedMean =
          catItems.reduce((acc, d) => acc + d.score * d.weight, 0) / totalWeight;

        return {
          category: cat.category,
          score: weightedMean,
          weight: cat.weight || 1,
          aggregation_method: cat.aggregation_method,
          datasets: catItems,
        };
      });

      // 4️⃣ Compute overall composite score (weighted average of categories)
      const totalCatWeight = catScores.reduce(
        (acc, c) => acc + (c.weight || 1),
        0
      );
      const overallScore =
        catScores.reduce((acc, c) => acc + (c.score || 0) * (c.weight || 1), 0) /
        totalCatWeight;

      setResults({ catScores, overallScore });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error computing scores');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-3 border-b pb-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Scoring Preview: {instance.name}
            </h2>
            <p className="text-xs text-gray-500">
              Type: {instance.type} • Admin Level: {instance.admin_level}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <p className="text-gray-500 text-center py-10 text-sm">
            Calculating preview…
          </p>
        ) : error ? (
          <p className="text-red-600 text-center py-4">{error}</p>
        ) : !results ? (
          <p className="text-gray-500 text-center py-6 text-sm">
            No scoring data available.
          </p>
        ) : (
          <div className="flex-grow overflow-y-auto">
            <table className="min-w-full text-sm border mb-6">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Aggregation</th>
                  <th className="px-3 py-2 text-left">Weight</th>
                  <th className="px-3 py-2 text-left">Score</th>
                </tr>
              </thead>
              <tbody>
                {results.catScores.map((c: any, i: number) => (
                  <tr
                    key={i}
                    className={`border-t ${
                      i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-gray-50`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {c.category}
                    </td>
                    <td className="px-3 py-2">{c.aggregation_method}</td>
                    <td className="px-3 py-2">{c.weight}</td>
                    <td className="px-3 py-2">
                      {c.score !== null ? c.score.toFixed(3) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-sm text-gray-800 font-semibold mb-2">
              Per-Category Details
            </div>

            {results.catScores.map((c: any, i: number) => (
              <div key={i} className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">
                  {c.category}
                </h3>
                {c.datasets.length === 0 ? (
                  <p className="text-gray-500 text-xs ml-1">
                    No datasets configured.
                  </p>
                ) : (
                  <table className="min-w-full text-xs border">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-3 py-1 text-left">Dataset</th>
                        <th className="px-3 py-1 text-left">Scoring Method</th>
                        <th className="px-3 py-1 text-left">Weight</th>
                        <th className="px-3 py-1 text-left">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.datasets.map((d: any, j: number) => (
                        <tr
                          key={j}
                          className={`border-t ${
                            j % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-1">{d.name}</td>
                          <td className="px-3 py-1">{d.scoring_method}</td>
                          <td className="px-3 py-1">{d.weight}</td>
                          <td className="px-3 py-1">{d.score.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {results && (
          <div className="border-t mt-4 pt-3">
            <p className="text-lg font-semibold text-gray-800">
              Overall Instance Score:{' '}
              <span className="text-blue-600">
                {results.overallScore.toFixed(3)}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
