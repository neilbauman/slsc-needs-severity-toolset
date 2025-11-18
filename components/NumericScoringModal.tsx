'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface NumericScoringModalProps {
  dataset: any;
  instance: any;
  onClose: () => void;
  onSaved?: () => Promise<void>;
}

export default function NumericScoringModal({ dataset, instance, onClose, onSaved }: NumericScoringModalProps) {
  const [method, setMethod] = useState<'Normalization' | 'Thresholds'>('Normalization');
  const [scaleMax, setScaleMax] = useState<number>(3);
  const [inverse, setInverse] = useState<boolean>(false);
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [scope, setScope] = useState<'Affected Area' | 'National'>('Affected Area');
  const [message, setMessage] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [previewStats, setPreviewStats] = useState<any | null>(null);

  // Load existing saved config
  useEffect(() => {
    const loadConfig = async () => {
      const { data, error } = await supabase
        .from('instance_dataset_config')
        .select('score_config, scoring_method, normalize_max, higher_is_worse')
        .eq('instance_id', instance.id)
        .eq('dataset_id', dataset.id)
        .single();

      if (error) {
        console.warn('No existing score config found:', error.message);
        return;
      }

      if (data) {
        if (data.scoring_method)
          setMethod(data.scoring_method === 'threshold' ? 'Thresholds' : 'Normalization');
        if (data.normalize_max) setScaleMax(data.normalize_max);
        if (data.higher_is_worse !== null) setInverse(data.higher_is_worse);
        if (data.score_config?.thresholds?.length) setThresholds(data.score_config.thresholds);
      }
    };
    loadConfig();
  }, [instance.id, dataset.id]);

  // Save configuration persistently
  const saveConfig = async () => {
    setSaving(true);
    setMessage('');

    const config = {
      method,
      scaleMax,
      inverse,
      thresholds,
    };

    const { error } = await supabase
      .from('instance_dataset_config')
      .upsert(
        {
          instance_id: instance.id,
          dataset_id: dataset.id,
          scoring_method: method.toLowerCase(),
          normalize_max: scaleMax,
          higher_is_worse: inverse,
          score_config: config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'instance_id,dataset_id' }
      );

    if (error) {
      console.error('Error saving config:', error);
      setMessage(`❌ Error saving config: ${error.message}`);
    } else {
      setMessage('✅ Config saved!');
      if (onSaved) await onSaved();
    }

    setSaving(false);
  };

  // Preview values
  const preview = async () => {
    setMessage('');
    setPreviewStats(null);

    const { data, error } = await supabase
      .from('dataset_values')
      .select('value')
      .eq('dataset_id', dataset.id);

    if (error) {
      console.error('Preview error:', error);
      setMessage(`❌ Preview error: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setMessage('⚠️ No data available for preview.');
      return;
    }

    const numericValues = data
      .map((d: any) => Number(d.value))
      .filter((v) => Number.isFinite(v));

    if (numericValues.length === 0) {
      setMessage('⚠️ No numeric values found in dataset.');
      return;
    }

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;

    setPreviewStats({ count: numericValues.length, min, max, avg });
    setMessage('✅ Preview generated.');
  };

  // Apply scoring
  const applyScoring = async () => {
    setSaving(true);
    setMessage('Running scoring...');

    let rpcResponse;

    if (method === 'Normalization') {
      rpcResponse = await supabase.rpc('score_numeric_normalized', {
        in_instance_id: instance.id,
        in_dataset_id: dataset.id,
        in_scale_max: scaleMax,
        in_inverse: inverse,
      });
    } else {
      rpcResponse = await supabase.rpc('score_numeric_thresholds', {
        in_instance_id: instance.id,
        in_dataset_id: dataset.id,
        in_rules: thresholds,
      });
    }

    if (rpcResponse.error) {
      console.error('Error running scoring:', rpcResponse.error);
      setMessage(`❌ Error running scoring: ${rpcResponse.error.message}`);
    } else {
      setMessage('✅ Scoring complete!');
      if (onSaved) await onSaved();
    }

    setSaving(false);
  };

  // Threshold helpers
  const addRange = () => setThresholds([...thresholds, { min: 0, max: 0, score: 1 }]);
  const updateRange = (idx: number, key: string, value: any) => {
    const updated = [...thresholds];
    updated[idx][key] = value;
    setThresholds(updated);
  };
  const removeRange = (idx: number) => setThresholds(thresholds.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[640px] max-h-[90vh] overflow-y-auto text-sm">
        <h2 className="text-lg font-semibold mb-1">{dataset.name}</h2>
        <p className="text-gray-600 mb-4">Define and preview scoring configuration.</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium mb-1">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="border rounded px-2 py-1 w-full"
            >
              <option>Normalization</option>
              <option>Thresholds</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="border rounded px-2 py-1 w-full"
            >
              <option>Affected Area</option>
              <option>National</option>
            </select>
          </div>
        </div>

        {/* Normalization */}
        {method === 'Normalization' && (
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1">Scale (max score)</label>
            <select
              value={scaleMax}
              onChange={(e) => setScaleMax(Number(e.target.value))}
              className="border rounded px-2 py-1 w-full"
            >
              {[3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  1–{v}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center mt-2 text-xs">
              <input
                type="checkbox"
                checked={inverse}
                onChange={(e) => setInverse(e.target.checked)}
                className="mr-2"
              />
              Higher values mean higher risk
            </label>
          </div>
        )}

        {/* Thresholds */}
        {method === 'Thresholds' && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium">Threshold Ranges</span>
              <button
                onClick={addRange}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-100"
              >
                + Add Range
              </button>
            </div>
            <table className="w-full text-xs border rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Min</th>
                  <th className="p-2 text-left">Max</th>
                  <th className="p-2 text-left">Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1">
                      <input
                        type="number"
                        value={t.min}
                        onChange={(e) => updateRange(i, 'min', Number(e.target.value))}
                        className="border rounded px-1 py-0.5 w-full"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={t.max}
                        onChange={(e) => updateRange(i, 'max', Number(e.target.value))}
                        className="border rounded px-1 py-0.5 w-full"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={t.score}
                        onChange={(e) => updateRange(i, 'score', Number(e.target.value))}
                        className="border rounded px-1 py-0.5 w-full"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => removeRange(i)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Preview Stats */}
        {previewStats && (
          <div className="text-xs text-gray-700 mt-2 border-t pt-2">
            <p>
              <b>Count:</b> {previewStats.count}
            </p>
            <p>
              <b>Min:</b> {previewStats.min.toFixed(2)}
            </p>
            <p>
              <b>Max:</b> {previewStats.max.toFixed(2)}
            </p>
            <p>
              <b>Average:</b> {previewStats.avg.toFixed(2)}
            </p>
          </div>
        )}

        {message && (
          <p
            className={`mt-3 text-sm ${
              message.startsWith('✅') ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {message}
          </p>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1 border rounded hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={preview}
            disabled={saving}
            className="px-3 py-1 bg-yellow-100 border border-yellow-400 rounded hover:bg-yellow-200"
          >
            Preview
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100"
          >
            Save Config
          </button>
          <button
            onClick={applyScoring}
            disabled={saving}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Apply Scoring
          </button>
        </div>
      </div>
    </div>
  );
}
