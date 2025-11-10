"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// --- Replace with your Supabase env vars ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function InstanceDatasetConfigModal({ instance, onClose }) {
  const [datasets, setDatasets] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("instance_datasets")
        .select(`
          dataset_id,
          datasets ( id, name, category, type )
        `)
        .eq("instance_id", instance.id);
      if (error) console.error(error);
      else setDatasets(data.map((d) => d.datasets));
    };
    load();
  }, [instance.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[800px]">
        <h2 className="text-lg font-semibold mb-4">
          Dataset Configuration – {instance.name}
        </h2>

        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2">Dataset</th>
              <th className="p-2">Category</th>
              <th className="p-2">Type</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-2">{d.name}</td>
                <td className="p-2">{d.category}</td>
                <td className="p-2 capitalize">{d.type}</td>
                <td className="p-2">
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    onClick={() => setSelected(d)}
                  >
                    Configure Scoring
                  </button>
                </td>
              </tr>
            ))}
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
          onClose={() => setSelected(null)}
        />
      )}

      {selected && selected.type === "categorical" && (
        <CategoricalScoringModal
          dataset={selected}
          instance={instance}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// Local imports at bottom to avoid Next.js circular import issues
import NumericScoringModal from "./NumericScoringModal";
import CategoricalScoringModal from "./CategoricalScoringModal";
