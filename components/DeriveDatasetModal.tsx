'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DeriveDatasetModal({ onClose, onDerived }: { onClose: () => void; onDerived: () => void; }) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [dataset1, setDataset1] = useState('');
  const [dataset2, setDataset2] = useState('');
  const [operation, setOperation] = useState('divide');
  const [scalarValue, setScalarValue] = useState('');
  const [newName, setNewName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [aggregation, setAggregation] = useState('');
  const [targetAdminLevel, setTargetAdminLevel] = useState('ADM3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categoryOptions = [
    'Core',
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Underlying Vulnerabilities',
    'Derived',
  ];

  const aggregationOptions = [
    '',
    'Sum',
    'Average',
    'Minimum',
    'Maximum',
    'Weighted Average',
    'Proportional Distribution',
  ];

  // Load datasets
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('datasets')
        .select('id, name, type, category, admin_level')
        .order('name');
      if (!error && data) setDatasets(data);
    }
    load();
  }, []);

  // Auto-inherit category from dataset1
  useEffect(() => {
    if (dataset1 && datasets.length > 0) {
      const d1 = datasets.find((d) => d.id === dataset1);
      if (d1?.category) setCategory(d1.category);
    }
  }, [dataset1, datasets]);

  const handleDerive = async () => {
    if (!dataset1 || !newName) {
      setError('Please complete all required fields.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Force all six RPC parameters (no undefineds)
      const payload = {
        source_datasets: dataset2 ? [dataset1, dataset2] : [dataset1],
        new_name: newName,
        operation: operation || 'divide',
        scalar_value: scalarValue ? parseFloat(scalarValue) : 0,
        new_category: category || 'Derived',
        target_admin_level: targetAdminLevel || 'ADM3',
      };

      console.log('RPC Payload:', payload);
      const { error } = await supabase.rpc('derive_dataset', payload);

      if (error) throw error;

      onDerived();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error creating derived dataset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-5 rounded-lg shadow-lg w-full max-w-md text-sm">
        <h2 className="text-base font-semibold mb-3">Create Derived Dataset</h2>
        {error && <p className="text-red-600 mb-2">{error}</p>}

        {/* Dataset 1 */}
        <label className="block font-medium mb-1">Source Dataset 1 *</label>
        <select
          className="w-full border rounded p-1.5 mb-2"
          value={dataset1}
          onChange={(e) => setDataset1(e.target.value)}
        >
          <option value="">Select dataset</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.type})
            </option>
          ))}
        </select>

        {/* Operation */}
        <label className="block font-medium mb-1">Operation *</label>
        <select
          className="w-full border rounded p-1.5 mb-2"
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
        >
          <option value="divide">Divide (Dataset1 / Dataset2)</option>
          <option value="multiply">Multiply (Dataset1 × Dataset2)</option>
          <option value="add">Add (Dataset1 + Dataset2)</option>
          <option value="subtract">Subtract (Dataset1 − Dataset2)</option>
          <option value="scalar">Scalar (Dataset1 ÷ Value)</option>
        </select>

        {/* Dataset 2 or Scalar */}
        {operation === 'scalar' ? (
          <>
            <label className="block font-medium mb-1">Scalar Value *</label>
            <input
              type="number"
              step="any"
              className="w-full border rounded p-1.5 mb-2"
              placeholder="e.g. 4.8"
              value={scalarValue}
              onChange={(e) => setScalarValue(e.target.value)}
            />
          </>
        ) : (
          <>
            <label className="block font-medium mb-1">Source Dataset 2 *</label>
            <select
              className="w-full border rounded p-1.5 mb-2"
              value={dataset2}
              onChange={(e) => setDataset2(e.target.value)}
            >
              <option value="">Select dataset</option>
              {datasets.filter((d) => d.id !== dataset1).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type})
                </option>
              ))}
            </select>
          </>
        )}

        {/* New dataset name */}
        <label className="block font-medium mb-1">New Dataset Name *</label>
        <input
          type="text"
          className="w-full border rounded p-1.5 mb-2"
          placeholder="e.g. Population Density"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        {/* Description */}
        <label className="block font-medium mb-1">Description</label>
        <textarea
          className="w-full border rounded p-1.5 mb-2"
          rows={2}
          placeholder="Optional: describe how this dataset was derived"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Aggregation/Disaggregation */}
        <label className="block font-medium mb-1">Aggregation/Disaggregation Method</label>
        <select
          className="w-full border rounded p-1.5 mb-2"
          value={aggregation}
          onChange={(e) => setAggregation(e.target.value)}
        >
          {aggregationOptions.map((a) => (
            <option key={a} value={a}>
              {a || 'Select method'}
            </option>
          ))}
        </select>

        {/* Category */}
        <label className="block font-medium mb-1">Category *</label>
        <select
          className="w-full border rounded p-1.5 mb-2"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Select category</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Target Admin Level */}
        <label className="block font-medium mb-1">Target Admin Level *</label>
        <select
          className="w-full border rounded p-1.5 mb-3"
          value={targetAdminLevel}
          onChange={(e) => setTargetAdminLevel(e.target.value)}
        >
          <option value="ADM1">ADM1</option>
          <option value="ADM2">ADM2</option>
          <option value="ADM3">ADM3</option>
          <option value="ADM4">ADM4</option>
        </select>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-200 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleDerive}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Materialize Dataset'}
          </button>
        </div>
      </div>
    </div>
  );
}
