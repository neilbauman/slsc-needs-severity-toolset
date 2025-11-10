'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface InstanceConfigModalProps {
  instance: any;
  onClose: () => void;
}

const DEFAULT_CATEGORIES = [
  'Core',
  'SSC Framework - P1',
  'SSC Framework - P2',
  'SSC Framework - P3',
  'Hazards',
  'Underlying Vulnerability',
];

export default function InstanceConfigModal({
  instance,
  onClose,
}: InstanceConfigModalProps) {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (instance) loadConfigs();
  }, [instance]);

  const loadConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instance_category_config')
      .select('*')
      .eq('instance_id', instance.id);
    if (error) console.error(error);

    const existing = data || [];
    const all = DEFAULT_CATEGORIES.map((cat) => {
      const found = existing.find((c) => c.category === cat);
      return (
        found || {
          category: cat,
          aggregation_method: 'mean',
          weight: 1,
          scoring_method: 'minmax',
        }
      );
    });
    setConfigs(all);
    setLoading(false);
  };

  const handleChange = (index: number, field: string, value: any) => {
    const updated = [...configs];
    updated[index] = { ...updated[index], [field]: value };
    setConfigs(updated);
  };

  const handleSave = async () => {
    setSaving(true);

    for (const cfg of configs) {
      const { error } = await supabase
        .from('instance_category_config')
        .upsert({
          instance_id: instance.id,
          category: cfg.category,
          aggregation_method: cfg.aggregation_method,
          weight: parseFloat(cfg.weight) || 1,
          scoring_method: cfg.scoring_method,
        });
      if (error) console.error('Error saving config:', error);
    }

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6">
        <h2 className="text-lg font-semibold mb-4">
          Configure Baseline Instance
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          Adjust the scoring and weighting for each category in this instance:
          <strong> {instance.name}</strong>
        </p>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading configuration…</p>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Aggregation Method</th>
                  <th className="px-3 py-2 text-left">Scoring Method</th>
                  <th className="px-3 py-2 text-left">Weight</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((cfg, i) => (
                  <tr
                    key={cfg.category}
                    className="border-t hover:bg-gray-50 transition"
                  >
                    <td className="px-3 py-2">{cfg.category}</td>

                    <td className="px-3 py-2">
                      <select
                        value={cfg.aggregation_method}
                        onChange={(e) =>
                          handleChange(i, 'aggregation_method', e.target.value)
                        }
                        className="border rounded-md p-1 text-sm w-full"
                      >
                        <option value="mean">Mean</option>
                        <option value="weighted">Weighted</option>
                        <option value="geometric">Geometric</option>
                        <option value="pca">PCA</option>
                      </select>
                    </td>

                    <td className="px-3 py-2">
                      <select
                        value={cfg.scoring_method}
                        onChange={(e) =>
                          handleChange(i, 'scoring_method', e.target.value)
                        }
                        className="border rounded-md p-1 text-sm w-full"
                      >
                        <option value="minmax">Min-Max</option>
                        <option value="zscore">Z-Score</option>
                        <option value="quantile">Quantile</option>
                        <option value="threshold">Threshold</option>
                      </select>
                    </td>

                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={cfg.weight}
                        onChange={(e) =>
                          handleChange(i, 'weight', e.target.value)
                        }
                        className="border rounded-md p-1 text-sm w-20 text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-3 py-1.5 text-sm rounded-md text-white ${
              saving
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
