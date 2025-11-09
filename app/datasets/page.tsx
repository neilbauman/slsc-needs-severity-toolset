"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Eye, Pencil, Trash } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DatasetsPage() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [datasets, setDatasets] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDatasets() {
      const { data, error } = await supabase.from("datasets").select("*");
      if (error) {
        console.error("Error fetching datasets:", error);
      } else {
        setDatasets(data);
      }
    }
    fetchDatasets();
  }, []);

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

        <section>
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Uploaded Datasets</h3>
          <div className="space-y-3">
            {datasets.map((dataset) => (
              <div
                key={dataset.id}
                className="bg-white p-4 rounded shadow-sm flex items-center justify-between"
              >
                <span className="text-gray-800">{dataset.name}</span>
                <div className="flex space-x-2 text-gray-500">
                  <Eye className="w-4 h-4 cursor-pointer hover:text-blue-600" />
                  <Pencil className="w-4 h-4 cursor-pointer hover:text-yellow-500" />
                  <Trash className="w-4 h-4 cursor-pointer hover:text-red-500" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow w-full max-w-lg">
              <h2 className="text-xl font-semibold mb-4">Upload Dataset</h2>
              {/* Upload form will go here */}
              <button
                onClick={() => setShowUploadModal(false)}
                className="mt-4 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
