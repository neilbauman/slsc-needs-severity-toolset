'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface NumericScoringModalProps {
  dataset: any;
  instance: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function NumericScoringModal({
  dataset,
  instance,
  onClose,
  onSaved,
}: NumericScoringModalProps) {
  const [values, setValues] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [minValue, setMinValue] = useState<number | null>(null);
  const [maxValue, setMaxValue] = useState<number | null>(null);
  const [normalizationRange, setNormalizationRange] = useState<[number, number]>([1, 5]);
  const [direction, setDirection] = useState<'highBad' | 'highGood'>('highBad');
  const [useDatasetRange, setUseDatasetRange] = useState(true);

  useEffect(() => {
    if (dataset) loadValues();
  }, [dataset]);

  const loadValues = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('dataset_values_numeric')
      .select('value')
      .eq('dataset_id', dataset.id)
      .limit(5000);

    if (!error && data) {
      const vals = data.map((v) => Number(v.value)).filter((v) => !isNaN(v));
      setValues(vals);
      if (vals.length) {
        setMinValue(Math.min(...vals));
        setMaxValue(Math.max(...vals));
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const config = {
      normalizationRange,
      direction,
      min: minValue,
      max: maxValue,
      useDatasetRange,
    };

    await supabase.from('scoring_configs').upsert({
      instance_id: instance.id,
      dataset_id: dataset.id,
      method: 'numeric',
      config,
    });

    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl relative">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Configure Numeric Scoring — {dataset.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-light"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm text-gray-700">
          {loading ? (
            <p>Loading dataset values…</p>
          ) : values.length === 0 ? (
            <p className="text-gray-500">No numeric values found for this dataset.</p>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={values.map((v) => ({ value: v }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="value" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex gap-4 flex-wrap">
                <div>
                  <label className="block font-medium mb-1">Normalization Range</label>
                  <select
                    value={normalizationRange.join('-')}
                    onChange={(e) => {
                      const [min, max] = e.target.value.split('-').map(Number);
                      setNormalizationRange([min, max]);
                    }}
                    className="border rounded px-2 py-1"
                  >
                    <option value="1-3">1–3</option>
                    <option value="1-4">1–4</option>
                    <option value="1-5">1–5</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) =>
                      setDirection(e.target.value as 'highBad' | 'highGood')
                    }
                    className="border rounded px-2 py-1"
                  >
                    <option value="highBad">High values are worse</option>
                    <option value="highGood">High values are better</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Min / Max Values</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={minValue ?? ''}
                      onChange={(e) => setMinValue(Number(e.target.value))}
                      disabled={useDatasetRange}
                      className="border rounded px-2 py-1 w-24"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      value={maxValue ?? ''}
                      onChange={(e) => setMaxValue(Number(e.target.value))}
                      disabled={useDatasetRange}
                      className="border rounded px-2 py-1 w-24"
                    />
                    <label className="ml-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={useDatasetRange}
                        onChange={(e) => setUseDatasetRange(e.target.checked)}
                      />{' '}
                      Use dataset min/max
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md border text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
