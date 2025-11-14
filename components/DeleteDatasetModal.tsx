'use client';

import { supabase } from '@/lib/supabaseClient';

export default function DeleteDatasetModal({ datasetId, onClose, onDeleted }: any) {
  const handleDelete = async () => {
    const { error } = await supabase.from('datasets').delete().eq('id', datasetId);
    if (!error) {
      onDeleted();
      onClose();
    } else {
      console.error('Error deleting dataset:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 shadow-lg max-w-sm w-full">
        <h2 className="text-lg font-semibold mb-2">Delete Dataset</h2>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this dataset? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded text-sm font-medium bg-[var(--ssc-red)] hover:bg-red-600 text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
