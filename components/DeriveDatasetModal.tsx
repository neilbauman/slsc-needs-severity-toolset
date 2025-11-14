'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DerivedDatasetPreviewModal from '@/components/DerivedDatasetPreviewModal';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
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
  const [levelNote, setLevelNote] = useState<string | null>(null);

  // Load datasets
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('datasets')
        .select('id, name, type, admin_level')
        .order('created_at', { ascending: false });
      if (!error && data) setDatasets(data);
    };
    load();
  }, []);

  // Determine if admin levels differ
  useEffect(() => {
    if (!datasetA || !datasetB || useScalar) {
      setLevelNote(null);
      return;
    }

    const aLevel = datasets.find((d) => d.id === datasetA)?.admin_level;
    const bLevel = datasets.find((d) => d.id === datasetB)?.admin_level;

    if (!aLevel || !bLevel) {
      setLevelNote(null);
      return;
    }

    if (aLevel === bLevel) {
      setLevelNote(null);
    } else {
      setLevelNote(`Levels differ (${aLevel} vs ${bLevel})`);
    }
  }, [datasetA, datasetB, useScalar, datasets]);

  // Harmonize datasets before derivation
  const harmonizeLevels = async (idA: string, idB: string) => {
    const aLevel = datasets.find((d) => d.id === idA)?.admin_level;
    const bLevel = datasets.find((d) => d.id === idB)?.admin_level;
    if (!aLevel || !bLevel || aLevel === bLevel) return [idA, idB];

    // ADM levels differ → align to the coarser one
    const targetLevel = aLevel < bLevel ? aLevel : bLevel;
    let newA = idA;
    let newB = idB;

    if (aLevel > bLevel) {
      // A is finer, aggregate A → target
      const { data } = await supabase.rpc('aggregate_to_level', {
        dataset_id: idA,
        target_level: targetLevel,
      });
      if (data) console.log(`Aggregated ${idA} to ${targetLevel}`);
    } else {
      // A is coarser, disaggregate A → target
      const { data } = await supabase.rpc('disaggregate_to_level', {
        dataset_id: idA,
        target_level: targetLevel,
      });
      if (data) console.log(`Disaggregated ${idA} to ${targetLevel}`);
    }

    if (bLevel > aLevel) {
      const { data } = await supabase.rpc('aggregate_to_level', {
        dataset_id: idB,
        target_level: targetLevel,
      });
      if (data) console.log(`Aggregated ${idB} to ${targetLevel}`);
    } else {
      const { data } = await supabase.rpc('disaggregate_to_level', {
        dataset_id: idB,
        target_level: targetLevel,
      });
      if (data) console.log(`Disaggregated ${idB} to ${targetLevel}`);
    }

    return [newA, newB];
  };

  // Formula builder
  const formula = useScalar
    ? `${datasetA} ${operator} ${scalar}`
    : `${datasetA} ${operator} ${datasetB}`;

  const handleCreate = async () => {
    if (!datasetA || (!datasetB && !useScalar) || !newName) return;
    setLoading(true);

    const baseIds = useScalar ? [datasetA] : [datasetA, datasetB];
    const [alignedA, alignedB] = useScalar
      ? [datasetA, null]
      : await harmonizeLevels(datasetA, datasetB);

    const finalBaseIds = useScalar ? [alignedA] : [alignedA, alignedB];

    const { error } = await supabase.rpc('create_derived_dataset', {
      base_dataset_ids: finalBaseIds,
      formula,
      new_name: newName,
    });

    setLoading(false);

    if (error) {
      console.error('Error creating derived dataset:', error);
      alert('Failed to create derived dataset.');
    } else {
      onCreated();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 shadow-lg max-w-lg w-full space-y-4">
        <h2 className="text-lg font-semibold">Create Derived Dataset</h2>

        {/* Derivation Builder */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dataset A */}
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

          {/* Operator */}
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

          {/* Dataset B or Scalar */}
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

          {/* Toggle Scalar Mode */}
          <button
            onClick={() => {
              setUseScalar(!useScalar);
              setDatasetB('');
              setScalar('');
              setLevelNote(null);
            }}
            className="text-xs text-[var(--ssc-blue)] hover:underline"
          >
            {useScalar ? 'Use Dataset B' : 'Use Scalar'}
          </button>
        </div>

        {/* Formula Preview */}
        <div className="text-sm text-gray-600 italic mt-1">
          {datasetA && (datasetB || useScalar)
            ? `Formula: ${formula}`
            : 'Select inputs to see formula'}
        </div>

        {/* Level warning */}
        {levelNote && (
          <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 p-2 rounded mt-2">
            ⚠ {levelNote}. System will auto-align levels during derivation.
          </div>
        )}

        {/* New Dataset Name */}
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

      {/* Preview Modal */}
      {previewOpen && (
        <DerivedDatasetPreviewModal
          baseDatasetIds={useScalar ? [datasetA] : [datasetA, datasetB]}
          formula={formula}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
