"use client";

import React from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface Dataset {
  id: string;
  name: string;
  type: string;
  admin_level: string;
  category?: string;
}

const mockDatasets: Dataset[] = [
  { id: "1", name: "Population by Barangay", type: "CSV", admin_level: "ADM5", category: "Core" },
  { id: "2", name: "Hazard Zones", type: "GeoJSON", admin_level: "ADM3", category: "Baseline" },
  { id: "3", name: "Population Density", type: "Derived", admin_level: "ADM4", category: "Derived" },
];

export default function DatasetsPage() {
  return (
    <div>
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Datasets</h1>
            <p className="text-gray-600 text-sm">
              Manage and review available SSC datasets
            </p>
          </div>

          <Link
            href="#"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
          >
            + Upload Dataset
          </Link>
        </div>

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
              {mockDatasets.map((dataset) => (
                <tr key={dataset.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    {dataset.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{dataset.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {dataset.admin_level}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {dataset.category || "Uncategorized"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm space-x-3">
                    <Link href="#" className="text-blue-600 hover:underline">
                      View
                    </Link>
                    <Link href="#" className="text-yellow-600 hover:underline">
                      Edit
                    </Link>
                    <button
                      onClick={() => alert("Deleted")}
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
      </main>
    </div>
  );
}
