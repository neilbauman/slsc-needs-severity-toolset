"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase/supabaseBrowser";
import { Button } from "@/components/ui/button";

export default function NumericScoringModal({ dataset, instance, onClose }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSummary = async () => {
      const { data, error } = await supabase.rpc("get_numeric_summary", {
        dataset_id: dataset.id,
      });
      if (error) console.error(error);
      else setSummary(data);
    };
    loadSummary();
  }, [dataset.id]);

  const handleScore = async () => {
    setLoading(true);
    const { error } = await supabase.rpc("score_numeric_dataset", {
      instance_id: instance.id,
      dataset_id: dataset.id,
    });
    setLoading(false);
    if (error) alert("Error scoring dataset: " + error.message);
    else alert("Scoring complete!");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-[600px] p-6">
        <h3 className="text-lg font-semibold mb-3">
          Scoring: {dataset.name}
        </h3>
        {summary ? (
          <div className="text-sm mb-4">
            <p>Records: {summary.count}</p>
            <p>Min: {summary.min}</p>
            <p>Max: {summary.max}</p>
          </div>
        ) : (
          <p>Loading summary...</p>
        )}

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={loading} onClick={handleScore}>
            {loading ? "Scoring..." : "Apply Scoring"}
          </Button>
        </div>
      </div>
    </div>
  );
}
