"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ScoreLayerSelectorProps {
  instanceId: string;
  onToggleLayer: (dataset: any, visible: boolean) => void;
}

interface DatasetGroup {
  id: string;
  name: string;
  category: string;
  dataset_id: string;
}

export default function ScoreLayerSelector({
  instanceId,
  onToggleLayer,
}: ScoreLayerSelectorProps) {
  const [datasets, setDatasets] = useState<DatasetGroup[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // 🧩 Load datasets for the given instance
  useEffect(() => {
    const loadDatasets = async () => {
      const { data, error } = await supabase
        .from("instance_datasets_view")
        .select("dataset_id, name, category");

      if (error) {
        console.error("Error loading datasets:", error);
      } else {
        setDatasets(data || []);
      }
      setLoading(false);
    };
    loadDatasets();
  }, [instanceId]);

  // 🧭 Group by SSC Framework category
  const grouped = datasets.reduce((acc: Record<string, DatasetGroup[]>, d) => {
    const cat = d.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {});

  // 🗂️ Category ordering
  const categoryOrder = [
    "P1 - People",
    "P2 - Systems",
    "P3 - Enabling Environment",
    "Hazards",
    "Underlying Vulnerability",
    "Uncategorized",
  ];

  // 🔄 Toggle dataset visibility
  const handleToggleDataset = (dataset: DatasetGroup) => {
    const isActive = activeLayers[dataset.dataset_id];
    const newState = !isActive;

    setActiveLayers((prev) => ({
      ...prev,
      [dataset.dataset_id]: newState,
    }));

    onToggleLayer(dataset, newState);
  };

  if (loading) {
    return (
      <div className="bg-white border rounded-lg shadow-sm p-4 text-sm text-gray-500">
        Loading datasets...
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 h-[75vh] overflow-y-auto text-sm">
      <h2 className="text-lg font-semibold mb-3">Map Layers</h2>
      <p className="text-gray-500 text-xs mb-3">
        Toggle datasets below to visualize scores on the map.
      </p>

      {categoryOrder.map((cat) => {
        const group = grouped[cat];
        if (!group) return null;

        const isOpen = expanded[cat] ?? true;

        return (
          <div key={cat} className="mb-3 border-b border-gray-200 pb-2">
            <button
              onClick={() =>
                setExpanded((prev) => ({ ...prev, [cat]: !isOpen }))
              }
              className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-blue-600 transition"
            >
              <span>{cat}</span>
              <span className="text-gray-400">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen && (
              <div className="mt-2 space-y-1">
                {group.map((dataset) => (
                  <label
                    key={dataset.dataset_id}
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded p-1"
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={activeLayers[dataset.dataset_id] || false}
                        onChange={() => handleToggleDataset(dataset)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="text-gray-800 text-sm">
                        {dataset.name}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
