'use client';

import React from 'react';

interface InstanceCategoryConfigModalProps {
  instance: any;
  onClose: () => void;
}

export default function InstanceCategoryConfigModal({
  instance,
  onClose,
}: InstanceCategoryConfigModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Category Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 text-sm text-gray-700">
          <p className="mb-2">
            Configure category-level weighting or aggregation settings for this instance.
          </p>
          <p className="text-gray-500">
            Instance: <span className="font-medium">{instance?.name || '—'}</span>
          </p>

          <div className="mt-4 p-3 bg-gray-50 border rounded-md text-gray-600 text-xs">
            This section is under development — category scoring configuration will be available soon.
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
