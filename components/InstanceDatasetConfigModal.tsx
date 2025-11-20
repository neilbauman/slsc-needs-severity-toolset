"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import NumericScoringModal from "./NumericScoringModal";
import CategoricalScoringModal from "./CategoricalScoringModal";

interface InstanceDatasetConfigModalProps {
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function InstanceDatasetConfigModal({
  instance,
  onClose,
  onSaved,
}: InstanceDatasetConfigModalProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ Load datasets and their linkage to the instance
  useEffect(() => {
    // Ensure instance and instance.id exist before loading
    if (!instance || !instance.id) {
      console.warn("InstanceDatasetConfigModal: instance or instance.id is missing");
      return;
    }

    const loadData = async () => {
      setLoading(true);

      const { data: all, error: allErr } = await supabase
        .from("datasets")
        .select("id, name, category, type, admin_level, is_derived")
        .order("category, name");

      if (allErr) {
        console.error("Dataset load error:", allErr.message);
        setLoading(false);
        return;
      }

      const { data: links, error: linkErr } = await supabase
        .from("instance_datasets")
        .select("dataset_id")
        .eq("instance_id", instance.id);

      if (linkErr) {
        console.error("Link load error:", linkErr.message);
        setLoading(false);
        return;
      }

      const linked = new Set((links || []).map((r) => r.dataset_id));
      setLinkedIds(linked);
      setDatasets(all || []);
      setLoading(false);
    };

    loadData();
  }, [instance?.id]);

  // ✅ Toggle dataset linkage (add/remove)
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
    await onSaved();
  };

  const handleModalClose = async () => {
    setSelected(null);
    await onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[900px] max-h-[85vh] overflow-y-auto p-5 text-sm">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">
          Dataset Configuration – {instance.name}
        </h2>
        <p className="text-gray-500 mb-4">
          Select which datasets are included and configure their scoring.
        </p>

        {loading ? (
          <div className="text-center text-gray-500 py-6">Loading datasets…</div>
        ) : (
          <table className="w-full border border-gray-200 text-sm">
            <thead className="bg-gray-100 text-gray-700 text-xs uppercase">
              <tr>
                <th className="p-2 w-10 text-center">Use</th>
                <th className="p-2 text-left">Dataset</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-center w-32">Action</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => {
                const checked = linkedIds.has(d.id);
                return (
                  <tr
                    key={d.id}
                    className={`border-t ${
                      checked ? "bg-white" : "bg-gray-50"
                    } hover:bg-gray-100`}
                  >
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleDataset(d.id, e.target.checked)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="p-2 font-medium text-gray-800">{d.name}</td>
                    <td className="p-2 text-gray-600">{d.category}</td>
                    <td className="p-2 text-gray-600 capitalize">{d.type}</td>
                    <td className="p-2 text-center">
                      {checked && (
                        <button
                          onClick={() => setSelected(d)}
                          className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Configure
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="flex justify-end mt-5">
          <button
            className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Scoring Modals */}
      {selected && selected.type === "numeric" && (
        <NumericScoringModal
          dataset={selected}
          instance={instance}
          onClose={handleModalClose}
          onSaved={onSaved}
        />
      )}

      {selected && selected.type === "categorical" && (
        <CategoricalScoringModal
          dataset={selected}
          instance={instance}
          onClose={handleModalClose}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
