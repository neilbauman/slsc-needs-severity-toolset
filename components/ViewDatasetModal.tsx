"use client";

import React from "react";

export default function ViewDatasetModal({
  dataset,
  onClose,
}: {
  dataset: any;
  onClose: () => void;
}) {
  if (!dataset) return null;

  const metadata = dataset.metadata || {};
  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleString() : "—";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          {dataset.name}
        </h2>
        <p className="text-gray-500 mb-4">{dataset.description || "—"}</p>

        <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-700 mb-4">
          <p>
            <span className="font-semibold">Type:</span>{" "}
            {dataset.type || "—"}
          </p>
          <p>
            <span className="font-semibold">Admin Level:</span>{" "}
            {dataset.admin_level || "—"}
          </p>
          <p>
            <span className="font-semibold">Category:</span>{" "}
            {dataset.category || "—"}
          </p>
          <p>
            <span className="font-semibold">Source:</span>{" "}
            {metadata.source || "—"}
          </p>
          <p>
            <span className="font-semibold">Format:</span>{" "}
            {metadata.format || "—"}
          </p>
          <p>
            <span className="font-semibold">Collected At:</span>{" "}
            {formatDate(dataset.collected_at)}
          </p>
          <p>
            <span className="font-semibold">Created At:</span>{" "}
            {formatDate(dataset.created_at)}
          </p>
        </div>

        {Object.keys(metadata).length > 0 && (
          <div className="bg-gray-50 border rounded-md p-3 text-xs text-gray-600 mb-4">
            <h3 className="font-semibold text-gray-700 mb-1">Metadata</h3>
            <pre className="overflow-auto">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
