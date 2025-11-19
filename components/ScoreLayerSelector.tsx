"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ScoreLayerSelectorProps {
  instanceId: string;
  onToggleLayer: (dataset: DatasetGroup, visible: boolean) => void;
}

interface DatasetGroup {
  dataset_id: string;
  name: string;
  category: string | null;
}

export default function ScoreLayerSelector({
  instanceId,
  onToggleLayer,
}: ScoreLayerSelectorProps) {
  const [datasets, setDatasets] = useState<DatasetGroup[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // ✅ Load datasets linked to this instance
  useEffect(() => {
    const loadDatasets = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("instance_datasets_view")
        .select("dataset_id, name, category")
        .eq("instance_id", instanceId)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error("Error loading datasets:", error);
      } else {
        setDatasets(data ?? []);
      }

      setLoading(false);
    };

    loadDatasets();
  }, [instanceId]);

  // ✅ Handle expand/collapse per category
  const toggleCategory = (category: string) => {
    setExpanded((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // ✅ Handle dataset layer toggle
  const toggleDataset = (dataset: DatasetGroup) => {
    const isActive = activeLayers[dataset.dataset_id];
    const newState = !isActive;

    setActiveLayers((prev) => ({
      ...prev,
      [dataset.dataset_id]: newState,
    }));

    onToggleLayer(dataset, newState);
  };

  // ✅ Group datasets by category
  const grouped = datasets.reduce((acc, d) => {
    const cat = d.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {} as Record<string, DatasetGroup[]>);

  // ✅ Desired SSC Framework order
  const categoryOrder = [
    "SSC Framework P1",
    "SSC Framework P2",
    "SSC Framework P3",
    "Hazards",
    "Underlying Vulnerability",
    "Uncategorized",
  ];

  const sortedCategories = categoryOrder.filter((cat) => grouped[cat]);

  return (
    <div className="border rounded-md shadow-sm bg-white p-4 text-sm">
      <h2 className="text-base font-semibold mb-3">Map Layers</h2>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading datasets...</p>
      ) : (
        <div className="space-y-2">
          {sortedCategories.map((category) => (
            <div key={category} className="border-b last:border-b-0">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex justify-between items-center py-2 font-medium hover:text-blue-600"
              >
                <span>{category}</span>
                <span>{expanded[category] ? "▾" : "▸"}</span>
              </button>

              {expanded[category] && (
                <div className="pl-3 pb-2 space-y-1">
                  {grouped[category].map((dataset) => (
                    <label
                      key={dataset.dataset_id}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={!!activeLayers[dataset.dataset_id]}
                        onChange={() => toggleDataset(dataset)}
                        className="accent-blue-600"
                      />
                      <span>{dataset.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
