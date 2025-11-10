'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

interface NumericScoringModalProps {
  dataset: any;
  instanceId: string;
  onClose: () => void;
  onSaved?: () => void; // ✅ added for refresh callback
}

export default function NumericScoringModal({
  dataset,
  instanceId,
  onClose,
  onSaved,
}: NumericScoringModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [minVal, setMinVal] = useState<number | null>(null);
  const [maxVal, setMaxVal] = useState<number | null>(null);
  const [manualMin, setManualMin] = useState<string>('');
  const [manualMax, setManualMax] = useState<string>('');
  const [normalizationType, setNormalizationType] = useState<'1-3' | '1-4' | '1-5'>('1-5');
  const [direction, setDirection] = useState<'high-good' | 'high-bad'>('high-bad');
  const [thresholds, setThresholds] = useState<
    { label: string; min: string; max: string; score: number }[]
  >([]);
  const [mode, setMode] = useState<'normalize' | 'threshold'>('normalize');
  const [saving, setSaving] = useState(false);

  // ✅ Load sample data for histogram
  useEffect(() => {
    const loadData = async () => {
      const { data, error } = await supabase
        .from('dataset_values_numeric')
        .select('value')
        .eq('dataset_id', dataset.id);

      if (error) {
        console.error(error);
        return;
      }

      const numericValues = (data || [])
        .map((d: any) => parseFloat(d.value))
        .filter((v) => !isNaN(v));

      if (numericValues.length > 0) {
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        setMinVal(min);
        setMaxVal(max);
        setManualMin(min.toString());
        setManualMax(max.toString());

        // Build simple histogram
        const bins = 20;
        const step = (max - min) / bins;
        const hist = Array.from({ length: bins }, (_, i) => {
          const rangeMin = min + i * step;
          const rangeMax = rangeMin + step;
          const count = numericValues.filter(
            (v) => v >= rangeMin && v < rangeMax
          ).length;
          return {
            range: `${rangeMin.toFixed(1)}–${rangeMax.toFixed(1)}`,
            count,
          };
        });
        setData(hist);
      }
    };

    loadData();
  }, [dataset]);

  // ✅ Save configuration to Supabase
  const handleSave = async () => {
    setSaving(true);

    try {
      const config = {
        mode,
        normalizationType,
        direction,
        manualMin: parseFloat(manualMin),
        manualMax: parseFloat(manualMax),
        thresholds,
      };

      const { error } = await supabase.from('instance_scoring_config').upsert(
        {
          instance_id: instanceId,
          dataset_id: dataset.id,
          config,
        },
        { onConflict: 'instance_id, dataset_id' }
      );

      if (error) throw error;

      alert('Scoring configuration saved.');
      onSaved?.(); // ✅ triggers parent refresh
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error saving configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Configure Scoring — {dataset.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Mode Selection */}
        <div className="p-4 border-b flex gap-4">
          <button
            className={`px-3 py-1 rounded-md text-sm ${
              mode === 'normalize'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setMode('normalize')}
          >
            Normalization
          </button>
          <button
            className={`px-3 py-1 rounded-md text-sm ${
              mode === 'threshold'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setMode('threshold')}
          >
            Thresholds
          </button>
        </div>

        {/* Histogram */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Value Distribution
          </h3>
          {data.length === 0 ? (
            <p className="text-sm text-gray-500">Loading distribution…</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} interval={3} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Mode: Normalize */}
        {mode === 'normalize' && (
          <div className="p-4 border-t">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Normalization Settings
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-600 mb-1">
                  Normalization Scale
                </label>
                <select
                  value={normalizationType}
                  onChange={(e) =>
                    setNormalizationType(e.target.value as any)
                  }
                  className="border rounded-md px-2 py-1 w-full"
                >
                  <option value="1-3">1–3</option>
                  <option value="1-4">1–4</option>
                  <option value="1-5">1–5</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">Direction</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as any)}
                  className="border rounded-md px-2 py-1 w-full"
                >
                  <option value="high-good">Higher is better</option>
                  <option value="high-bad">Higher is worse</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">
                  Minimum Value
                </label>
                <input
                  type="number"
                  value={manualMin}
                  onChange={(e) => setManualMin(e.target.value)}
                  className="border rounded-md px-2 py-1 w-full"
                />
                <button
                  className="text-xs text-blue-600 mt-1"
                  onClick={() => setManualMin(minVal?.toString() || '')}
                >
                  Use dataset min ({minVal?.toFixed(2)})
                </button>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">
                  Maximum Value
                </label>
                <input
                  type="number"
                  value={manualMax}
                  onChange={(e) => setManualMax(e.target.value)}
                  className="border rounded-md px-2 py-1 w-full"
                />
                <button
                  className="text-xs text-blue-600 mt-1"
                  onClick={() => setManualMax(maxVal?.toString() || '')}
                >
                  Use dataset max ({maxVal?.toFixed(2)})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mode: Thresholds */}
        {mode === 'threshold' && (
          <div className="p-4 border-t">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Threshold Scoring Rules
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              Define thresholds to assign scores based on value ranges.
            </p>

            {thresholds.map((t, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 mb-2 text-sm">
                <input
                  type="text"
                  placeholder="Label"
                  value={t.label}
                  onChange={(e) => {
                    const newList = [...thresholds];
                    newList[i].label = e.target.value;
                    setThresholds(newList);
                  }}
                  className="border rounded-md px-2 py-1"
                />
                <input
                  type="number"
                  placeholder="Min"
                  value={t.min}
                  onChange={(e) => {
                    const newList = [...thresholds];
                    newList[i].min = e.target.value;
                    setThresholds(newList);
                  }}
                  className="border rounded-md px-2 py-1"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={t.max}
                  onChange={(e) => {
                    const newList = [...thresholds];
                    newList[i].max = e.target.value;
                    setThresholds(newList);
                  }}
                  className="border rounded-md px-2 py-1"
                />
                <input
                  type="number"
                  placeholder="Score"
                  value={t.score}
                  onChange={(e) => {
                    const newList = [...thresholds];
                    newList[i].score = Number(e.target.value);
                    setThresholds(newList);
                  }}
                  className="border rounded-md px-2 py-1"
                />
              </div>
            ))}

            <button
              onClick={() =>
                setThresholds([
                  ...thresholds,
                  { label: '', min: '', max: '', score: 1 },
                ])
              }
              className="text-xs text-blue-600 hover:underline"
            >
              + Add Threshold
            </button>
          </div>
        )}

        {/* Save */}
        <div className="p-4 border-t flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
