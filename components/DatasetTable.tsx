"use client";

import { useState } from "react";
import ViewDatasetModal from "@/components/ViewDatasetModal";
import EditDatasetModal from "@/components/EditDatasetModal";
import DeleteDatasetModal from "@/components/DeleteDatasetModal";

interface DatasetTableProps {
  datasets: any[];
  title?: string;
  loadDatasets: () => Promise<void>;
}

export default function DatasetTable({
  datasets,
  title,
  loadDatasets,
}: DatasetTableProps) {
  const [viewDataset, setViewDataset] = useState<any | null>(null);
  const [editDataset, setEditDataset] = useState<any | null>(null);
  const [deleteDataset, setDeleteDataset] = useState<any | null>(null);

  if (!datasets || datasets.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      {title && (
        <h3 className="font-semibold text-gray-800 text-sm mb-2 mt-4">{title}</h3>
      )}

      <div className="overflow-x-auto border rounded-md bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
            <tr>
              <th className="text-left p-2 border-b w-1/4">Name</th>
              <th className="text-left p-2 border-b w-20">Type</th>
              <th className="text-left p-2 border-b w-24">Admin Level</th>
              <th className="text-left p-2 border-b w-1/6">Source</th>
              <th className="text-left p-2 border-b w-1/6">Collected</th>
              <th className="text-center p-2 border-b w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((dataset, i) => (
              <tr
                key={dataset.id}
                className={`text-gray-700 hover:bg-gray-50 ${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
              >
                <td className="p-2 border-b font-medium truncate">
                  {dataset.name}
                </td>
                <td className="p-2 border-b capitalize">{dataset.type || "—"}</td>
                <td className="p-2 border-b">{dataset.admin_level || "—"}</td>
                <td className="p-2 border-b text-gray-500">
                  {dataset.source || dataset.metadata?.source || "—"}
                </td>
                <td className="p-2 border-b text-gray-500">
                  {dataset.collected_at || "—"}
                </td>
                <td className="p-2 border-b text-center space-x-2">
                  <button
                    onClick={() => setViewDataset(dataset)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    View
                  </button>
                  <button
                    onClick={() => setEditDataset(dataset)}
                    className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteDataset(dataset)}
                    className="text-red-600 hover:text-red-800 text-xs font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
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
          onSaved={() => loadDatasets()}
        />
      )}

      {deleteDataset && (
        <DeleteDatasetModal
          dataset={deleteDataset}
          onClose={() => setDeleteDataset(null)}
          onDeleted={() => loadDatasets()}
        />
      )}
    </div>
  );
}
