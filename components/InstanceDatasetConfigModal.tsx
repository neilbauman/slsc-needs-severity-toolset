'use client';

import { useEffect, useState } from 'react';
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
  const [config, setConfig] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load datasets & existing configs
  useEffect(() => {
    loadData();
  }, [instance]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: dsData } = await supabase
        .from('datasets')
        .select('id, name, category, type, admin_level')
        .order('category');

      const { data: cfgData } = await supabase
        .from('instance_dataset_config')
        .select('*')
        .eq('instance_id', instance.id);

      const cfgMap: Record<string, any> = {};
      (cfgData || []).forEach((c) => {
        cfgMap[c.dataset_id] = c;
      });

      setDatasets(dsData || []);
      setConfig(cfgMap);
    } catch (err) {
      console.error('Error loading dataset configs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (datasetId: string, field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [datasetId]: {
        ...prev[datasetId],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(config).map(([dataset_id, c]) => ({
        instance_id: instance.id,
        dataset_id,
        scoring_method: c.scoring_method || 'minmax',
        direction: c.direction || 'positive',
        weight: parseFloat(c.weight || 1),
      }));

      await supabase.from('instance_dataset_config').delete().eq('instance_id', instance.id);
      if (updates.length > 0)
        await supabase.from('instance_dataset_config').insert(updates);

      onClose();
    } catch (err) {
      console.error('Error saving dataset configs', err);
      alert('Error saving dataset configurations.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b p-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Configure Dataset Scoring
            </h2>
            <p className="text-xs text-gray-500">
              Instance: {instance.name}
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
        <div className="flex-grow overflow-y-auto p-4 text-[12px]">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading datasets...</p>
          ) : (
            <>
              {datasets.length === 0 ? (
                <p className="text-gray-500 text-sm">No datasets available.</p>
              ) : (
                <table className="min-w-full border text-xs">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Dataset</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">Admin Level</th>
                      <th className="px-3 py-2 text-left">Scoring Method</th>
                      <th className="px-3 py-2 text-left">Direction</th>
                      <th className="px-3 py-2 text-left">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasets.map((ds) => {
                      const c = config[ds.id] || {};
                      return (
                        <tr
                          key={ds.id}
                          className="border-t hover:bg-gray-50 transition"
                        >
                          <td className="px-3 py-2 text-gray-800">{ds.name}</td>
                          <td className="px-3 py-2">{ds.category}</td>
                          <td className="px-3 py-2">{ds.admin_level}</td>

                          <td className="px-3 py-2">
                            <select
                              value={c.scoring_method || 'minmax'}
                              onChange={(e) =>
                                handleChange(ds.id, 'scoring_method', e.target.value)
                              }
                              className="border rounded-md p-1 text-xs w-full"
                            >
                              <option value="minmax">Min–Max Normalization</option>
                              <option value="zscore">Z-Score Standardization</option>
                              <option value="quantile">Quantile Ranking</option>
                              <option value="threshold">Threshold (binary)</option>
                            </select>
                          </td>

                          <td className="px-3 py-2">
                            <select
                              value={c.direction || 'positive'}
                              onChange={(e) =>
                                handleChange(ds.id, 'direction', e.target.value)
                              }
                              className="border rounded-md p-1 text-xs w-full"
                            >
                              <option value="positive">Positive (higher = worse)</option>
                              <option value="negative">Negative (higher = better)</option>
                            </select>
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.1"
                              value={c.weight || 1}
                              onChange={(e) =>
                                handleChange(ds.id, 'weight', e.target.value)
                              }
                              className="border rounded-md p-1 text-xs w-full"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-gray-200 px-3 py-1.5 rounded-md text-sm hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-3 py-1.5 rounded-md text-sm text-white ${
              saving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
