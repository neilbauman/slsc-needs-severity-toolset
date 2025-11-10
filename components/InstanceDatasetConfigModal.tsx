"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase/supabaseBrowser";
import { Button } from "@/components/ui/button";
import NumericScoringModal from "./NumericScoringModal";
import CategoricalScoringModal from "./CategoricalScoringModal";

export default function InstanceDatasetConfigModal({ instance, onClose }) {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [scoringType, setScoringType] = useState<"numeric" | "categorical" | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data, error } = await supabase
        .from("instance_datasets")
        .select(`
          id,
          instance_id,
          dataset_id,
          datasets (
            id, name, category, type, admin_level, source
          )
        `)
        .eq("instance_id", instance.id);
      if (error) console.error(error);
      else setDatasets(data.map(d => d.datasets));
    };
    loadData();
  }, [instance.id]);

  const handleConfigure = (dataset) => {
    setSelectedDataset(dataset);
    setScoringType(dataset.type);
  };

  const handleCloseScoring = () => {
    setSelectedDataset(null);
    setScoringType(null);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-[900px] p-6">
        <h2 className="text-xl font-semibold mb-4">
          Configure Datasets for {instance.name}
        </h2>

        <table className="w-full text-sm border">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-2">Dataset</th>
              <th className="text-left p-2">Category</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((d) => (
              <tr key={d.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{d.name}</td>
                <td className="p-2">{d.category}</td>
                <td className="p-2 capitalize">{d.type}</td>
                <td className="p-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleConfigure(d)}
                  >
                    Configure Scoring
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>

      {scoringType === "numeric" && selectedDataset && (
        <NumericScoringModal
          dataset={selectedDataset}
          instance={instance}
          onClose={handleCloseScoring}
        />
      )}
      {scoringType === "categorical" && selectedDataset && (
        <CategoricalScoringModal
          dataset={selectedDataset}
          instance={instance}
          onClose={handleCloseScoring}
        />
      )}
    </div>
  );
}
