"use client";

import React from "react";

export default function ViewDatasetModal({
  dataset,
  onClose,
}: {
  dataset: any;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 relative">
        <h2 className="text-xl font-semibold mb-2 text-gray-800">
          {dataset.name}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {dataset.description || "No description available."}
        </p>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>Type:</strong> {dataset.type || "—"}
          </p>
          <p>
            <strong>Admin Level:</strong>{" "}
            {dataset.admin_level?.toUpperCase() || "N/A"}
          </p>
          <p>
            <strong>Category:</strong> {dataset.category || "—"}
          </p>
          <p>
            <strong>Created At:</strong>{" "}
            {new Date(dataset.created_at).toLocaleString()}
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
