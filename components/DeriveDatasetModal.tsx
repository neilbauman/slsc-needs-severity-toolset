'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface DeriveDatasetModalProps {
  datasets: any[];
  onClose: () => void;
  onDerived: () => Promise<void>;
}

export default function DeriveDatasetModal({ datasets, onClose, onDerived }: DeriveDatasetModalProps) {
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [operation, setOperation] = useState('divide');
  const [scalarValue, setScalarValue] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('SSC Framework - P3');
  const [newDescription, setNewDescription] = useState('');
  const [targetLevel, setTargetLevel] = useState('ADM3');

  const handleDerive = async () => {
    const { error } = await supabase.rpc('derive_dataset', {
      source_datasets: sourceIds,
      new_name: newName,
      operation,
      scalar_value: scalarValue ? parseFloat(scalarValue) : null,
      new_category: newCategory,
      new_description: newDescription,
      target_admin_level: targetLevel,
    });

    if (error) console.error(error);
    else await onDerived();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-md w-full max-w-md p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Derive New Dataset</h2>

        <label className="block text-sm mb-2">
          Source Datasets
          <select
            multiple
            className="w-full border rounded-md px-2 py-1 mt-1 text-sm"
            onChange={e =>
              setSourceIds(Array.from(e.target.selectedOptions, opt => opt.value))
            }
          >
            {datasets.map(ds => (
              <option key={ds.id} value={ds.id}>
                {ds.name} ({ds.admin_level})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm mb-2">
          Operation
          <select
            className="w-full border rounded-md px-2 py-1 mt-1 text-sm"
            value={operation}
            onChange={e => setOperation(e.target.value)}
          >
            <option value="divide">Divide (A ÷ B)</option>
            <option value="multiply">Multiply (A × B)</option>
            <option value="add">Add (A + B)</option>
            <option value="subtract">Subtract (A - B)</option>
            <option value="scalar">Multiply/Divide by Scalar</option>
          </select>
        </label>

        {operation === 'scalar' && (
          <label className="block text-sm mb-2">
            Scalar Value
            <input
              className="w-full border rounded-md px-2 py-1 mt-1 text-sm"
              value={scalarValue}
              onChange={e => setScalarValue(e.target.value)}
            />
          </label>
        )}

        <label className="block text-sm mb-2">
          New Dataset Name
          <input
            className="w-full border rounded-md px-2 py-1 mt-1 text-sm"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
        </label>

        <label className="block text-sm mb-2">
          Category
          <select
            className="w-full border rounded-md px-2 py-1 mt-1 text-sm"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
          >
            <option>Core</option>
            <option>SSC Framework - P1</option>
            <option>SSC Framework - P2</option>
            <option>SSC Framework - P3</option>
            <option>Hazards</option>
            <option>Underlying Vulnerabilities</option>
          </select>
        </label>

        <label className="block text-sm mb-2">
          Target Admin Level
          <select
            className="w-full border rounded-md px-2 py-1 mt-1 text-sm"
            value={targetLevel}
            onChange={e => setTargetLevel(e.target.value)}
          >
            <option>ADM1</option>
            <option>ADM2</option>
            <option>ADM3</option>
            <option>ADM4</option>
          </select>
        </label>

        <label className="block text-sm mb-3">
          Description
          <textarea
            className="w-full border rounded-md px-2 py-1 mt-1 text-sm"
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
          />
        </label>

        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-3 py-1 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={handleDerive}
            className="px-3 py-1 bg-green-600 text-white rounded-md text-sm"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
