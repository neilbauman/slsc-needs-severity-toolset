"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NumericScoringModal({ dataset, instance, onClose }) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      const { data, error } = await supabase
        .from("dataset_values_numeric")
        .select("value")
        .eq("dataset_id", dataset.id);
      if (error) {
        console.error(error);
        return;
      }
      const values = data.map((r) => Number(r.value)).filter((v) => !isNaN(v));
      const min = Math.min(...values);
      const max = Math.max(...values);
      setSummary({ count: values.length, min, max });
    };
    loadSummary();
  }, [dataset.id]);

  const handleScore = async () => {
    setLoading(true);
    setStatus("Scoring in progress...");
    const { error } = await supabase.rpc("score_numeric_dataset", {
      instance_id: instance.id,
      dataset_id: dataset.id,
    });
    setLoading(false);
    if (error) {
      console.error(error);
      setStatus("Error: " + error.message);
    } else {
      setStatus("✅ Scoring complete!");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-[500px] p-6">
        <h3 className="text-lg font-semibold mb-2">{dataset.name}</h3>

        {summary ? (
          <div className="text-sm text-gray-700 mb-4">
            <p>Records: {summary.count}</p>
            <p>Min: {summary.min}</p>
            <p>Max: {summary.max}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">Loading summary…</p>
        )}

        {status && <p className="text-xs mb-3 text-gray-700">{status}</p>}

        <div className="flex justify-end space-x-3">
          <button
            className="px-3 py-1 border border-gray-400 rounded hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={handleScore}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Scoring..." : "Apply Scoring"}
          </button>
        </div>
      </div>
    </div>
  );
}
