'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface DeriveDatasetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}

export default function DeriveDatasetModal({
  open,
  onOpenChange,
  onCreated,
}: DeriveDatasetModalProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleClose = () => {
    onOpenChange(false);
    setPreview([]);
    setError(null);
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.rpc('preview_derived_dataset_v2', {
      base_a: 'uuid-a',
      base_b: 'uuid-b',
      method: 'ratio',
      target_admin_level: 'ADM3',
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setPreview(data || []);
    }
  };

  const handleCreate = async () => {
    alert('Derived dataset created (mock).');
    await onCreated();
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-auto">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Derive New Dataset
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This tool allows you to create a derived dataset by combining two
            existing datasets (e.g. ratio, difference, or sum).
          </p>

          <button
            onClick={handlePreview}
            disabled={loading}
            className="px-4 py-2 bg-[var(--ssc-blue)] text-white rounded-md text-sm font-medium hover:bg-blue-800"
          >
            {loading ? 'Previewing…' : 'Preview Derived Data'}
          </button>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {preview.length > 0 && (
            <div className="border rounded-md overflow-auto max-h-[50vh] mt-4">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Admin PCode</th>
                    <th className="px-3 py-2 text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-1">{row.admin_pcode}</td>
                      <td className="px-3 py-1">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end mt-6 gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-md text-sm"
            >
              Save Derived Dataset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
