"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase/supabaseBrowser";
import { Button } from "@/components/ui/button";

export default function CategoricalScoringModal({ dataset, instance, onClose }) {
  const [categories, setCategories] = useState([]);
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("dataset_values_categorical")
        .select("category")
        .eq("dataset_id", dataset.id);
      if (error) console.error(error);
      else setCategories([...new Set(data.map((r) => r.category))]);
    };
    loadCategories();
  }, [dataset.id]);

  const handleSave = async () => {
    setSaving(true);
    const payload = Object.entries(scores).map(([category, score]) => ({
      category,
      score: Number(score),
    }));
    const { error } = await supabase.rpc("score_categorical_dataset", {
      instance_id: instance.id,
      dataset_id: dataset.id,
      category_scores: payload,
    });
    setSaving(false);
    if (error) alert(error.message);
    else alert("Scores saved!");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-[600px] p-6">
        <h3 className="text-lg font-semibold mb-3">
          Scoring (categorical): {dataset.name}
        </h3>
        <table className="w-full text-sm mb-4">
          <thead><tr><th>Category</th><th>Score (1-5)</th></tr></thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat}>
                <td className="p-1">{cat}</td>
                <td className="p-1">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="border w-16 text-center"
                    value={scores[cat] ?? ""}
                    onChange={(e) => setScores({ ...scores, [cat]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
