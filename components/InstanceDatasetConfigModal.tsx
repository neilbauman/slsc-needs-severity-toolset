'use client';

import React from 'react';

interface InstanceDatasetConfigModalProps {
  instance: any;
  onClose: () => void;
  onSaved?: () => void; // ✅ Added this optional prop
}

export default function InstanceDatasetConfigModal({
  instance,
  onClose,
  onSaved,
}: InstanceDatasetConfigModalProps) {
  const handleSave = async () => {
    // your save logic here (already implemented)
    if (onSaved) onSaved(); // ✅ triggers reload in parent
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Dataset Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 text-sm text-gray-700">
          <p className="text-gray-600 mb-3">
            Configure which datasets are included in instance:{' '}
            <strong>{instance?.name}</strong>
          </p>

          <div className="border border-gray-200 bg-gray-50 p-4 rounded-md text-xs text-gray-600">
            Placeholder: Dataset configuration UI goes here.
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md border text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
