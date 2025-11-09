"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import Header from "@/components/Header";

interface Dataset {
  id: string;
  name: string;
  type: string;
  admin_level: string;
  category?: string;
  description?: string;
  created_at?: string;
}

export default function DatasetsPage() {
  const supabase = createClient();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDatasets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching datasets:", error);
      } else {
        setDatasets(data || []);
      }
      setLoading(false);
    };

    fetchDatasets();
  }, []);

  // Categorize datasets
  const categorized = {
    Core: datasets.filter((d) =>
      ["Admins", "Population", "GIS Boundaries"].some((k) =>
        d.name.toLowerCase().includes(k.toLowerCase())
      )
    ),
    Baseline: datasets.filter((d) =>
      ["SSC", "Hazard", "Vulnerability"].some((k) =>
        (d.category || d.name).toLowerCase().includes(k.toLowerCase())
      )
    ),
    Derived: datasets.filter((d) =>
      ["Derived", "Density", "Per"].some((k) =>
        d.name.toLowerCase().includes(k.toLowerCase())
      )
    ),
  };

  return (
    <div>
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              Datasets
            </h1>
            <p className="text-gray-600 text-sm">
              Manage, categorize, and derive data used in SSC analysis
            </p>
          </div>

          <Link
            href="/datasets/upload"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
          >
            + Upload Dataset
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading datasets...</p>
        ) : datasets.length === 0 ? (
          <p className="text-gray-500">No datasets found.</p>
        ) : (
          <div className="space-y-10">
            {Object.entries(categorized).map(([category, items]) => (
              <section key={category}>
                <h2 className="text-xl font-semibold mb-3 text-gray-800">
                  {category} Datasets
                </h2>
                {items.length === 0 ? (
                  <p className="text-gray-500 text-sm mb-6">
                    No {category.toLowerCase()} datasets available.
                  </p>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-lg shadow">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Admin Level
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {items.map((dataset) => (
                          <tr key={dataset.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-800">
                              {dataset.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {dataset.type || "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {dataset.admin_level?.toUpperCase() || "N/A"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {dataset.category || "Uncategorized"}
                            </td>
                            <td className="px-6 py-4 text-right text-sm space-x-3">
                              <Link
                                href={`/datasets/${dataset.id}`}
                                className="text-blue-600 hover:underline"
                              >
                                View
                              </Link>
                              <Link
                                href={`/datasets/edit/${dataset.id}`}
                                className="text-yellow-600 hover:underline"
                              >
                                Edit
                              </Link>
                              <button
                                onClick={async () => {
                                  if (
                                    confirm(
                                      `Are you sure you want to delete "${dataset.name}"?`
                                    )
                                  ) {
                                    const { error } = await supabase
                                      .from("datasets")
                                      .delete()
                                      .eq("id", dataset.id);
                                    if (!error) {
                                      setDatasets((prev) =>
                                        prev.filter((d) => d.id !== dataset.id)
                                      );
                                    } else {
                                      alert("Failed to delete dataset.");
                                    }
                                  }
                                }}
                                className="text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
