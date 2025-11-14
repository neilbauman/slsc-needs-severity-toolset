// ===========================
// FILE: app/datasets/page.tsx
// ===========================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import UploadDatasetModal from '@/components/UploadDatasetModal';
import DeriveDatasetModal from '@/components/DeriveDatasetModal';
import { PlusCircleIcon } from 'lucide-react';

type Dataset = {
  id: string;
  name: string;
  type: 'numeric' | 'categorical';
  admin_level: string;
  created_at: string;
  is_cleaned: boolean;
  is_derived?: boolean;
  value_type: 'absolute' | 'relative';
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deriveOpen, setDeriveOpen] = useState(false);

  const loadDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('datasets')
      .select(
        'id, name, type, admin_level, created_at, is_cleaned, is_derived, value_type'
      )
      .order('created_at', { ascending: false });

    if (!error && data) setDatasets(data as Dataset[]);
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">
          Manage Datasets
        </h1>

        <div className="flex gap-2">
          <button
            onClick={() => setUploadOpen(true)}
            className="bg-[var(--ssc-blue)] hover:bg-blue-800 text-white text-sm font-medium px-3 py-1.5 rounded flex items-center gap-1"
          >
            <PlusCircleIcon className="w-4 h-4" /> Upload Dataset
          </button>

          <button
            onClick={() => setDeriveOpen(true)}
            className="bg-[var(--ssc-yellow)] hover:bg-yellow-500 text-black text-sm font-medium px-3 py-1.5 rounded flex items-center gap-1"
          >
            <PlusCircleIcon className="w-4 h-4" /> Create Derived Dataset
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {uploadOpen && (
        <UploadDatasetModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            loadDatasets();
          }}
        />
      )}

      {/* Derived Dataset Modal */}
      {deriveOpen && (
        <DeriveDatasetModal
          onClose={() => setDeriveOpen(false)}
          onCreated={() => {
            setDeriveOpen(false);
            loadDatasets();
          }}
        />
      )}

      {/* Dataset Table */}
      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-3 py-2 border-b text-left">Name</th>
              <th className="px-3 py-2 border-b text-left">Type</th>
              <th className="px-3 py-2 border-b text-left">Value Type</th>
              <th className="px-3 py-2 border-b text-left">Admin Level</th>
              <th className="px-3 py-2 border-b text-left">Cleaned?</th>
              <th className="px-3 py-2 border-b text-left">Origin</th>
              <th className="px-3 py-2 border-b text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  Loading datasets…
                </td>
              </tr>
            )}

            {!loading && datasets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  No datasets uploaded yet.
                </td>
              </tr>
            )}

            {!loading &&
              datasets.map((ds) => (
                <tr key={ds.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {ds.name}
                  </td>

                  {/* Type */}
                  <td className="px-3 py-2 capitalize">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ds.type === 'numeric'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {ds.type}
                    </span>
                  </td>

                  {/* Value Type */}
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ds.value_type === 'absolute'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {ds.value_type}
                    </span>
                  </td>

                  {/* Admin Level */}
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                      {ds.admin_level || 'N/A'}
                    </span>
                  </td>

                  {/* Cleaned */}
                  <td className="px-3 py-2">
                    {ds.is_cleaned ? (
                      <span className="text-green-700 font-medium">Yes</span>
                    ) : (
                      <span className="text-red-700 font-medium">No</span>
                    )}
                  </td>

                  {/* Origin */}
                  <td className="px-3 py-2">
                    {ds.is_derived ? (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                        Derived
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        Raw
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2 space-x-2">
                    <Link
                      href={`/datasets/${ds.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </Link>
                    {!ds.is_cleaned && (
                      <Link
                        href={`/datasets/raw/${ds.id}`}
                        className="text-yellow-700 hover:text-yellow-900 font-medium"
                      >
                        Clean
                      </Link>
                    )}
                    <Link
                      href={`/datasets/delete/${ds.id}`}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
