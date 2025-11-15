'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X } from 'lucide-react';

interface DerivedDatasetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
  baseDatasetA: string;
  baseDatasetB: string;
  method: string; // e.g. "ratio" or "aggregate"
  name: string;
  targetAdminLevel: string;
}

export default function DerivedDatasetModal({
  open,
  onOpenChange,
  onCreated,
  baseDatasetA,
  baseDatasetB,
  method,
  name,
  targetAdminLevel,
}: DerivedDatasetModalProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) loadPreview();
  }, [open]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    setPreview([]);

    const { data, error } = await supabase.rpc('preview_derived_dataset_v2', {
      base_a: baseDatasetA,
      base_b: baseDatasetB,
      method,
      target_admin_level: targetAdminLevel,
    });

    if (error) {
      console.error(error);
      setError(error.message);
    } else {
      setPreview(data || []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.rpc('apply_derived_dataset_v2', {
      base_a: baseDatasetA,
      base_b: baseDatasetB,
      method,
      target_admin_level: targetAdminLevel,
      name,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await onCreated();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 relative">
        {/* Close Button */}
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          onClick={() => onOpenChange(false)}
        >
          <X size={20} />
        </button>

        <h2 className="text-lg font-semibold mb-1">Derived Dataset Preview</h2>
        <p className="text-gray-600 text-sm mb-4">
          {name} (Method: {method}, Target: {targetAdminLevel})
        </p>

        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-600">
            <Loader2 className="animate-spin mr-2" /> Generating preview…
          </div>
        ) : error ? (
          <div className="text-red-600 bg-red-50 p-3 rounded border border-red-200 text-sm">
            {error}
          </div>
        ) : preview.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">
            No preview data found.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-md mb-4">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Admin PCode</th>
                  <th className="px-3 py-2 text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">{row.admin_pcode}</td>
                    <td className="px-3 py-2">{Number(row.value).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-[var(--ssc-blue)] hover:bg-blue-800 text-white rounded-md text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Apply & Save Derived Dataset'}
          </button>
        </div>
      </div>
    </div>
  );
}
