'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import NumericScoringModal from './NumericScoringModal';
import CategoricalScoringModal from './CategoricalScoringModal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  instance: any;
  onClose: () => void;
  onSaved?: () => Promise<void>;
}

export default function InstanceDatasetConfigModal({ instance, onClose, onSaved }: Props) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Load datasets and linkage info
  const loadDatasets = async () => {
    setLoading(true);

    const { data: all, error: allErr } = await supabase
      .from('datasets')
      .select('id, name, category, type, admin_level')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (allErr) {
      console.error('Error loading datasets:', allErr);
      setLoading(false);
      return;
    }

    const { data: links, error: linkErr } = await supabase
      .from('instance_datasets')
      .select('dataset_id')
      .eq('instance_id', instance.id);
    if (linkErr) {
      console.error('Error loading links:', linkErr);
      setLoading(false);
      return;
    }

    const linked = new Set((links || []).map((r) => r.dataset_id));
    setLinkedIds(linked);
    setDatasets(all || []);
    setLoading(false);
  };

  useEffect(() => {
    loadDatasets();
  }, [instance.id]);

  // Toggle link/unlink dataset
  const toggleDataset = async (datasetId: string, checked: boolean) => {
    if (checked) {
      const { error } = await supabase
        .from('instance_datasets')
        .insert([{ instance_id: instance.id, dataset_id: datasetId }]);
      if (error) console.error('Link error:', error);
      else setLinkedIds((prev) => new Set([...prev, datasetId]));
    } else {
      const { error } = await supabase
        .from('instance_datasets')
        .delete()
        .eq('instance_id', instance.id)
        .eq('dataset_id', datasetId);
      if (error) console.error('Unlink error:', error);
      else {
        const next = new Set(linkedIds);
        next.delete(datasetId);
        setLinkedIds(next);
      }
    }

    if (onSaved) await onSaved();
  };

  const handleModalClose = async () => {
    setSelected(null);
    await loadDatasets();
    if (onSaved) await onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[900px] max-h-[90vh] overflow-y-auto text-sm">
        <h2 className="text-lg font-semibold mb-1">
          Dataset Configuration – {instance.name}
        </h2>
        <p className="text-gray-600 mb-4">
          Select datasets to include in the instance and configure their scoring.
        </p>

        {loading ? (
          <p className="text-center text-gray-500 py-4">Loading datasets…</p>
        ) : (
          <table className="w-full text-sm border border-gray-200 rounded">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2 w-12 text-center">Use</th>
                <th className="p-2">Dataset</th>
                <th className="p-2">Category</th>
                <th className="p-2">Type</th>
                <th className="p-2 text-center w-40">Action</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => {
                const checked = linkedIds.has(d.id);
                return (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleDataset(d.id, e.target.checked)}
                      />
                    </td>
                    <td className="p-2 font-medium">{d.name}</td>
                    <td className="p-2 text-gray-600">{d.category}</td>
                    <td className="p-2 capitalize">{d.type}</td>
                    <td className="p-2 text-center">
                      {checked ? (
                        <button
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          onClick={() => setSelected(d)}
                        >
                          Configure Scoring
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="flex justify-end mt-4">
          <button
            className="px-4 py-1.5 border border-gray-400 rounded hover:bg-gray-100 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Modals */}
      {selected && selected.type === 'numeric' && (
        <NumericScoringModal
          dataset={selected}
          instance={instance}
          onClose={handleModalClose}
          onSaved={handleModalClose} // ✅ ensures refresh + re-render
        />
      )}

      {selected && selected.type === 'categorical' && (
        <CategoricalScoringModal
          dataset={selected}
          instance={instance}
          onClose={handleModalClose}
          onSaved={handleModalClose}
        />
      )}
    </div>
  );
}
