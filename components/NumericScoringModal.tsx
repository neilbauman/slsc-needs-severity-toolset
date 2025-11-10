'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface NumericScoringModalProps {
  instanceId: string;
  dataset: any;
  onClose: () => void;
}

export default function NumericScoringModal({ instanceId, dataset, onClose }: NumericScoringModalProps) {
  const [method, setMethod] = useState<'threshold' | 'normalize'>('threshold');
  const [rules, setRules] = useState<any[]>([{ min: null, max: null, score: 1 }]);
  const [normMin, setNormMin] = useState<number>(0);
  const [normMax, setNormMax] = useState<number>(100);
  const [range, setRange] = useState<[number, number]>([1, 5]);
  const [direction, setDirection] = useState<'normal' | 'inverse'>('normal');
  const [saving, setSaving] = useState(false);
  const [fetchingRange, setFetchingRange] = useState(false);
  const [trimPercent, setTrimPercent] = useState<number>(5);

  useEffect(() => {
    loadExistingConfig();
  }, []);

  const loadExistingConfig = async () => {
    const { data, error } = await supabase
      .from('instance_datasets')
      .select('score_config')
      .eq('instance_id', instanceId)
      .eq('dataset_id', dataset.id)
      .single();

    if (error || !data?.score_config) return;

    const cfg = data.score_config;
    if (cfg.method === 'threshold') {
      setMethod('threshold');
      setRules(cfg.rules || []);
    } else if (cfg.method === 'normalize') {
      setMethod('normalize');
      setRange(cfg.range || [1, 5]);
      setDirection(cfg.direction || 'normal');
      setNormMin(cfg.min_value ?? 0);
      setNormMax(cfg.max_value ?? 100);
      setTrimPercent(cfg.trim_percent ?? 5);
    }
  };

  const handleAddRule = () => setRules([...rules, { min: null, max: null, score: 1 }]);

  const handleRuleChange = (index: number, field: string, value: any) => {
    const updated = [...rules];
    updated[index][field] = value;
    setRules(updated);
  };

  const handleDeleteRule = (index: number) => {
    const updated = [...rules];
    updated.splice(index, 1);
    setRules(updated);
  };

  const fetchDatasetMinMax = async () => {
    setFetchingRange(true);
    try {
      const { data, error } = await supabase
        .from('dataset_values_numeric')
        .select('value')
        .eq('dataset_id', dataset.id);

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('No numeric values found in this dataset.');
        return;
      }

      let values = data.map((v: any) => v.value).filter((v: number) => !isNaN(v));
      values.sort((a, b) => a - b);

      if (trimPercent > 0 && values.length > 20) {
        const trimCount = Math.floor((values.length * trimPercent) / 100);
        values = values.slice(trimCount, values.length - trimCount);
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      setNormMin(min);
      setNormMax(max);

      alert(
        `✅ Min/Max set from dataset: ${min.toFixed(2)} – ${max.toFixed(2)} ${
          trimPercent > 0 ? `(trimmed ${trimPercent}% each side)` : ''
        }`
      );
    } catch (err: any) {
      alert('Error fetching dataset min/max: ' + err.message);
    } finally {
      setFetchingRange(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    let score_config: any = {};

    if (method === 'threshold') {
      score_config = {
        method: 'threshold',
        rules: rules.map((r) => ({
          min: r.min ? parseFloat(r.min) : null,
          max: r.max ? parseFloat(r.max) : null,
          score: parseFloat(r.score),
        })),
      };
    } else if (method === 'normalize') {
      score_config = {
        method: 'normalize',
        min_value: parseFloat(normMin.toString()),
        max_value: parseFloat(normMax.toString()),
        range,
        direction,
        trim_percent: trimPercent,
      };
    }

    const { error } = await supabase
      .from('instance_datasets')
      .update({ score_config })
      .eq('instance_id', instanceId)
      .eq('dataset_id', dataset.id);

    if (error) {
      alert(`Error saving configuration: ${error.message}`);
    } else {
      alert('✅ Numeric scoring configuration saved.');
      onClose();
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl relative max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start p-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Configure Numeric Scoring</h2>
            <p className="text-xs text-gray-500">{dataset.name} ({dataset.category})</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-4 text-sm space-y-4">
          {/* Method selection */}
          <div className="flex gap-4">
            <label className="font-medium">Method:</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="border rounded-md px-2 py-1 text-sm"
            >
              <option value="threshold">Threshold-based</option>
              <option value="normalize">Normalization</option>
            </select>
          </div>

          {/* Threshold-based Scoring */}
          {method === 'threshold' && (
            <div>
              <h3 className="font-medium mb-2">Threshold Rules</h3>
              <table className="min-w-full text-sm border border-gray-200 rounded-md">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left border-b">Min</th>
                    <th className="px-2 py-1 text-left border-b">Max</th>
                    <th className="px-2 py-1 text-left border-b">Score</th>
                    <th className="px-2 py-1 text-left border-b"></th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="border rounded-md px-1 py-0.5 w-24"
                          value={r.min ?? ''}
                          onChange={(e) => handleRuleChange(i, 'min', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="border rounded-md px-1 py-0.5 w-24"
                          value={r.max ?? ''}
                          onChange={(e) => handleRuleChange(i, 'max', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="border rounded-md px-1 py-0.5 w-20"
                          value={r.score}
                          onChange={(e) => handleRuleChange(i, 'score', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button
                          onClick={() => handleDeleteRule(i)}
                          className="text-red-500 text-xs hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={handleAddRule}
                className="mt-2 bg-gray-200 px-2 py-1 text-xs rounded-md hover:bg-gray-300"
              >
                + Add Rule
              </button>
            </div>
          )}

          {/* Normalization */}
          {method === 'normalize' && (
            <div className="space-y-3">
              <h3 className="font-medium mb-2">Normalization Parameters</h3>

              <div className="flex flex-wrap gap-3 items-center">
                <label>Min Value:</label>
                <input
                  type="number"
                  className="border rounded-md px-2 py-1 w-24"
                  value={normMin}
                  onChange={(e) => setNormMin(parseFloat(e.target.value))}
                />
                <label>Max Value:</label>
                <input
                  type="number"
                  className="border rounded-md px-2 py-1 w-24"
                  value={normMax}
                  onChange={(e) => setNormMax(parseFloat(e.target.value))}
                />

                <button
                  onClick={fetchDatasetMinMax}
                  disabled={fetchingRange}
                  className="bg-gray-200 px-2 py-1 text-xs rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                  {fetchingRange ? 'Fetching…' : '📊 Use dataset min/max'}
                </button>

                <label className="ml-4">Trim % (each side):</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  className="border rounded-md px-2 py-1 w-16"
                  value={trimPercent}
                  onChange={(e) => setTrimPercent(parseFloat(e.target.value))}
                />
              </div>

              <div className="flex gap-4 items-center">
                <label>Score Range:</label>
                <select
                  value={range.join('-')}
                  onChange={(e) =>
                    setRange(e.target.value.split('-').map(Number) as [number, number])
                  }
                  className="border rounded-md px-2 py-1 text-sm"
                >
                  <option value="1-3">1–3</option>
                  <option value="1-4">1–4</option>
                  <option value="1-5">1–5</option>
                </select>

                <label>Direction:</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as any)}
                  className="border rounded-md px-2 py-1 text-sm"
                >
                  <option value="normal">Higher values = higher score</option>
                  <option value="inverse">Higher values = lower score</option>
                </select>
              </div>
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
