'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DeriveDatasetModal({
  onClose,
  onDerived,
}: {
  onClose: () => void;
  onDerived: () => void;
}) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [dataset1, setDataset1] = useState('');
  const [dataset2, setDataset2] = useState('');
  const [operation, setOperation] = useState('divide');
  const [scalarValue, setScalarValue] = useState('');
  const [newName, setNewName] = useState('');
  const [category, setCategory] = useState('');
  const [targetAdminLevel, setTargetAdminLevel] = useState('ADM3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categoryOptions = [
    'Core',
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Underlying Vulnerability',
    'Derived',
  ];

  useEffect(() => {
    async function loadDatasets() {
      const { data, error } = await supabase
        .from('datasets')
        .select('id, name, type, category, admin_level')
        .order('name');
      if (!error && data) setDatasets(data);
    }
    loadDatasets();
  }, []);

  const handleDerive = async () => {
    if (!dataset1 || !newName || !category) {
      setError('Please complete all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sources = dataset2 ? [dataset1, dataset2] : [dataset1];
      const { error } = await supabase.rpc('derive_dataset', {
        source_datasets: sources,
        new_name: newName,
        operation,
        scalar_value: scalarValue ? parseFloat(scalarValue) : null,
        new_category: category,
        target_admin_level: targetAdminLevel,
      });

      if (error) throw error;
      onDerived();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error deriving dataset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-5 rounded-lg shadow-lg w-full max-w-md max-h-[80vh] overflow-y-auto text-sm">
        <h2 className="text-base font-semibold mb-3">Create Derived Dataset</h2>

        {error && <p className="text-red-600 mb-2">{error}</p>}

        {/* Source Dataset 1 */}
        <label className="block font-medium mb-1">Source Dataset 1 *</label>
        <select
          className="w-full border rounded p-1.5 mb-2 text-sm"
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
          className="w-full border rounded p-1.5 mb-2 text-sm"
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
        >
          <option value="divide">Divide (Dataset1 / Dataset2)</option>
          <option value="multiply">Multiply</option>
          <option value="add">Add</option>
          <option value="subtract">Subtract</option>
          <option value="scalar">Scalar (Dataset1 ÷ value)</option>
        </select>

        {/* Source Dataset 2 */}
        {operation !== 'scalar' && (
          <>
            <label className="block font-medium mb-1">Source Dataset 2 *</label>
            <select
              className="w-full border rounded p-1.5 mb-2 text-sm"
              value={dataset2}
              onChange={(e) => setDataset2(e.target.value)}
              disabled={operation === 'scalar'}
            >
              <option value="">Select dataset</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type})
                </option>
              ))}
            </select>
          </>
        )}

        {/* Scalar value */}
        {operation === 'scalar' && (
          <>
            <label className="block font-medium mb-1">Scalar Value *</label>
            <input
              type="number"
              step="any"
              className="w-full border rounded p-1.5 mb-2 text-sm"
              placeholder="e.g. 4.8"
              value={scalarValue}
              onChange={(e) => setScalarValue(e.target.value)}
            />
          </>
        )}

        {/* New dataset name */}
        <label className="block font-medium mb-1">New Dataset Name *</label>
        <input
          type="text"
          className="w-full border rounded p-1.5 mb-2 text-sm"
          placeholder="e.g. Population Density"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        {/* Category */}
        <label className="block font-medium mb-1">Category *</label>
        <select
          className="w-full border rounded p-1.5 mb-2 text-sm"
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
          className="w-full border rounded p-1.5 mb-3 text-sm"
          value={targetAdminLevel}
          onChange={(e) => setTargetAdminLevel(e.target.value)}
        >
          <option value="ADM1">ADM1</option>
          <option value="ADM2">ADM2</option>
          <option value="ADM3">ADM3</option>
          <option value="ADM4">ADM4</option>
        </select>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            className="px-3 py-1.5 bg-gray-200 rounded text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            onClick={handleDerive}
            disabled={loading || !dataset1 || !newName}
            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Materialize Dataset'}
          </button>
        </div>
      </div>
    </div>
  );
}
