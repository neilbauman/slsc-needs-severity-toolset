"use client";

import React, { useState } from "react";
import Link from "next/link";
import ViewDatasetModal from "@/components/ViewDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";
import DeleteDatasetModal from "@/components/DeleteDatasetModal";

export default function DatasetTable({ datasets }: { datasets: any[] }) {
  const [viewDataset, setViewDataset] = useState<any | null>(null);
  const [editDataset, setEditDataset] = useState<any | null>(null);
  const [deleteDataset, setDeleteDataset] = useState<any | null>(null);

  const coreDatasets = datasets.filter((d) =>
    /(population|adm|admin|boundary|core|baseline)/i.test(d.name || "")
  );

  const hazardDatasets = datasets.filter((d) =>
    /(hazard|flood|landslide|typhoon|storm|volcano|earthquake)/i.test(
      d.name || ""
    )
  );

  const vulnerabilityDatasets = datasets.filter((d) =>
    /(poverty|building|infrastructure|vulnerability|education|health)/i.test(
      d.name || ""
    )
  );

  const frameworkDatasets = datasets.filter(
    (d) =>
      /(ssc framework|ssc|framework)/i.test(d.category || "") &&
      !coreDatasets.includes(d)
  );

  function renderTable(title: string, list: any[]) {
    if (list.length === 0) return null;

    return (
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">{title}</h2>
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
              {list.map((dataset) => (
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
                    {dataset.category || "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm space-x-3">
                    <button
                      onClick={() => setViewDataset(dataset)}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setEditDataset(dataset)}
                      className="text-yellow-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteDataset(dataset)}
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
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Datasets</h1>
          <p className="text-gray-600 text-sm">
            Manage, view, and derive baseline data
          </p>
        </div>
        <Link
          href="/datasets/upload"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
        >
          + Upload Dataset
        </Link>
      </div>

      {renderTable("Core Datasets", coreDatasets)}
      {renderTable("Hazard Datasets", hazardDatasets)}
      {renderTable("Underlying Vulnerabilities", vulnerabilityDatasets)}
      {renderTable("SSC Framework Datasets", frameworkDatasets)}

      {datasets.length === 0 && (
        <p className="text-gray-500 text-sm">No datasets found.</p>
      )}

      {viewDataset && (
        <ViewDatasetModal
          dataset={viewDataset}
          onClose={() => setViewDataset(null)}
        />
      )}
      {editDataset && (
        <EditDatasetModal
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
        />
      )}
      {deleteDataset && (
        <DeleteDatasetModal
          dataset={deleteDataset}
          onClose={() => setDeleteDataset(null)}
        />
      )}
    </>
  );
}
