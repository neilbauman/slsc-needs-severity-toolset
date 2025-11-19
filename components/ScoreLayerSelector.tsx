"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ScoreLayerSelectorProps {
  instanceId: string;
  onToggleLayer: (dataset: any, visible: boolean) => void;
}

export default function ScoreLayerSelector({
  instanceId,
  onToggleLayer,
}: ScoreLayerSelectorProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDatasets = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("instance_datasets_view") // or instance_datasets
        .select("dataset_id, dataset_name, category, subcategory, description")
        .eq("instance_id", instanceId)
        .order("category, dataset_name");

      if (error) {
        console.error("Error loading datasets for layer selector:", error);
      } else {
        setDatasets(data || []);
      }

      setLoading(false);
    };

    loadDatasets();
  }, [instanceId]);

  const grouped = datasets.reduce((acc, d) => {
    const cat = d.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {} as Record<string, any[]>);

  const toggleCategory = (cat: string) =>
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));

  if (loading)
    return (
      <div className="text-sm text-gray-500 p-3">Loading map layers...</div>
    );

  return (
    <div className="border rounded-lg bg-white shadow-sm p-3">
      <h4 className="text-sm font-semibold mb-2 text-gray-700">
        Map Layers
      </h4>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="mb-2 border-t pt-2">
          <button
            onClick={() => toggleCategory(cat)}
            className="w-full text-left font-semibold text-sm text-blue-700"
          >
            {cat} {expanded[cat] ? "▲" : "▼"}
          </button>

          {expanded[cat] && (
            <div className="pl-2 mt-1 space-y-1">
              {items.map((d) => (
                <label key={d.dataset_id} className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    onChange={(e) => onToggleLayer(d, e.target.checked)}
                    className="mr-2"
                  />
                  {d.dataset_name}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
