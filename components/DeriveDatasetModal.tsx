// ==================================================
// FILE: components/DeriveDatasetModal.tsx (Full Regen)
// ==================================================

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DerivedDatasetPreviewModal from '@/components/DerivedDatasetPreviewModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
  value_type: 'absolute' | 'relative';
};

export default function DeriveDatasetModal({ onClose, onCreated }: any) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetA, setDatasetA] = useState('');
  const [datasetB, setDatasetB] = useState('');
  const [useScalar, setUseScalar] = useState(false);
  const [scalar, setScalar] = useState<number | ''>('');
  const [operator, setOperator] = useState('+');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [targetLevel, setTargetLevel] = useState('ADM3');
  const [levels, setLevels] = useState<string[]>([]);
  const [weightingId, setWeightingId] = useState('');
  const [levelNote, setLevelNote] = useState<string | null>(null);

  // Load datasets + admin levels
  useEffect(() => {
    const load = async () => {
      const { data: ds } = await supabase
        .from('datasets')
        .select('id, name, type, admin_level, value_type')
        .order('created_at', { ascending: false });

      const { data: lv } = await supabase
        .from('admin_boundaries')
        .select('admin_level')
        .not('admin_level', 'is', null);

      if (ds) setDatasets(ds);
      if (lv) {
        const uniqueLevels = Array.from(new Set(lv.map((l: any) => l.admin_level))).sort();
        setLevels(uniqueLevels);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!datasetA || (!datasetB && !useScalar)) return;
    const aLevel = datasets.find((d) => d.id === datasetA)?.admin_level;
    const bLevel = datasets.find((d) => d.id === datasetB)?.admin_level;
    if (!aLevel || !bLevel || useScalar) setLevelNote(null);
    else if (aLevel !== bLevel) setLevelNote(`Levels differ (${aLevel} vs ${bLevel})`);
    else setLevelNote(null);
  }, [datasetA, datasetB, useScalar, datasets]);

  const formula = useScalar
    ? `${datasetA} ${operator} ${scalar}`
    : `${datasetA} ${operator} ${datasetB}`;

  const handleCreate = async () => {
    if (!datasetA || (!datasetB && !useScalar) || !newName) return;
    setLoading(true);

    const baseIds = useScalar ? [datasetA] : [datasetA, datasetB];
    const { error } = await supabase.rpc('create_derived_dataset', {
      base_dataset_ids: baseIds,
      formula,
      new_name: newName,
    });

    setLoading(false);
    if (error) alert('Failed to create derived dataset.');
    else {
      onCreated();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 shadow-lg max-w-lg w-full space-y-4">
        <h2 className="text-lg font-semibold">Create Derived Dataset</h2>

        {/* Builder */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={datasetA}
            onChange={(e) => setDatasetA(e.target.value)}
            className="border rounded p-2 text-sm flex-1 min-w-[140px]"
          >
            <option value="">Select Dataset A</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.admin_level})
              </option>
            ))}
          </select>

          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="border rounded p-2 text-sm w-16 text-center"
          >
            <option value="+">+</option>
            <option value="-">−</option>
            <option value="*">×</option>
            <option value="/">÷</option>
          </select>

          {useScalar ? (
            <input
              type="number"
              placeholder="Enter scalar"
              value={scalar}
              onChange={(e) =>
                setScalar(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="border rounded p-2 text-sm w-32"
            />
          ) : (
            <select
              value={datasetB}
              onChange={(e) => setDatasetB(e.target.value)}
              className="border rounded p-2 text-sm flex-1 min-w-[140px]"
            >
              <option value="">Select Dataset B</option>
              {datasets
                .filter((d) => d.id !== datasetA)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.admin_level})
                  </option>
                ))}
            </select>
          )}

          <button
            onClick={() => {
              setUseScalar(!useScalar);
              setDatasetB('');
              setScalar('');
            }}
            className="text-xs text-[var(--ssc-blue)] hover:underline"
          >
            {useScalar ? 'Use Dataset B' : 'Use Scalar'}
          </button>
        </div>

        {/* Value type indicators */}
        {datasetA && (
          <p className="text-xs text-gray-600">
            🧮 A: {datasets.find((d) => d.id === datasetA)?.value_type}
          </p>
        )}
        {datasetB && !useScalar && (
          <p className="text-xs text-gray-600">
            🧮 B: {datasets.find((d) => d.id === datasetB)?.value_type}
          </p>
        )}

        {/* Target Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Administrative Level
          </label>
          <select
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value)}
            className="border rounded p-2 text-sm w-full"
          >
            {levels.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        {/* Weighting Dataset (disabled for relative) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Weighting Dataset (optional)
          </label>
          <select
            value={weightingId}
            onChange={(e) => setWeightingId(e.target.value)}
            className="border rounded p-2 text-sm w-full"
            disabled={
              datasets.find((d) => d.id === datasetA)?.value_type === 'relative'
            }
          >
            <option value="">None</option>
            {datasets
              .filter((d) => d.type === 'numeric' && d.value_type === 'absolute')
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.admin_level})
                </option>
              ))}
          </select>
        </div>

        {/* Level warning */}
        {levelNote && (
          <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 p-2 rounded mt-1">
            ⚠ {levelNote}. Data will be aligned to {targetLevel} before derivation.
          </div>
        )}

        {/* Formula Preview */}
        <div className="text-sm text-gray-600 italic">
          {datasetA && (datasetB || useScalar)
            ? `Formula: ${formula}`
            : 'Select inputs to see formula'}
        </div>

        {/* Dataset Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Dataset Name
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new dataset name"
            className="w-full border rounded p-2 text-sm"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-2">
          <button
            onClick={() => setPreviewOpen(true)}
            disabled={!datasetA || (!datasetB && !useScalar)}
            className="text-sm text-[var(--ssc-blue)] hover:underline"
          >
            Preview Derived Result
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-3 py-1.5 rounded text-sm font-medium bg-[var(--ssc-blue)] hover:bg-blue-800 text-white"
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      {previewOpen && (
        <DerivedDatasetPreviewModal
          baseDatasetIds={useScalar ? [datasetA] : [datasetA, datasetB]}
          formula={formula}
          targetLevel={targetLevel}
          weight_dataset_id={weightingId || null}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
