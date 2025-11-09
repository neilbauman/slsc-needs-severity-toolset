"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Eye, Pencil, Trash } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import UploadDatasetModal from "@/components/UploadDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DatasetsPage() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editDataset, setEditDataset] = useState<any | null>(null);
  const [datasets, setDatasets] = useState<any[]>([]);

  async function fetchDatasets() {
    const { data, error } = await supabase.from("datasets").select("*");
    if (error) {
      console.error("Error fetching datasets:", error);
    } else {
      setDatasets(data);
    }
  }

  async function deleteDataset(id: string) {
    const { error } = await supabase.from("datasets").delete().eq("id", id);
    if (error) console.error("Failed to delete dataset:", error);
    else fetchDatasets();
  }

  useEffect(() => {
    fetchDatasets();
  }, []);

  const coreDatasets = datasets.filter((d) => d.category === "core");
  const rawDatasets = datasets.filter((d) => d.category !== "core");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-800 px-6 py-4 text-white">
        <h1 className="text-2xl font-semibold">
          Philippines Shelter Severity Toolset <span className="text-yellow-400">(sandbox)</span>
        </h1>
        <nav className="text-sm mt-1 text-gray-300">
          <Link href="/" className="hover:underline">
            Dashboard
          </Link>
          <span className="mx-2">»</span>
          <span className="text-white">Datasets</span>
        </nav>
      </header>

      <main className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Datasets</h2>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => setShowUploadModal(true)}
          >
            Upload New Dataset
          </button>
        </div>

        <section className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Core Datasets</h3>
          <div className="space-y-3">
            {coreDatasets.map((dataset) => (
              <div
                key={dataset.id}
                className="bg-white p-4 rounded shadow-sm flex items-center justify-between"
              >
                <div>
                  <p className="text-gray-800 font-medium">{dataset.name}</p>
                  <p className="text-sm text-gray-500">Admin Level: {dataset.admin_level}, Type: {dataset.type}</p>
                </div>
                <div className="flex space-x-2 text-gray-500">
                  <Eye className="w-4 h-4 cursor-pointer hover:text-blue-600" />
                  <Pencil
                    className="w-4 h-4 cursor-pointer hover:text-yellow-500"
                    onClick={() => setEditDataset(dataset)}
                  />
                  <Trash
                    className="w-4 h-4 cursor-pointer hover:text-red-500"
                    onClick={() => deleteDataset(dataset.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Other Datasets</h3>
          <div className="space-y-3">
            {rawDatasets.map((dataset) => (
              <div
                key={dataset.id}
                className="bg-white p-4 rounded shadow-sm flex items-center justify-between"
              >
                <div>
                  <p className="text-gray-800 font-medium">{dataset.name}</p>
                  <p className="text-sm text-gray-500">Admin Level: {dataset.admin_level}, Type: {dataset.type}</p>
                </div>
                <div className="flex space-x-2 text-gray-500">
                  <Eye className="w-4 h-4 cursor-pointer hover:text-blue-600" />
                  <Pencil
                    className="w-4 h-4 cursor-pointer hover:text-yellow-500"
                    onClick={() => setEditDataset(dataset)}
                  />
                  <Trash
                    className="w-4 h-4 cursor-pointer hover:text-red-500"
                    onClick={() => deleteDataset(dataset.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {showUploadModal && (
          <UploadDatasetModal
            isOpen={true}
            onClose={() => setShowUploadModal(false)}
            onSave={() => {
              setShowUploadModal(false);
              fetchDatasets();
            }}
          />
        )}

        {editDataset && (
          <EditDatasetModal
            dataset={editDataset}
            isOpen={true}
            onClose={() => setEditDataset(null)}
            onSave={() => {
              setEditDataset(null);
              fetchDatasets();
            }}
          />
        )}
      </main>
    </div>
  );
}
