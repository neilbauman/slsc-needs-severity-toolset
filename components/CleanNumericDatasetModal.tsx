'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface CleanDatasetModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  onClose,
  onSaved,
}: CleanDatasetModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [sample, setSample] = useState<any[]>([]);
  const [applying, setApplying] = useState(false);
  const [step, setStep] = useState<'summary' | 'sample' | 'done'>('summary');

  useEffect(() => {
    loadPreview();
  }, []);

  // ────────────────────────────────────────────────
  // Load preview stats and sample data
  // ────────────────────────────────────────────────
  const loadPreview = async () => {
    setError(null);
    setLoading(true);
    setStep('summary');

    const { data, error } = await supabase.rpc('preview_numeric_cleaning_v2', {
      dataset_id: datasetId,
    });

    if (error) {
      console.error('Error previewing numeric cleaning:', error);
      setError(error.message);
      setLoading(false);
      return;
    }

    setPreview(data || []);
    setLoading(false);
  };

  const loadSample = async () => {
    setStep('sample');
    setSample([]);
    const { data, error } = await supabase
      .from('dataset_values_numeric_raw')
      .select('*')
      .eq('dataset_id', datasetId)
      .limit(15);

    if (error) {
      console.error('Error fetching sample data:', error);
      setError(error.message);
    } else {
      setSample(data || []);
    }
  };

  // ────────────────────────────────────────────────
  // Apply cleaning RPC
  // ────────────────────────────────────────────────
  const applyCleaning = async () => {
    setApplying(true);
    setError(null);
    const { error } = await supabase.rpc('apply_numeric_cleaning_v2', {
      dataset_id: datasetId,
    });

    if (error) {
      console.error('Error applying numeric cleaning:', error);
      setError(error.message);
      setApplying(false);
      return;
    }

    setApplying(false);
    setStep('done');
    onSaved();
  };

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold mb-1">Clean numeric dataset</h2>
        <p className="text-sm text-gray-600 mb-4">{datasetName}</p>

        {/* ─── STATE: LOADING ─────────────────────────── */}
        {loading && (
          <div className="flex justify-center items-center py-8 text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" />
            Generating cleaning preview…
          </div>
        )}

        {/* ─── STATE: ERROR ─────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-3">
            <AlertTriangle size={16} className="inline mr-1" />
            {error}
          </div>
        )}

        {/* ─── STATE: SUMMARY ───────────────────────── */}
        {!loading && step === 'summary' && !error && (
          <>
            {preview.length > 0 ? (
              <div className="grid grid-cols-4 gap-3 mb-6">
                {preview.map((row, i) => (
                  <div
                    key={i}
                    className="text-center border rounded-lg p-4 bg-gray-50 text-sm"
                  >
                    <div className="font-medium text-gray-700">
                      {row.match_status}
                    </div>
                    <div className="text-gray-800 text-xl font-semibold">
                      {row.count.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {Number(row.percentage).toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 py-6 text-center">
                No rows found for this dataset.
              </div>
            )}

            <p className="text-xs text-gray-600 mb-4">
              This process converts raw numeric data into cleaned form matched
              to ADM boundaries. It will overwrite existing cleaned values.
            </p>

            <div className="flex justify-between items-center mt-4">
              <button
                onClick={loadSample}
                className="text-sm text-[var(--ssc-blue)] hover:underline"
              >
                View sample rows
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={applyCleaning}
                  disabled={applying}
                  className="px-4 py-2 bg-[var(--ssc-blue)] text-white rounded hover:bg-blue-800 text-sm"
                >
                  {applying ? 'Applying…' : 'Apply & Save Cleaned Dataset'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── STATE: SAMPLE VIEW ────────────────────── */}
        {step === 'sample' && (
          <>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                Sample of raw rows
              </h3>
              <button
                onClick={() => setStep('summary')}
                className="text-xs text-[var(--ssc-blue)] hover:underline"
              >
                ← Back to summary
              </button>
            </div>

            <div className="border rounded overflow-x-auto max-h-[300px]">
              <table className="min-w-full text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700 sticky top-0">
                  <tr>
                    {sample.length > 0 &&
                      Object.keys(sample[0]).map((key) => (
                        <th key={key} className="px-2 py-1 text-left border-b">
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {sample.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="px-2 py-1">
                          {val?.toString() || '–'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── STATE: SUCCESS ───────────────────────── */}
        {step === 'done' && (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle2
              size={36}
              className="text-green-600 mb-3"
              strokeWidth={2}
            />
            <p className="text-gray-800 font-medium mb-1">
              Cleaning completed successfully!
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Cleaned values have been saved for this dataset.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[var(--ssc-blue)] text-white rounded hover:bg-blue-800 text-sm"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
