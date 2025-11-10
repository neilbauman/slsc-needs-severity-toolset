"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import NumericScoringModal from "./NumericScoringModal";
import CategoricalScoringModal from "./CategoricalScoringModal";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  instance: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function InstanceDatasetConfigModal({ instance, onClose, onSaved }: Props) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      // Get all datasets
      const { data: all, error: allErr } = await supabase
        .from("datasets")
        .select("id, name, category, type, admin_level");
      if (allErr) return console.error(allErr);

      // Get which datasets are already linked to this instance
      const { data: links, error: linkErr } = await supabase
        .from("instance_datasets")
        .select("dataset_id")
        .eq("instance_id", instance.id);
      if (linkErr) return console.error(linkErr);

      const linked = new Set(links.map((r) => r.dataset_id));
      setLinkedIds(linked);
      setDatasets(all);
    };
    load();
  }, [instance.id]);

  const toggleDataset = async (datasetId: string, checked: boolean) => {
    if (checked) {
      const { error } = await supabase
        .from("instance_datasets")
        .insert([{ instance_id: instance.id, dataset_id: datasetId }]);
      if (error) console.error(error);
      else setLinkedIds((prev) => new Set([...prev, datasetId]));
    } else {
      const { error } = await supabase
        .from("instance_datasets")
        .delete()
        .eq("instance_id", instance.id)
        .eq("dataset_id", datasetId);
      if (error) console.error(error);
      else {
        const next = new Set(linkedIds);
        next.delete(datasetId);
        setLinkedIds(next);
      }
    }
    if (onSaved) onSaved();
  };

  const handleModalClose = () => {
    setSelected(null);
    if (onSaved) onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[900px]">
        <h2 className="text-lg font-semibold mb-4">
          Dataset Configuration – {instance.name}
        </h2>

        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2 w-12 text-center">Use</th>
              <th className="p-2">Dataset</th>
              <th className="p-2">Category</th>
              <th className="p-2">Type</th>
              <th className="p-2">Action</th>
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
                  <td className="p-2">{d.name}</td>
                  <td className="p-2">{d.category}</td>
                  <td className="p-2 capitalize">{d.type}</td>
                  <td className="p-2">
                    {checked && (
                      <button
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                        onClick={() => setSelected(d)}
                      >
                        Configure Scoring
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <button
            className="px-4 py-2 border border-gray-400 rounded hover:bg-gray-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {selected && selected.type === "numeric" && (
        <NumericScoringModal
          dataset={selected}
          instance={instance}
          onClose={handleModalClose}
        />
      )}
      {selected && selected.type === "categorical" && (
        <CategoricalScoringModal
          dataset={selected}
          instance={instance}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
