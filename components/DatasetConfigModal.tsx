'use client';

import { useState } from 'react';
import NumericScoringModal from './NumericScoringModal';
import CategoricalScoringModal from './CategoricalScoringModal';

interface DatasetConfigModalProps {
  dataset: any;
  instanceId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function DatasetConfigModal({
  dataset,
  instanceId,
  onClose,
  onSaved,
}: DatasetConfigModalProps) {
  const [showNumeric, setShowNumeric] = useState(false);
  const [showCategorical, setShowCategorical] = useState(false);

  // Automatically choose modal type
  const handleConfigure = () => {
    if (!dataset?.type) return;
    if (dataset.type === 'categorical') setShowCategorical(true);
    else setShowNumeric(true);
  };

  return (
    <>
      {/* Main dataset config starter modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Configure Dataset Scoring
          </h2>
          <p className="text-sm text-gray-600 mb-5">
            Choose how to score and normalize the selected dataset.
          </p>

          <div className="border rounded-md p-3 text-sm bg-gray-50 mb-5">
            <p>
              <span className="font-medium text-gray-700">Name:</span>{' '}
              {dataset.name}
            </p>
            <p>
              <span className="font-medium text-gray-700">Type:</span>{' '}
              {dataset.type}
            </p>
            <p>
              <span className="font-medium text-gray-700">Category:</span>{' '}
              {dataset.category || '—'}
            </p>
            <p>
              <span className="font-medium text-gray-700">Admin Level:</span>{' '}
              {dataset.admin_level || '—'}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-700 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfigure}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Conditional scoring modals */}
      {showNumeric && (
        <NumericScoringModal
          dataset={dataset}
          instanceId={instanceId}
          onClose={() => {
            setShowNumeric(false);
            onClose();
          }}
          onSaved={onSaved}
        />
      )}

      {showCategorical && (
        <CategoricalScoringModal
          dataset={dataset}
          instanceId={instanceId}
          onClose={() => {
            setShowCategorical(false);
            onClose();
          }}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
