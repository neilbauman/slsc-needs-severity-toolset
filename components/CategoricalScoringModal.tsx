'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClientBrowser } from '@/lib/supabaseBrowser';

type CategoryRow = { category: string; score?: number | null };

export default function CategoricalScoringModal({
  dataset,
  instance,
  onClose,
  onSaved,
}: {
  dataset: any;
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const supabase = createClientBrowser();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<'twenty_percent' | 'custom_percent' | 'median' | 'mode' | 'weighted_mean'>('weighted_mean');
  const [threshold, setThreshold] = useState<number>(0.2);
  const [error, setError] = useState<string | null>(null);

  // load distinct categories for this dataset
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('dataset_values_categorical')
        .select('category, value')
        .eq('dataset_id', dataset.id)
        .limit(100000);
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const setCats = new Set<string>();
      data?.forEach((r: any) => {
        const c = (r.category ?? String(r.value ?? '')).trim();
        if (c) setCats.add(c);
      });
      const filtered = Array.from(setCats).filter(
        (c) => c.toLowerCase() !== 'housing units' && c.toLowerCase() !== 'municipality_city code'
      );
      setRows(filtered.sort().map((c) => ({ category: c })));
      setLoading(false);
    };
    load();
  }, [dataset?.id]);

  const validPayload = useMemo(
    () =>
      rows
        .filter((r) => r.score && r.score >= 1 && r.score <= 5)
        .map((r) => ({ category: r.category, score: Number(r.score) })),
    [rows]
  );

  const saveAndScore = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('score_building_typology', {
        in_category_scores: JSON.stringify(validPayload),
        in_dataset_id: dataset.id,
        in_instance_id: instance.id,
        in_method: method,
        in_threshold: method === 'custom_percent' ? threshold : null,
      });
      if (error) throw error;
      await onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[720px] max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-semibold">{dataset?.name || 'Categorical Dataset'}</h2>
          <p className="text-sm text-gray-500 mt-1">Assign a score (1–5) to each category, then apply scoring.</p>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <div>
            <label className="block text-sm font-medium mb-1">Overall method</label>
            <div className="flex items-center gap-3">
              <select
                className="border rounded px-2 py-1"
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
              >
                <option value="weighted_mean">Weighted mean (Σ score×%)</option>
                <option value="twenty_percent">20% rule (≥ 20%)</option>
                <option value="custom_percent">Custom % rule</option>
                <option value="median">Median</option>
                <option value="mode">Most prevalent</option>
              </select>
              {method === 'custom_percent' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Threshold (0–1)</span>
                  <input
                    type="number"
                    className="w-24 border rounded px-2 py-1"
                    min={0}
                    max={1}
                    step={0.01}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border rounded">
            <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-semibold">
              <div className="col-span-9">Category</div>
              <div className="col-span-3 text-right">Score (1–5)</div>
            </div>
            <div className="divide-y">
              {rows.map((r, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center px-3 py-2">
                  <div className="col-span-9 truncate">{r.category}</div>
                  <div className="col-span-3 flex justify-end">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      value={r.score ?? ''}
                      className="w-24 border rounded px-2 py-1 text-right"
                      onChange={(e) => {
                        const next = [...rows];
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        next[idx] = { ...next[idx], score: val as any };
                        setRows(next);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>

        <div className="p-6 border-t flex items-center justify-end gap-3">
          <button className="px-4 py-2 rounded border" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
            onClick={saveAndScore}
            disabled={loading || validPayload.length === 0}
          >
            {loading ? 'Saving…' : 'Apply Scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}
