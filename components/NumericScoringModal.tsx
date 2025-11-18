'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function NumericScoringModal({ dataset, instance, onClose, onSaved }: any) {
  const [method, setMethod] = useState<'Normalization' | 'Thresholds'>('Normalization');
  const [scaleMax, setScaleMax] = useState(5);
  const [inverse, setInverse] = useState(false);
  const [scope, setScope] = useState<'affected' | 'national'>('affected');
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      const { data, error } = await supabase
        .from('instance_dataset_config')
        .select('score_config')
        .eq('instance_id', instance.id)
        .eq('dataset_id', dataset.id)
        .single();

      if (!error && data?.score_config) {
        const cfg = data.score_config;
        if (cfg.method) setMethod(cfg.method);
        if (cfg.scaleMax) setScaleMax(cfg.scaleMax);
        if (cfg.inverse !== undefined) setInverse(cfg.inverse);
        if (cfg.thresholds) setThresholds(cfg.thresholds);
        if (cfg.scope) setScope(cfg.scope);
      }
    };
    loadConfig();
  }, [instance.id, dataset.id]);

  const saveConfig = async () => {
    const config = { method, scaleMax, inverse, thresholds, scope };
    const { error } = await supabase
      .from('instance_dataset_config')
      .update({ score_config: config })
      .eq('instance_id', instance.id)
      .eq('dataset_id', dataset.id);
    if (error) setMessage(`❌ Error saving config: ${error.message}`);
    else setMessage('✅ Config saved');
  };

  const previewScores = async () => {
    setPreviewData(null);
    setMessage('Fetching preview...');
    let sql;
    if (method === 'Normalization') {
      sql = `
        SELECT MIN(value) as min_val, MAX(value) as max_val, COUNT(*) as n
        FROM dataset_values_numeric dv
        ${scope === 'affected' ? `JOIN v_instance_affected_adm3 a ON a.admin_pcode = dv.admin_pcode AND a.instance_id = '${instance.id}'` : ''}
        WHERE dv.dataset_id = '${dataset.id}';
      `;
    } else {
      sql = `
        SELECT COUNT(*) as n FROM dataset_values_numeric dv
        ${scope === 'affected' ? `JOIN v_instance_affected_adm3 a ON a.admin_pcode = dv.admin_pcode AND a.instance_id = '${instance.id}'` : ''}
        WHERE dv.dataset_id = '${dataset.id}';
      `;
    }
    const { data, error } = await supabase.rpc('run_sql', { sql_text: sql });
    if (error) {
      setMessage(`❌ Preview error: ${error.message}`);
    } else {
      setPreviewData(data?.[0]);
      setMessage('✅ Preview ready');
    }
  };

  const applyScoring = async () => {
    setSaving(true);
    setMessage('Running scoring...');
    let rpc;
    if (method === 'Normalization') {
      rpc = supabase.rpc('score_numeric_normalized', {
        in_instance_id: instance.id,
        in_dataset_id: dataset.id,
        in_scale_max: scaleMax,
        in_inverse: inverse,
        in_scope: scope,
      });
    } else {
      rpc = supabase.rpc('score_numeric_thresholds', {
        in_instance_id: instance.id,
        in_dataset_id: dataset.id,
        in_rules: thresholds,
        in_scope: scope,
      });
    }

    const { error } = await rpc;
    if (error) setMessage(`❌ Error running scoring: ${error.message}`);
    else setMessage('✅ Scoring applied successfully!');
    setSaving(false);
    if (onSaved) await onSaved();
  };

  const addRange = () => setThresholds([...thresholds, { min: 0, max: 0, score: 1 }]);
  const updateRange = (i: number, key: string, val: any) => {
    const copy = [...thresholds];
    copy[i][key] = val;
    setThresholds(copy);
  };
  const removeRange = (i: number) => setThresholds(thresholds.filter((_, x) => x !== i));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[700px] p-5">
        <h2 className="text-base font-semibold mb-1">{dataset.name}</h2>
        <p className="text-gray-500 mb-3">Define and preview scoring configuration.</p>

        {/* Scoring Config */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="border rounded w-full px-2 py-1 text-sm"
            >
              <option value="Normalization">Normalization</option>
              <option value="Thresholds">Thresholds</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="border rounded w-full px-2 py-1 text-sm"
            >
              <option value="affected">Affected Area</option>
              <option value="national">National</option>
            </select>
          </div>
        </div>

        {method === 'Normalization' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Scale (max score)</label>
              <select
                value={scaleMax}
                onChange={(e) => setScaleMax(Number(e.target.value))}
                className="border rounded w-full px-2 py-1 text-sm"
              >
                {[3, 4, 5, 10].map((v) => (
                  <option key={v} value={v}>
                    1–{v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center mt-5">
              <input
                type="checkbox"
                checked={inverse}
                onChange={(e) => setInverse(e.target.checked)}
                className="mr-2"
              />
              <span className="text-xs">Higher values mean higher risk</span>
            </div>
          </div>
        )}

        {method === 'Thresholds' && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium">Threshold Ranges</span>
              <button
                onClick={addRange}
                className="text-xs border px-2 py-1 rounded hover:bg-gray-100"
              >
                + Add Range
              </button>
            </div>
            <table className="w-full text-xs border mt-1">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-1 text-left">Min</th>
                  <th className="p-1 text-left">Max</th>
                  <th className="p-1 text-left">Score</th>
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
                        className="w-full border rounded px-1 py-0.5"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={t.max}
                        onChange={(e) => updateRange(i, 'max', Number(e.target.value))}
                        className="w-full border rounded px-1 py-0.5"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={t.score}
                        onChange={(e) => updateRange(i, 'score', Number(e.target.value))}
                        className="w-full border rounded px-1 py-0.5"
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

        {/* Preview */}
        {previewData && (
          <div className="mt-4 bg-gray-50 border rounded p-2 text-xs">
            <p><strong>ADM3 Count:</strong> {previewData.n}</p>
            {previewData.min_val && <p><strong>Min:</strong> {previewData.min_val}</p>}
            {previewData.max_val && <p><strong>Max:</strong> {previewData.max_val}</p>}
          </div>
        )}

        {message && (
          <p className={`mt-2 text-xs ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={saveConfig} className="px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100">
            Save Config
          </button>
          <button onClick={previewScores} className="px-3 py-1 border rounded bg-yellow-100 hover:bg-yellow-200">
            Preview
          </button>
          <button
            onClick={applyScoring}
            disabled={saving}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Applying…' : 'Apply Scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}
