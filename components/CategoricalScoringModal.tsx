"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CategoricalScoringModal({ dataset, instance, onClose }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("dataset_values_categorical")
        .select("category")
        .eq("dataset_id", dataset.id);
      if (error) {
        console.error(error);
        return;
      }
      const unique = Array.from(new Set(data.map((r) => r.category)));
      setCategories(unique);
    };
    load();
  }, [dataset.id]);

  const handleSave = async () => {
    setSaving(true);
    const category_scores = Object.entries(scores).map(([category, score]) => ({
      category,
      score: Number(score),
    }));
    const { error } = await supabase.rpc("score_categorical_dataset", {
      instance_id: instance.id,
      dataset_id: dataset.id,
      category_scores,
    });
    setSaving(false);
    if (error) {
      console.error(error);
      setStatus("Error: " + error.message);
    } else {
      setStatus("✅ Scores saved!");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-[600px] p-6">
        <h3 className="text-lg font-semibold mb-3">{dataset.name}</h3>
        <table className="w-full text-sm mb-3 border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Category</th>
              <th className="p-2">Score (1–5)</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c} className="border-t">
                <td className="p-2">{c}</td>
                <td className="p-2">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="w-20 border border-gray-300 rounded px-1 text-center"
                    value={scores[c] ?? ""}
                    onChange={(e) =>
                      setScores({ ...scores, [c]: Number(e.target.value) })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {status && <p className="text-xs text-gray-700 mb-2">{status}</p>}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-3 py-1 border border-gray-400 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
