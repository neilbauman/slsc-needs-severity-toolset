"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface ScoreLayerSelectorProps {
  instanceId: string;
  onSelect?: (dataset: any) => void;
}

export default function ScoreLayerSelector({ instanceId, onSelect }: ScoreLayerSelectorProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Load datasets linked to this instance
  useEffect(() => {
    const loadDatasets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("v_dataset_scores")
        .select("dataset_id, dataset_name, category, avg_score")
        .eq("instance_id", instanceId)
        .order("category, dataset_name");

      if (error) {
        console.error("Error loading datasets:", error.message);
        setDatasets([]);
      } else {
        setDatasets(data || []);
      }
      setLoading(false);
    };
    loadDatasets();
  }, [instanceId]);

  // ✅ Handle selection of dataset
  const handleSelect = (dataset: any) => {
    setActiveDataset(dataset.dataset_id);
    if (onSelect) onSelect(dataset);
  };

  // ✅ Group datasets by category
  const grouped: Record<string, any[]> = datasets.reduce((acc: Record<string, any[]>, d: any) => {
    const cat = d.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {});

  if (loading) return <p className="text-sm text-gray-500">Loading layers...</p>;

  return (
    <div className="text-sm text-gray-800">
      {Object.keys(grouped).length === 0 && (
        <p className="text-gray-400 italic text-xs">No datasets configured.</p>
      )}

      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} className="mb-3">
          <h4 className="font-semibold text-gray-700 mb-1">{cat}</h4>
          <div className="space-y-1">
            {(list as any[]).map((d) => (
              <button
                key={d.dataset_id}
                onClick={() => handleSelect(d)}
                className={`block w-full text-left px-2 py-1 rounded ${
                  d.dataset_id === activeDataset
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                {d.dataset_name}
                {d.avg_score !== null && (
                  <span className="float-right text-xs text-gray-500">
                    {Number(d.avg_score).toFixed(1)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
