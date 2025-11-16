'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DeriveDatasetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
}

export default function DeriveDatasetModal({
  open,
  onOpenChange,
  onSaved,
}: DeriveDatasetModalProps) {
  const [loading, setLoading] = useState(false);
  const [baseA, setBaseA] = useState('');
  const [baseB, setBaseB] = useState('');
  const [method, setMethod] = useState('ratio');
  const [targetAdminLevel, setTargetAdminLevel] = useState('ADM3');
  const [preview, setPreview] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);

  React.useEffect(() => {
    if (open) loadDatasets();
  }, [open]);

  const loadDatasets = async () => {
    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, admin_level, is_cleaned')
      .eq('is_cleaned', true);
    if (!error && data) setDatasets(data);
  };

  const handlePreview = async () => {
    if (!baseA || !baseB) return alert('Select both datasets.');
    setLoading(true);
    const { data, error } = await supabase.rpc('preview_derived_dataset_v3', {
      base_a: baseA,
      base_b: baseB,
      method,
      target_admin_level: targetAdminLevel,
    });
    setLoading(false);
    if (error) {
      console.error(error);
      alert(`Error: ${error.message}`);
      return;
    }
    setPreview(data.filter((r: any) => r.admin_pcode !== null));
    const summaryRow = data.find((r: any) => r.admin_name === 'SUMMARY');
    setSummary(summaryRow ? summaryRow.summary : null);
  };

  const handleMaterialize = async () => {
    if (!baseA || !baseB) return alert('Select both datasets.');
    setLoading(true);
    const { data, error } = await supabase.rpc('materialize_derived_dataset_v3', {
      base_a: baseA,
      base_b: baseB,
      method,
      target_admin_level: targetAdminLevel,
      new_name: `Derived ${method.toUpperCase()} ${Date.now()}`,
      new_description: `Auto-generated derived dataset using ${method}`,
    });
    setLoading(false);
    if (error) {
      console.error(error);
      alert(`Error: ${error.message}`);
      return;
    }
    onOpenChange(false);
    await onSaved();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[850px] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Create Derived Dataset</h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Dataset A</label>
            <select
              value={baseA}
              onChange={(e) => setBaseA(e.target.value)}
              className="w-full border rounded p-2"
            >
              <option value="">Select Dataset</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.admin_level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Dataset B</label>
            <select
              value={baseB}
              onChange={(e) => setBaseB(e.target.value)}
              className="w-full border rounded p-2"
            >
              <option value="">Select Dataset</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.admin_level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full border rounded p-2"
            >
              <option value="ratio">Ratio (A / B)</option>
              <option value="difference">Difference (A - B)</option>
              <option value="sum">Sum (A + B)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Target Admin Level</label>
            <select
              value={targetAdminLevel}
              onChange={(e) => setTargetAdminLevel(e.target.value)}
              className="w-full border rounded p-2"
            >
              <option value="ADM2">ADM2</option>
              <option value="ADM3">ADM3</option>
              <option value="ADM4">ADM4</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Previewing…' : 'Preview'}
          </button>

          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>

        {preview.length > 0 && (
          <>
            <h3 className="text-lg font-semibold mb-2">Preview (first 50 rows)</h3>
            <table className="w-full border text-xs mb-4">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-1">Pcode</th>
                  <th className="border px-2 py-1">Name</th>
                  <th className="border px-2 py-1">Value</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.admin_pcode}>
                    <td className="border px-2 py-1">{r.admin_pcode}</td>
                    <td className="border px-2 py-1">{r.admin_name}</td>
                    <td className="border px-2 py-1">{r.result_value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {summary && (
              <div className="text-sm bg-gray-50 p-2 rounded border mb-4">
                <strong>Summary:</strong>{' '}
                min={summary.min}, max={summary.max}, avg={summary.avg}, count={summary.count}, match%={summary.match_percentage}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleMaterialize}
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                {loading ? 'Saving…' : 'Materialize Dataset'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
