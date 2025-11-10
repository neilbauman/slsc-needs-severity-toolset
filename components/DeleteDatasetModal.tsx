'use client';

import React from 'react';
import { supabase } from '@/lib/supabaseClient';

interface DeleteDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}

export default function DeleteDatasetModal({ dataset, onClose, onDeleted }: DeleteDatasetModalProps) {
  const handleDelete = async () => {
    await supabase.from('datasets').delete().eq('id', dataset.id);
    await onDeleted();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-md w-full max-w-sm p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Delete Dataset</h2>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{dataset.name}</strong>?
        </p>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-3 py-1 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1 bg-red-600 text-white rounded-md text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
