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
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  // Load available datasets
  useEffect(() => {
    if (open) {
      loadDatasets();
    }
  }, [open]);

  const loadDatasets = async () => {
    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, type, admin_level, is_cleaned')
      .eq('is_cleaned', true)
      .order('name', { ascending: true });
    if (!error) setDatasets(data || []);
  };

  const handleClose = () => {
    onOpenChange(false);
    setPreview([]);
    setError(null);
  };

  const handlePreview = async () => {
    if (!datasetA || !datasetB) {
      setError('Please select two datasets to combine.');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('preview_derived_dataset_v2', {
      base_a: datasetA,
      base_b: datasetB,
      method,
      target_admin_level: targetLevel,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setPreview(data || []);
    }
  };

  const handleSave = async () => {
    alert('Saving derived dataset (mock)...');
    await onCreated();
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-auto">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Derive New Dataset
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Combine two cleaned datasets using a mathematical relationship
            (e.g. ratio, difference, or sum) to create a derived dataset.
          </p>

          {/* Dataset selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dataset A
              </label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={datasetA}
                onChange={(e) => setDatasetA(e.target.value)}
              >
                <option value="">Select dataset A</option>
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.admin_level})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dataset B
              </label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={datasetB}
                onChange={(e) => setDatasetB(e.target.value)}
              >
                <option value="">Select dataset B</option>
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.admin_level})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Method + target */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Derivation Method
              </label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="ratio">Ratio (A / B)</option>
                <option value="difference">Difference (A - B)</option>
                <option value="sum">Sum (A + B)</option>
                <option value="product">Product (A × B)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Admin Level
              </label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value)}
              >
                <option value="ADM3">ADM3</option>
                <option value="ADM4">ADM4</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="px-4 py-2 bg-[var(--ssc-blue)] text-white rounded-md text-sm font-medium hover:bg-blue-800"
            >
              {loading ? 'Previewing…' : 'Preview Derived Data'}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-md text-sm"
            >
              Save Derived Dataset
            </button>
            <button
              onClick={handleClose}
              className="ml-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>

          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="border rounded-md overflow-auto max-h-[50vh] mt-4">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Admin PCode</th>
                    <th className="px-3 py-2 text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-1">{row.admin_pcode}</td>
                      <td className="px-3 py-1">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
