'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface DeriveDatasetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}

export default function DeriveDatasetModal({
  open,
  onOpenChange,
  onCreated,
}: DeriveDatasetModalProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [datasetA, setDatasetA] = useState('');
  const [datasetB, setDatasetB] = useState('');
  const [method, setMethod] = useState('ratio');
  const [targetLevel, setTargetLevel] = useState('ADM3');
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  useEffect(() => {
    if (open) loadDatasets();
  }, [open]);

  const loadDatasets = async () => {
    try {
      setLoading(true);

      // Step 1: Get all cleaned datasets
      const { data: baseDatasets, error: baseError } = await supabase
        .from('datasets')
        .select('id, name, admin_level, is_cleaned, type')
        .eq('is_cleaned', true);

      if (baseError) throw baseError;

      // Step 2: Get all dataset IDs that have numeric/categorical values
      const { data: numericValues } = await supabase
        .from('dataset_values_numeric')
        .select('dataset_id');

      const { data: categoricalValues } = await supabase
        .from('dataset_values_categorical')
        .select('dataset_id');

      // Step 3: Combine and deduplicate dataset IDs
      const validIds = new Set([
        ...(numericValues?.map((v) => v.dataset_id) || []),
        ...(categoricalValues?.map((v) => v.dataset_id) || []),
      ]);

      // Step 4: Filter datasets with real values
      const filtered = baseDatasets.filter((d) => validIds.has(d.id));
      setDatasets(filtered);
    } catch (err: any) {
      console.error('Error loading datasets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setPreview([]);
    setError(null);
    setDatasetA('');
    setDatasetB('');
  };

  const handlePreview = async () => {
    if (!datasetA || !datasetB) {
      setError('Please select two cleaned datasets.');
      return;
    }

    setLoading(true);
    setError(null);
    setPreview([]);

    const { data, error } = await supabase.rpc('preview_derived_dataset_v2', {
      base_a: datasetA,
      base_b: datasetB,
      method,
      target_admin_level: targetLevel,
    });

    setLoading(false);

    if (error) {
      console.error(error);
      setError(error.message);
    } else {
      setPreview(data || []);
    }
  };

  const handleSave = async () => {
    if (!datasetA || !datasetB) {
      setError('Select datasets before saving.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc('save_derived_dataset_v2', {
      base_a: datasetA,
      base_b: datasetB,
      method,
      target_admin_level: targetLevel,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      setError(error.message);
    } else {
      await onCreated();
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-auto">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Derive New Dataset
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          This tool allows you to create a derived dataset by combining two
          cleaned datasets (e.g. ratio, difference, or sum). The result will be
          stored as a new dataset.
        </p>

        {/* Dataset selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <select
            value={datasetA}
            onChange={(e) => setDatasetA(e.target.value)}
            className="border p-2 rounded-md text-sm w-full"
          >
            <option value="">Select Dataset A</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.admin_level})
              </option>
            ))}
          </select>

          <select
            value={datasetB}
            onChange={(e) => setDatasetB(e.target.value)}
            className="border p-2 rounded-md text-sm w-full"
          >
            <option value="">Select Dataset B</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.admin_level})
              </option>
            ))}
          </select>
        </div>

        {/* Method + Target Level */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="border p-2 rounded-md text-sm w-full"
          >
            <option value="ratio">Ratio (A / B)</option>
            <option value="difference">Difference (A - B)</option>
            <option value="sum">Sum (A + B)</option>
            <option value="product">Product (A × B)</option>
          </select>

          <select
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value)}
            className="border p-2 rounded-md text-sm w-full"
          >
            <option value="ADM4">ADM4</option>
            <option value="ADM3">ADM3</option>
            <option value="ADM2">ADM2</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            {loading ? 'Previewing…' : 'Preview'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm"
          >
            {saving ? 'Saving…' : 'Save Derived Dataset'}
          </button>

          <button
            onClick={handleClose}
            className="ml-auto px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
          >
            Cancel
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-100 text-red-700 text-sm p-2 rounded mb-4">
            {error}
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="mt-4 border rounded-md overflow-auto max-h-[40vh]">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700 sticky top-0">
                <tr>
                  {Object.keys(preview[0]).map((col) => (
                    <th key={col} className="px-3 py-2">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-t">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-3 py-1 text-gray-800">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
