'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface InstanceDatasetConfigModalProps {
  instance: any;
  onClose: () => void;
}

export default function InstanceDatasetConfigModal({
  instance,
  onClose,
}: InstanceDatasetConfigModalProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (instance) loadData();
  }, [instance]);

  const loadData = async () => {
    setLoading(true);

    // Get all datasets
    const { data: dsData, error: dsError } = await supabase
      .from('datasets')
      .select('*')
      .order('category', { ascending: true });
    if (dsError) console.error(dsError);

    // Get existing configs for this instance
    const { data: cfgData, error: cfgError } = await supabase
      .from('instance_dataset_config')
      .select('*')
      .eq('instance_id', instance.id);
    if (cfgError) console.error(cfgError);

    // Merge existing configs with datasets
    const merged = (dsData || []).map((d: any) => {
      const found = (cfgData || []).find((c) => c.dataset_id === d.id);
      return (
        found || {
          dataset_id: d.id,
          name: d.name,
          category: d.category,
          type: d.type,
          scoring_method: 'minmax',
          direction: 'positive',
          weight: 1,
        }
      );
    });

    setDatasets(dsData || []);
    setConfigs(merged);
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
      const { error } = await supabase.from('instance_dataset_config').upsert({
        instance_id: instance.id,
        dataset_id: cfg.dataset_id,
        scoring_method: cfg.scoring_method,
        direction: cfg.direction,
        weight: parseFloat(cfg.weight) || 1,
      });
      if (error) console.error('Error saving config:', error);
    }

    setSaving(false);
    onClose();
  };

  const grouped = configs.reduce((acc: any, cfg: any) => {
    const cat = cfg.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cfg);
    return acc;
  }, {});

  const orderedCategories = [
    'Core',
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Hazards',
    'Underlying Vulnerability',
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-6 max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-semibold mb-2">
          Configure Dataset Scoring
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Define how each dataset is scored in{' '}
          <strong>{instance.name}</strong>.
        </p>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading datasets…</p>
        ) : (
          <div className="flex-grow overflow-y-auto border rounded-md">
            {orderedCategories.map((cat) => {
              const items = grouped[cat] || [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="border-b last:border-0">
                  <h3 className="bg-gray-100 text-gray-800 font-semibold text-sm px-3 py-2">
                    {cat}
                  </h3>
                  <table className="min-w-full text-[12px]">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-3 py-1 text-left">Dataset</th>
                        <th className="px-3 py-1 text-left">Type</th>
                        <th className="px-3 py-1 text-left">Scoring</th>
                        <th className="px-3 py-1 text-left">Direction</th>
                        <th className="px-3 py-1 text-left">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((cfg: any, i: number) => (
                        <tr
                          key={cfg.dataset_id}
                          className="border-t hover:bg-gray-50 transition"
                        >
                          <td className="px-3 py-1">{cfg.name}</td>
                          <td className="px-3 py-1 capitalize">{cfg.type}</td>

                          <td className="px-3 py-1">
                            <select
                              value={cfg.scoring_method}
                              onChange={(e) =>
                                handleChange(i, 'scoring_method', e.target.value)
                              }
                              className="border rounded-md p-1 text-xs w-full"
                            >
                              <option value="minmax">Min-Max</option>
                              <option value="zscore">Z-Score</option>
                              <option value="quantile">Quantile</option>
                              <option value="threshold">Threshold</option>
                            </select>
                          </td>

                          <td className="px-3 py-1">
                            <select
                              value={cfg.direction}
                              onChange={(e) =>
                                handleChange(i, 'direction', e.target.value)
                              }
                              className="border rounded-md p-1 text-xs w-full"
                            >
                              <option value="positive">Higher = Worse</option>
                              <option value="negative">Higher = Better</option>
                            </select>
                          </td>

                          <td className="px-3 py-1">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={cfg.weight}
                              onChange={(e) =>
                                handleChange(i, 'weight', e.target.value)
                              }
                              className="border rounded-md p-1 text-xs w-16 text-center"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
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
            {saving ? 'Saving...' : 'Save Scoring Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
