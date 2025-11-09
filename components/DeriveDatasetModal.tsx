'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DeriveDatasetModal({ onClose, onDerived }: { onClose: () => void; onDerived: () => void }) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [dataset1, setDataset1] = useState('');
  const [dataset2, setDataset2] = useState('');
  const [operation, setOperation] = useState('divide');
  const [scalarValue, setScalarValue] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Derived');
  const [targetAdminLevel, setTargetAdminLevel] = useState('ADM3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setLoading(true);
    setError('');

    try {
      const sources = dataset2 ? [dataset1, dataset2] : [dataset1];
      const { data, error } = await supabase.rpc('derive_dataset', {
        source_datasets: sources,
        new_name: newName,
        operation,
        scalar_value: scalarValue ? parseFloat(scalarValue) : null,
        new_category: newCategory,
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
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Create Derived Dataset</h2>

        {error && <p className="text-red-600 mb-2">{error}</p>}

        <label className="block text-sm font-medium mb-1">Source Dataset 1</label>
        <select
          className="w-full border p-2 rounded mb-3"
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

        <label className="block text-sm font-medium mb-1">Operation</label>
        <select
          className="w-full border p-2 rounded mb-3"
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
        >
          <option value="divide">Divide (Dataset1 / Dataset2)</option>
          <option value="multiply">Multiply</option>
          <option value="add">Add</option>
          <option value="subtract">Subtract</option>
          <option value="scalar">Scalar (Dataset1 / value)</option>
        </select>

        {operation !== 'scalar' && (
          <>
            <label className="block text-sm font-medium mb-1">Source Dataset 2</label>
            <select
              className="w-full border p-2 rounded mb-3"
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

        {operation === 'scalar' && (
          <>
            <label className="block text-sm font-medium mb-1">Scalar Value</label>
            <input
              type="number"
              className="w-full border p-2 rounded mb-3"
              placeholder="e.g. 4.8"
              value={scalarValue}
              onChange={(e) => setScalarValue(e.target.value)}
            />
          </>
        )}

        <label className="block text-sm font-medium mb-1">New Dataset Name</label>
        <input
          type="text"
          className="w-full border p-2 rounded mb-3"
          placeholder="e.g. Population Density"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <label className="block text-sm font-medium mb-1">Category</label>
        <input
          type="text"
          className="w-full border p-2 rounded mb-3"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />

        <label className="block text-sm font-medium mb-1">Target Admin Level</label>
        <select
          className="w-full border p-2 rounded mb-4"
          value={targetAdminLevel}
          onChange={(e) => setTargetAdminLevel(e.target.value)}
        >
          <option value="ADM1">ADM1</option>
          <option value="ADM2">ADM2</option>
          <option value="ADM3">ADM3</option>
          <option value="ADM4">ADM4</option>
        </select>

        <div className="flex justify-end gap-3 mt-4">
          <button className="px-4 py-2 bg-gray-200 rounded" onClick={onClose}>
            Cancel
          </button>
          <button
            onClick={handleDerive}
            disabled={loading || !dataset1 || !newName}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Materialize Dataset'}
          </button>
        </div>
      </div>
    </div>
  );
}
