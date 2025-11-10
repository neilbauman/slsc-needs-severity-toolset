'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface DeriveDatasetModalProps {
  datasets: any[];
  onClose: () => void;
  onDerived: () => Promise<void>;
}

export default function DeriveDatasetModal({
  datasets,
  onClose,
  onDerived,
}: DeriveDatasetModalProps) {
  const [sourceA, setSourceA] = useState<string>('');
  const [sourceB, setSourceB] = useState<string>('');
  const [operation, setOperation] = useState<string>('divide');
  const [targetAdminLevel, setTargetAdminLevel] = useState<string>('ADM3');
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('SSC Framework - P3');
  const [newDescription, setNewDescription] = useState<string>('');
  const [scalarValue, setScalarValue] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const numericDatasets = datasets.filter((d) => d.type === 'numeric');

  const handleDerive = async () => {
    if (!sourceA || !operation || !newName) {
      alert('Missing required fields.');
      return;
    }

    setLoading(true);
    try {
      const selected = [sourceA, sourceB].filter(Boolean);

      const { error } = await supabase.rpc('derive_dataset', {
        source_datasets: selected,
        new_name: newName,
        operation,
        scalar_value: scalarValue,
        new_category: newCategory,
        new_description: newDescription,
        target_admin_level: targetAdminLevel,
      });

      if (error) throw error;

      await onDerived();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const aggregationOps = [
    { key: 'sum', label: 'Aggregate Up (Sum)' },
    { key: 'average', label: 'Aggregate Up (Average)' },
  ];

  const disaggregationOps = [
    { key: 'disaggregate_population', label: 'Disaggregate (by Population)' },
    { key: 'disaggregate_area', label: 'Disaggregate (by Area)' },
  ];

  const arithmeticOps = [
    { key: 'divide', label: 'Divide (A ÷ B)' },
    { key: 'multiply', label: 'Multiply (A × B)' },
    { key: 'add', label: 'Add (A + B)' },
    { key: 'subtract', label: 'Subtract (A − B)' },
    { key: 'divide_scalar', label: 'Divide by Constant' },
    { key: 'multiply_scalar', label: 'Multiply by Constant' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Derive New Dataset</h2>

        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-gray-700 mb-1">Dataset A (required)</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={sourceA}
              onChange={(e) => setSourceA(e.target.value)}
            >
              <option value="">Select Dataset...</option>
              {numericDatasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.admin_level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Dataset B (optional)</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={sourceB}
              onChange={(e) => setSourceB(e.target.value)}
            >
              <option value="">None</option>
              {numericDatasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.admin_level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Operation</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
            >
              <optgroup label="Aggregation (up)">
                {aggregationOps.map((op) => (
                  <option key={op.key} value={op.key}>
                    {op.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Disaggregation (down)">
                {disaggregationOps.map((op) => (
                  <option key={op.key} value={op.key}>
                    {op.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Arithmetic">
                {arithmeticOps.map((op) => (
                  <option key={op.key} value={op.key}>
                    {op.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {(operation === 'divide_scalar' || operation === 'multiply_scalar') && (
            <div>
              <label className="block text-gray-700 mb-1">Constant Value</label>
              <input
                type="number"
                className="w-full border rounded-md px-3 py-2"
                value={scalarValue}
                onChange={(e) => setScalarValue(parseFloat(e.target.value))}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 mb-1">Target Admin Level</label>
              <select
                className="w-full border rounded-md px-3 py-2"
                value={targetAdminLevel}
                onChange={(e) => setTargetAdminLevel(e.target.value)}
              >
                <option value="ADM1">ADM1</option>
                <option value="ADM2">ADM2</option>
                <option value="ADM3">ADM3</option>
                <option value="ADM4">ADM4</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 mb-1">New Category</label>
              <select
                className="w-full border rounded-md px-3 py-2"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                <option value="Core">Core</option>
                <option value="SSC Framework - P1">SSC Framework - P1</option>
                <option value="SSC Framework - P2">SSC Framework - P2</option>
                <option value="SSC Framework - P3">SSC Framework - P3</option>
                <option value="Hazards">Hazards</option>
                <option value="Underlying Vulnerabilities">Underlying Vulnerabilities</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 mb-1">New Dataset Name</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Description (optional)</label>
            <textarea
              className="w-full border rounded-md px-3 py-2"
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>

          <button
            onClick={handleDerive}
            disabled={loading}
            className="w-full bg-green-600 text-white rounded-md py-2 mt-3 hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Create Derived Dataset'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="text-sm text-gray-600 hover:text-gray-900 mt-3 block mx-auto"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
