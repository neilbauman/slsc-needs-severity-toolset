'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2 } from 'lucide-react'

type CleanNumericDatasetModalProps = {
  datasetId: string
  datasetName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCleaned: () => Promise<void>
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned
}: CleanNumericDatasetModalProps) {
  const [cleaning, setCleaning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    if (!open) {
      setProgress(0)
      setError(null)
      setComplete(false)
    }
  }, [open])

  async function handleClean() {
    setCleaning(true)
    setError(null)
    setProgress(0)
    setComplete(false)

    try {
      let batch = 0
      const batchSize = 2000

      // 1️⃣ Step 1 - clear existing numeric values
      await supabase.rpc('delete_existing_numeric', { in_dataset_id: datasetId })

      // 2️⃣ Step 2 - begin cleaning in batches
      while (true) {
        const { error: rpcError } = await supabase.rpc('clean_numeric_dataset_v2', {
          in_dataset_id: datasetId,
          in_offset: batch * batchSize,
          in_limit: batchSize
        })

        if (rpcError) {
          if (rpcError.code === 'PGRST204') break // no more batches
          throw rpcError
        }

        batch += 1
        setProgress(Math.min(100, (batch * batchSize) / 42000 * 100))

        if (progress >= 99) break
      }

      // 3️⃣ Step 3 - mark dataset as cleaned
      await supabase
        .from('datasets')
        .update({ is_cleaned: true })
        .eq('id', datasetId)

      setProgress(100)
      setComplete(true)
      await onCleaned()
    } catch (err: any) {
      console.error('Cleaning error:', err)
      setError(err.message || 'An unknown error occurred')
    } finally {
      setCleaning(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center relative">
        <h2 className="text-2xl font-bold mb-3">Clean Dataset</h2>
        <p className="text-gray-600 mb-6">
          Dataset: <span className="font-semibold">{datasetName}</span>
        </p>

        {error ? (
          <p className="text-red-600 mb-6">{error}</p>
        ) : complete ? (
          <p className="text-green-600 mb-6">✅ Cleaning complete!</p>
        ) : cleaning ? (
          <>
            <p className="text-gray-700 mb-4">Cleaning in progress…</p>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">{Math.floor(progress)}%</p>
          </>
        ) : (
          <p className="text-gray-700 mb-6">
            This will clean and standardize numeric data for this dataset.
          </p>
        )}

        <div className="mt-6 flex justify-center gap-4">
          {!cleaning && !complete && (
            <button
              onClick={handleClean}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              Start Cleaning
            </button>
          )}
          {cleaning && (
            <button
              disabled
              className="px-6 py-2 bg-blue-400 text-white font-medium rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Loader2 className="animate-spin h-4 w-4" />
              Cleaning…
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
          >
            {complete ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
