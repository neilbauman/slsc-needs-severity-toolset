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
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 relative overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-semibold mb-2 text-gray-800">
          {dataset.name}
        </h2>
        <p className="text-gray-500 mb-4">
          {dataset.description || "No description available."}
        </p>

        <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
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
            <strong>Source:</strong> {dataset.source || "—"}
          </p>
          <p>
            <strong>Year:</strong> {dataset.year || "—"}
          </p>
          <p>
            <strong>Format:</strong> {dataset.format || "—"}
          </p>
          <p>
            <strong>Created:</strong>{" "}
            {new Date(dataset.created_at).toLocaleString()}
          </p>
          <p>
            <strong>Updated:</strong>{" "}
            {dataset.updated_at
              ? new Date(dataset.updated_at).toLocaleString()
              : "—"}
          </p>
        </div>

        {dataset.download_url && (
          <div className="mt-6">
            <a
              href={dataset.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              Download dataset
            </a>
          </div>
        )}

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
