'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Eye, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

interface CleaningResult {
  match_status: string;
  count: number;
  percentage: number;
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<CleaningResult[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load preview stats from RPC
  useEffect(() => {
    if (!open) return;
    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.rpc('preview_numeric_cleaning_v2', {
          dataset_id: datasetId,
        });
        if (error) throw error;
        setResults(data || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load cleaning preview');
      } finally {
        setLoading(false);
      }
    };
    loadPreview();
  }, [open, datasetId]);

  const handleApply = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('apply_numeric_cleaning_v2', {
        dataset_id: datasetId,
      });
      if (error) throw error;
      await onCleaned();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to apply cleaned dataset');
    } finally {
      setSaving(false);
    }
  };

  const handleViewSample = async () => {
    setShowPreview(!showPreview);
    if (previewRows.length > 0 || showPreview) return;
    try {
      const { data, error } = await supabase
        .from('dataset_values_numeric_raw')
        .select('adm2_name, adm3_name, value')
        .eq('dataset_id', datasetId)
        .limit(20);
      if (error) throw error;
      setPreviewRows(data || []);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load preview rows');
    }
  };

  const getCardColor = (status: string) => {
    switch (status) {
      case 'matched':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'no_adm2_match':
      case 'no_adm3_match':
      case 'no_adm3_name_match':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            Clean numeric dataset
          </h2>
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={() => onOpenChange(false)}
          >
            <X size={22} />
          </button>
        </div>

        <p className="text-gray-600 mb-3">{datasetName}</p>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="animate-spin mr-2" size={18} />
            Loading cleaning preview...
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {results.map((r) => (
              <div
                key={r.match_status}
                className={`border rounded-lg p-4 text-center ${getCardColor(
                  r.match_status
                )}`}
              >
                <p className="font-semibold capitalize">{r.match_status.replaceAll('_', ' ')}</p>
                <p className="text-2xl font-bold">{r.count.toLocaleString()}</p>
                <p className="text-sm opacity-70">
                  {r.percentage ? `${r.percentage.toFixed(2)}%` : '—'}
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="text-gray-600 text-sm">
          This process converts raw numeric data into cleaned form matched to ADM
          boundaries. It will overwrite existing cleaned values.
        </p>

        <Button
          variant="link"
          onClick={handleViewSample}
          className="text-[var(--ssc-blue)] hover:underline"
        >
          <Eye size={16} className="mr-1" /> View sample rows
        </Button>

        {showPreview && (
          <div className="border rounded-md p-2 max-h-64 overflow-y-auto text-sm">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 text-left text-gray-700">
                <tr>
                  <th className="px-2 py-1 border-b">ADM2</th>
                  <th className="px-2 py-1 border-b">ADM3</th>
                  <th className="px-2 py-1 border-b">Value</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1">{row.adm2_name}</td>
                    <td className="px-2 py-1">{row.adm3_name}</td>
                    <td className="px-2 py-1">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={saving}
            className="bg-[var(--ssc-blue)] hover:bg-blue-800 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} /> Applying…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2" size={16} /> Apply & Save Cleaned Dataset
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
