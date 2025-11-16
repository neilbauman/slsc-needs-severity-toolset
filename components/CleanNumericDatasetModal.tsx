'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState<number | null>(null)
  const [adaptiveBatchSize, setAdaptiveBatchSize] = useState(2000)
  const cleaningRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setProgress(0)
      setError(null)
      setComplete(false)
      setCleaning(false)
      setCurrentBatch(0)
      setTotalBatches(null)
    }
  }, [open])

  async function estimateTotalRows() {
    const { count, error } = await supabase
      .from('dataset_values_numeric_raw')
      .select('*', { count: 'exact', head: true })
      .eq('dataset_id', datasetId)

    if (error) {
      console.warn('Could not estimate total rows:', error.message)
      return 40000 // fallback guess
    }
    return count || 40000
  }

  async function handleClean() {
    if (cleaningRef.current) return // prevent double start
    cleaningRef.current = true
    setCleaning(true)
    setError(null)
    setComplete(false)
    setProgress(0)

    try {
      const totalRows = await estimateTotalRows()
      const batches = Math.ceil(totalRows / adaptiveBatchSize)
      setTotalBatches(batches)

      // wipe any previously cleaned data
      await supabase.rpc('delete_existing_numeric', { in_dataset_id: datasetId })

      for (let batch = 0; batch < batches; batch++) {
        setCurrentBatch(batch + 1)
        const offset = batch * adaptiveBatchSize

        const startTime = performance.now()
        const { error: rpcError } = await supabase.rpc('clean_numeric_dataset_v2', {
          in_dataset_id: datasetId,
          in_offset: offset,
          in_limit: adaptiveBatchSize
        })
        const endTime = performance.now()

        if (rpcError) {
          // adaptive handling of timeout
          if (rpcError.code === '57014' || rpcError.message.includes('timeout')) {
            const newSize = Math.max(250, Math.floor(adaptiveBatchSize / 2))
            console.warn(`Batch timeout — reducing batch size to ${newSize}`)
            setAdaptiveBatchSize(newSize)
            batch-- // retry the same batch
            continue
          } else {
            throw rpcError
          }
        }

        // adaptive speed increase if very fast
        const elapsed = endTime - startTime
        if (elapsed < 2000 && adaptiveBatchSize < 4000) {
          const newSize = Math.min(4000, Math.floor(adaptiveBatchSize * 1.5))
          setAdaptiveBatchSize(newSize)
        }

        const pct = Math.min(100, ((batch + 1) / batches) * 100)
        setProgress(pct)
      }

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
      cleaningRef.current = false
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
            <p className="text-gray-700 mb-4">
              Cleaning batch {currentBatch}/{totalBatches ?? '?'} (Batch size: {adaptiveBatchSize})
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
              <div
                className="bg-blue-600 h-3 transition-all duration-300"
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
