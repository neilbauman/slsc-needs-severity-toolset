'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface DatasetConfigModalProps {
  instance: any;
  onClose: () => void;
}

export default function DatasetConfigModal({
  instance,
  onClose,
}: DatasetConfigModalProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all datasets and existing configs for this instance
  useEffect(() => {
    if (!instance) return;
    loadData();
  }, [instance]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: allDatasets, error: dsError } = await supabase
        .from('datasets')
        .select('*')
        .order('category', { ascending: true });

      if (dsError) throw dsError;

      const { data: existingConfigs, error: cfgError } = await supabase
        .from('instance_datasets')
        .select('*')
        .eq('instance_id', instance.id);

      if (cfgError) throw cfgError;

      setDatasets(allDatasets || []);
      setConfigs(existingConfigs || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load dataset configurations');
    } finally {
      setLoading(false);
    }
  };

  const getConfig = (datasetId: string) =>
    configs.find((c) => c.dataset_id === datasetId);

  const handleToggleDataset = (dataset: any) => {
    const exists = getConfig(dataset.id);
    if (exists) {
      setConfigs(configs.filter((c) => c.dataset_id !== dataset.id));
    } else {
      setConfigs([
        ...configs,
        {
          dataset_id: dataset.id,
          instance_id: instance.id,
          score_method: 'linear',
          direction: 'normal',
          weight: 1.0,
        },
      ]);
    }
  };

  const handleChange = (datasetId: string, field: string, value: any) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.dataset_id === datasetId ? { ...c, [field]: value } : c
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { error: delError } = await supabase
        .from('instance_datasets')
        .delete()
        .eq('instance_id', instance.id);
      if (delError) throw delError;

      if (configs.length > 0) {
        const { error: insertError } = await supabase
          .from('instance_datasets')
          .insert(configs);
        if (insertError) throw insertError;
      }

      alert('Dataset scoring configuration saved.');
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Error saving configuration: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const scoringMethods = [
    { value: 'linear', label: 'Linear (higher = higher risk)' },
    { value: 'inverse', label: 'Inverse (higher = lower risk)' },
    { value: 'threshold', label: 'Threshold (binary cutoff)' },
    { value: 'categorical', label: 'Categorical (mapped scores)' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl relative max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start p-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Dataset Scoring Configuration
            </h2>
            <p className="text-xs text-gray-500">
              Instance: {instance.name} ({instance.type})
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
        <div className="flex-grow overflow-y-auto p-4">
          {loading ? (
            <p className="text-gray-500 text-center py-8 text-sm">
              Loading datasets...
            </p>
          ) : error ? (
            <p className="text-red-600 text-center py-8">{error}</p>
          ) : datasets.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">
              No datasets found.
            </p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left border-b">Use</th>
                    <th className="px-3 py-2 text-left border-b">Name</th>
                    <th className="px-3 py-2 text-left border-b">Category</th>
                    <th className="px-3 py-2 text-left border-b">Type</th>
                    <th className="px-3 py-2 text-left border-b">Method</th>
                    <th className="px-3 py-2 text-left border-b">Direction</th>
                    <th className="px-3 py-2 text-left border-b">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((d) => {
                    const cfg = getConfig(d.id);
                    const selected = !!cfg;
                    return (
                      <tr
                        key={d.id}
                        className={`border-t ${
                          selected ? 'bg-blue-50' : 'bg-white'
                        }`}
                      >
                        <td className="px-3 py-2 border-b">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleToggleDataset(d)}
                          />
                        </td>
                        <td className="px-3 py-2 border-b font-medium">
                          {d.name}
                        </td>
                        <td className="px-3 py-2 border-b">{d.category}</td>
                        <td className="px-3 py-2 border-b capitalize">
                          {d.type}
                        </td>
                        <td className="px-3 py-2 border-b">
                          {selected && (
                            <select
                              value={cfg?.score_method || 'linear'}
                              onChange={(e) =>
                                handleChange(d.id, 'score_method', e.target.value)
                              }
                              className="border rounded-md px-1 py-0.5 text-sm"
                            >
                              {scoringMethods.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2 border-b">
                          {selected && (
                            <select
                              value={cfg?.direction || 'normal'}
                              onChange={(e) =>
                                handleChange(d.id, 'direction', e.target.value)
                              }
                              className="border rounded-md px-1 py-0.5 text-sm"
                            >
                              <option value="normal">Normal</option>
                              <option value="inverse">Inverse</option>
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2 border-b">
                          {selected && (
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={cfg?.weight ?? 1}
                              onChange={(e) =>
                                handleChange(
                                  d.id,
                                  'weight',
                                  parseFloat(e.target.value)
                                )
                              }
                              className="border rounded-md px-2 py-0.5 text-sm w-20"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-md text-sm hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
