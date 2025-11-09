"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import ViewDatasetModal from "@/components/ViewDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";
import DeleteDatasetModal from "@/components/DeleteDatasetModal";
import DerivedDatasetModal from "@/components/DerivedDatasetModal"; // future
import { Button } from "@/components/ui/button";

interface Dataset {
  id: string;
  name: string;
  category: string | null;
  type: string;
  admin_level: string | null;
  source: string | null;
  description: string | null;
  collected_at: string | null;
  is_derived: boolean;
  is_baseline: boolean;
  derived_from: string | null;
}

const CATEGORY_ORDER = [
  "Core",
  "SSC Framework - P1",
  "SSC Framework - P2",
  "SSC Framework - P3",
  "Hazards",
  "Underlying Vulnerability",
  "Uncategorized",
];

export default function DatasetsPage() {
  const supabase = createClient();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [derivedOpen, setDerivedOpen] = useState(false);

  useEffect(() => {
    const fetchDatasets = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("datasets").select("*");
      if (error) {
        console.error("Error fetching datasets:", error);
      } else {
        const processed = data.map((d: Dataset) => ({
          ...d,
          category: determineCategory(d),
        }));
        setDatasets(processed);
      }
      setLoading(false);
    };
    fetchDatasets();
  }, []);

  const determineCategory = (d: Dataset): string => {
    if (d.category && CATEGORY_ORDER.includes(d.category)) return d.category;

    const lowerName = d.name?.toLowerCase() || "";
    if (
      lowerName.includes("population") ||
      lowerName.includes("admin") ||
      lowerName.includes("boundary") ||
      lowerName.includes("gis")
    )
      return "Core";

    if (d.is_baseline) return "Core";
    return "Uncategorized";
  };

  const groupedDatasets = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    datasets: datasets.filter((d) => determineCategory(d) === cat),
  })).filter((g) => g.datasets.length > 0);

  const handleView = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setViewOpen(true);
  };

  const handleEdit = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setEditOpen(true);
  };

  const handleDelete = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setDeleteOpen(true);
  };

  const handleDerived = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setDerivedOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Datasets</h2>
          <Button
            onClick={() => setDerivedOpen(true)}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            + Derived Dataset
          </Button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading datasets...</p>
        ) : groupedDatasets.length === 0 ? (
          <p className="text-gray-500">No datasets found.</p>
        ) : (
          groupedDatasets.map((group) => (
            <div key={group.category} className="mb-10">
              <h3 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">
                {group.category}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {group.datasets.map((d) => (
                  <div
                    key={d.id}
                    className="bg-white border shadow-sm rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-medium text-gray-800">
                          {d.name}
                          {d.is_derived && (
                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                              Derived
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {d.description || "No description available."}
                        </p>
                        <div className="text-xs text-gray-400 mt-1">
                          {d.admin_level && <span>Level: {d.admin_level}</span>}
                          {d.source && <span> • Source: {d.source}</span>}
                          {d.collected_at && (
                            <span>
                              {" "}
                              • Collected:{" "}
                              {new Date(d.collected_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(d)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(d)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDerived(d)}
                        >
                          Derived
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(d)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Modals */}
      {viewOpen && selectedDataset && (
        <ViewDatasetModal
          dataset={selectedDataset}
          onClose={() => setViewOpen(false)}
        />
      )}
      {editOpen && selectedDataset && (
        <EditDatasetModal
          dataset={selectedDataset}
          onClose={() => setEditOpen(false)}
        />
      )}
      {deleteOpen && selectedDataset && (
        <DeleteDatasetModal
          dataset={selectedDataset}
          onClose={() => setDeleteOpen(false)}
        />
      )}
      {derivedOpen && (
        <DerivedDatasetModal onClose={() => setDerivedOpen(false)} />
      )}
    </div>
  );
}
