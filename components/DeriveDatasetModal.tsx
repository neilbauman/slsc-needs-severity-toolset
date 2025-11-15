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

  useEffect(() => {
    if (open) loadDatasets();
  }, [open]);

  const loadDatasets = async () => {
    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, admin_level, is_cleaned')
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
      setError('Please select two datasets.');
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
    if (error) setError(error.message);
    else setPreview(data || []);
  };

  const handleSave = async () => {
    alert('Saving derived dataset (placeholder)');
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
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Combine two cleaned datasets using a mathematical operation (ratio, difference, sum, etc.).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <select
            value={datasetA}
            onChange={(e) => setDatasetA(e.target.value)}
            className="border p-2 rounded-md text-sm"
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
            className="border p-2 rounded-md text-sm"
          >
            <option value="">Select Dataset B</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.admin_level})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="border p-2 rounded-md text-sm"
          >
            <option value="ratio">Ratio (A / B)</option>
            <option value="difference">Difference (A - B)</option>
            <option value="sum">Sum (A + B)</option>
            <option value="product">Product (A × B)</option>
          </select>

          <select
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value)}
            className="border p-2 rounded-md text-sm"
          >
            <option value="ADM3">ADM3</option>
            <option value="ADM4">ADM4</option>
          </select>
        </div>

        <div className="flex gap-3 mb-3">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            {loading ? 'Previewing…' : 'Preview'}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm"
          >
            Save Derived Dataset
          </button>
          <button
            onClick={handleClose}
            className="ml-auto px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm"
          >
           
