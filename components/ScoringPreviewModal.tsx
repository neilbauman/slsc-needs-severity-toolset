'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ScoringPreviewModalProps {
  instance: any;
  onClose: () => void;
}

export default function ScoringPreviewModal({ instance, onClose }: ScoringPreviewModalProps) {
  const [datasetConfigs, setDatasetConfigs] = useState<any[]>([]);
  const [categoryConfigs, setCategoryConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScoringData();
  }, [instance]);

  const loadScoringData = async () => {
    setLoading(true);
    try {
      const { data: datasetCfg } = await supabase
        .from('instance_dataset_config')
        .select(`
          *,
          datasets (
            id,
            name,
            category,
            type,
            admin_level
          )
        `)
        .eq('instance_id', instance.id);

      const { data: categoryCfg } = await supabase
        .from('instance_category_config')
        .select('*')
        .eq('instance_id', instance.id);

      setDatasetConfigs(datasetCfg || []);
      setCategoryConfigs(categoryCfg || []);
    } catch (err) {
      console.error('Error loading scoring preview', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedByCategory = datasetConfigs.reduce((acc: any, cfg: any) => {
    const cat = cfg.datasets?.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cfg);
    return acc;
  }, {});

  // Mock calculation for now (weights normalized)
  const mockCategoryScores = Object.entries(groupedByCategory).map(([cat]) => {
    const catCfg = categoryConfigs.find((c) => c.category === cat);
    const weight = catCfg?.weight ?? 1;
    const randomScore = Math.random() * 100; // placeholder for real normalized score
    return { cat, weight, randomScore };
  });

  const totalWeight = mockCategoryScores.reduce((a, b) => a + b.weight, 0);
  const weightedTotal =
    totalWeight > 0
      ? mockCategoryScores.reduce((a, b) => a + (b.randomScore * b.weight) / totalWeight, 0)
      : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start border-b p-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Scoring Preview</h2>
            <p className="text-xs text-gray-500">Instance: {instance.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-4 text-[12px]">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading scoring configuration…</p>
          ) : Object.keys(groupedByCategory).length === 0 ? (
            <p className="text-gray-500 text-sm">
              No scoring configuration found for this instance.
            </p>
          ) : (
            <>
              {Object.entries(groupedByCategory).map(([cat, cfgs]) => {
                const catCfg = categoryConfigs.find((c) => c.category === cat);
                const categoryWeight = catCfg?.weight ?? 1;
                const aggregation = catCfg?.aggregation_method ?? 'mean';
                const mockScore = mockCategoryScores.find((m) => m.cat === cat)?.randomScore ?? 0;

                return (
                  <div key={cat} className="mb-6 border rounded-md bg-gray-50">
                    <div className="flex justify-between items-center bg-gray-100 border-b px-3 py-2">
                      <h3 className="font-semibold text-gray-800">{cat}</h3>
                      <span className="text-xs text-gray-600">
                        Aggregation: <strong>{aggregation}</strong> | Weight:{' '}
                        <strong>{categoryWeight}</strong>
                      </span>
                    </div>

                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-200 text-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Dataset</th>
                          <th className="px-3 py-2 text-left">Admin Level</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Scoring Method</th>
                          <th className="px-3 py-2 text-left">Direction</th>
                          <th className="px-3 py-2 text-left">Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cfgs.map((cfg: any) => (
                          <tr key={cfg.dataset_id} className="border-t hover:bg-gray-50 transition">
                            <td className="px-3 py-2 font-medium text-gray-800">
                              {cfg.datasets?.name}
                            </td>
                            <td className="px-3 py-2">{cfg.datasets?.admin_level}</td>
                            <td className="px-3 py-2 capitalize">{cfg.datasets?.type}</td>
                            <td className="px-3 py-2">{cfg.scoring_method}</td>
                            <td className="px-3 py-2 capitalize">{cfg.direction}</td>
                            <td className="px-3 py-2">{cfg.weight}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mock score bar */}
                    <div className="px-3 py-2 border-t bg-white">
                      <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
                        <span>Category Score</span>
                        <span>{mockScore.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded">
                        <div
                          className="h-2 bg-blue-500 rounded"
                          style={{ width: `${mockScore}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Composite roll-up */}
              <div className="mt-8 border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  Overall Weighted Score
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-gray-200 rounded relative">
                    <div
                      className="absolute top-0 left-0 h-3 bg-green-600 rounded"
                      style={{ width: `${weightedTotal}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-gray-700">
                    {weightedTotal.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Weighted average of all category scores (normalized for category weights).
                  Mocked scores are randomized placeholders — ready to be replaced with real computed scores once scoring logic is implemented.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-200 px-3 py-1.5 rounded-md text-sm hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
