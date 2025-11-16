'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onCleaned: () => Promise<void>;
}

const CleanNumericDatasetModal: React.FC<CleanNumericDatasetModalProps> = ({
  datasetId,
  datasetName,
  onClose,
  onCleaned,
}) => {
  const supabase = createClient();

  const [mode, setMode] = useState<'pcode' | 'hierarchical' | 'fuzzy'>('pcode');
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ total_cleaned?: number } | null>(null);

  // Automatically close modal after successful cleaning
  useEffect(() => {
    if (status === 'completed') {
      const timer = setTimeout(() => {
        resetModal();
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const getRPCName = () => {
    switch (mode) {
      case 'pcode':
        return 'clean_dataset_v11';
      case 'hierarchical':
        return 'clean_dataset_v12';
      case 'fuzzy':
        return 'clean_dataset_v13_refine_unmatched';
      default:
        return 'clean_dataset_v11';
    }
  };

  const handleClean = async () => {
    try {
      setStatus('running');
      setMessage('Starting dataset cleaning process...');
      setProgress(5);

      const rpcName = getRPCName();
      const { error } = await supabase.rpc(rpcName, { in_dataset_id: datasetId });
      if (error) throw error;

      setProgress(65);
      setMessage('Cleaning in progress... please wait');

      // Wait for the database operation to complete
      await new Promise((r) => setTimeout(r, 1000));

      const { data: summary } = await supabase
        .from('dataset_cleaning_audit_log')
        .select('total_cleaned')
        .eq('dataset_id', datasetId)
        .order('cleaned_at', { ascending: false })
        .limit(1)
        .single();

      setProgress(100);
      setStatus('completed');
      setMessage('Cleaning complete.');

      setResult({
        total_cleaned: summary?.total_cleaned ?? 0,
      });

      await onCleaned();

      // Safety: ensure modal closes even if UI update lags
      setTimeout(() => {
        resetModal();
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Cleaning error:', err);
      setStatus('error');
      setMessage(err.message || 'An unexpected error occurred.');
    }
  };

  const resetModal = () => {
    setStatus('idle');
    setProgress(0);
    setMessage('');
    setResult(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Clean Dataset: {datasetName}</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Cleaning Method</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 w-full"
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            disabled={status === 'running'}
          >
            <option value="pcode">PCode Match Only (Fast, ADM4)</option>
            <option value="hierarchical">PCode Hierarchical (ADM2/ADM3/ADM4)</option>
            <option value="fuzzy">Fuzzy Refinement (Experimental)</option>
          </select>
        </div>

        <div className="mb-4">
          {status === 'running' && (
            <div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">{message}</p>
            </div>
          )}

          {status === 'completed' && result && (
            <div className="bg-green-100 border border-green-300 rounded-lg p-3">
              <p className="font-medium text-green-800">Cleaning Complete</p>
              <p className="text-sm text-green-700 mt-1">
                Rows cleaned: {result.total_cleaned?.toLocaleString() ?? '0'}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-3">
              <p className="font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{message}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            disabled={status === 'running'}
          >
            {status === 'completed' ? 'Close Now' : 'Cancel'}
          </button>

          <button
            onClick={handleClean}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            disabled={status === 'running'}
          >
            {status === 'running' ? 'Cleaning…' : 'Start Cleaning'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CleanNumericDatasetModal;
