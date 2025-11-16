'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

enum Stage {
  PREVIEW,
  STRATEGY,
  CLEANING,
  COMPLETE,
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const supabase = createClient();

  const [stage, setStage] = useState(Stage.PREVIEW);
  const [preview, setPreview] = useState<{ total_raw: number; matched_by_pcode: number; unmatched_by_pcode: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<'pcode' | 'fuzzy' | null>(null);

  useEffect(() => {
    if (open) {
      setStage(Stage.PREVIEW);
      setPreview(null);
      setProgress(0);
      loadPreview();
    }
  }, [open]);

  async function loadPreview() {
    setIsLoading(true);
    const { data, error } = await supabase.rpc('preview_numeric_cleaning_v1', { in_dataset_id: datasetId });
    setIsLoading(false);

    if (error) {
      console.error('Error previewing:', error);
      return;
    }
    if (data && data.length > 0) {
      setPreview(data[0]);
    }
  }

  async function startCleaning() {
    if (!selectedStrategy) return;

    setStage(Stage.CLEANING);
    setStatusText('Cleaning in progress...');
    setProgress(0);

    const batchSize = 5000;
    let offset = 0;
    let totalInserted = 0;

    while (true) {
      const { data, error } = await supabase.rpc('clean_numeric_dataset_v6_pcode_only', {
        in_dataset_id: datasetId,
        in_offset: offset,
        in_limit: batchSize,
      });

      if (error) {
        console.error('Cleaning error:', error);
        setStatusText('Error during cleaning.');
        break;
      }

      const inserted = data?.[0]?.clean_numeric_dataset_v6_pcode_only ?? 0;
      if (inserted === 0) break;

      totalInserted += inserted;
      offset += batchSize;

      const progressVal = Math.min(100, Math.round((totalInserted / (preview?.total_raw ?? 1)) * 100));
      setProgress(progressVal);
      await new Promise((res) => setTimeout(res, 200)); // slight delay for smoother updates
    }

    setStatusText('Cleaning complete.');
    setProgress(100);
    setStage(Stage.COMPLETE);

    await onCleaned();
  }

  return (
    open && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-800">
            Clean Numeric Dataset — {datasetName}
          </h2>

          {stage === Stage.PREVIEW && (
            <div>
              {isLoading && <p>Loading preview...</p>}
              {preview && (
                <div className="space-y-2">
                  <p><strong>Total rows:</strong> {preview.total_raw}</p>
                  <p><strong>Matched by PCode:</strong> {preview.matched_by_pcode}</p>
                  <p><strong>Unmatched by PCode:</strong> {preview.unmatched_by_pcode}</p>

                  <button
                    onClick={() => setStage(Stage.STRATEGY)}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Next: Choose Cleaning Strategy
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === Stage.STRATEGY && (
            <div className="space-y-3">
              <p>Select your preferred cleaning strategy:</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setSelectedStrategy('pcode')}
                  className={`px-4 py-2 rounded-lg border ${selectedStrategy === 'pcode' ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}
                >
                  Match by PCode only (fastest)
                </button>
                <button
                  onClick={() => setSelectedStrategy('fuzzy')}
                  disabled
                  className={`px-4 py-2 rounded-lg border border-gray-200 text-gray-400`}
                >
                  Fuzzy name matching (coming soon)
                </button>
              </div>
              <button
                onClick={startCleaning}
                disabled={!selectedStrategy}
                className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Start Cleaning
              </button>
            </div>
          )}

          {stage === Stage.CLEANING && (
            <div className="space-y-3">
              <p>{statusText}</p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-500 h-4 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">{progress}% complete</p>
            </div>
          )}

          {stage === Stage.COMPLETE && (
            <div className="text-center space-y-4">
              <p className="text-green-700 font-semibold">✅ Cleaning completed successfully.</p>
              <button
                onClick={() => onOpenChange(false)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          )}

          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-2 right-3 text-gray-500 hover:text-black"
          >
            ✕
          </button>
        </div>
      </div>
    )
  );
}
