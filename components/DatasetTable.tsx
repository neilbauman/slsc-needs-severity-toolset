"use client";

import React from "react";

interface DatasetTableProps {
  datasets: any[];
  onView: (dataset: any) => void;
  onEdit: (dataset: any) => void;
  onDelete: (dataset: any) => void;
  onTransform: (dataset: any) => void;
}

export default function DatasetTable({
  datasets,
  onView,
  onEdit,
  onDelete,
  onTransform,
}: DatasetTableProps) {
  if (!datasets || datasets.length === 0) {
    return (
      <div className="text-sm text-gray-500 p-3 text-center">
        No datasets available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto max-h-[400px] overflow-y-auto text-sm">
      <table className="min-w-full border-collapse text-gray-800">
        <thead className="bg-gray-100 text-gray-700 text-xs uppercase sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left border-b">Name</th>
            <th className="px-3 py-2 text-left border-b">Type</th>
            <th className="px-3 py-2 text-left border-b">Category</th>
            <th className="px-3 py-2 text-left border-b">Admin Level</th>
            <th className="px-3 py-2 text-left border-b">Created</th>
            <th className="px-3 py-2 text-left border-b">Derived?</th>
            <th className="px-3 py-2 text-right border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((dataset) => (
            <tr
              key={dataset.id}
              className="hover:bg-gray-50 border-b border-gray-100"
            >
              <td className="px-3 py-2 font-medium">{dataset.name}</td>
              <td className="px-3 py-2 text-gray-700">{dataset.type}</td>
              <td className="px-3 py-2 text-gray-600">
                {dataset.category || "Uncategorized"}
              </td>
              <td className="px-3 py-2 text-gray-700">{dataset.admin_level}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">
                {new Date(dataset.created_at).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-center">
                {dataset.is_derived ? (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Derived
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    Raw
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onView(dataset)}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    View
                  </button>
                  <button
                    onClick={() => onEdit(dataset)}
                    className="text-green-600 hover:underline text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onTransform(dataset)}
                    className="text-indigo-600 hover:underline text-xs"
                  >
                    Transform
                  </button>
                  <button
                    onClick={() => onDelete(dataset)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
