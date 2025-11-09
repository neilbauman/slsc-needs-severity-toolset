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

  // Normalize metadata safely
  const metadata =
    typeof dataset.metadata === "string"
      ? safeParseJSON(dataset.metadata)
      : dataset.metadata || {};

  function safeParseJSON(str: string) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 relative">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">
          {dataset.name}
        </h2>
        {dataset.description && (
          <p className="text-gray-500 mb-4">{dataset.description}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-700">
          <div>
            <p>
              <span className="font-semibold">Type:</span>{" "}
              {dataset.type || "—"}
            </p>
            <p>
              <span className="font-semibold">Category:</span>{" "}
              {dataset.category || "—"}
            </p>
            <p>
              <span className="font-semibold">Format:</span>{" "}
              {metadata.format || "—"}
            </p>
            <p>
              <span className="font-semibold">Created At:</span>{" "}
              {dataset.created_at
                ? new Date(dataset.created_at).toLocaleString()
                : "—"}
            </p>
          </div>

          <div>
            <p>
              <span className="font-semibold">Admin Level:</span>{" "}
              {dataset.admin_level || "—"}
            </p>
            <p>
              <span className="font-semibold">Source:</span>{" "}
              {metadata.source || dataset.source || "—"}
            </p>
            <p>
              <span className="font-semibold">Collected At:</span>{" "}
              {dataset.collected_at
                ? new Date(dataset.collected_at).toLocaleDateString()
                : metadata.collected_at
                ? new Date(metadata.collected_at).toLocaleDateString()
                : "—"}
            </p>
            <p>
              <span className="font-semibold">Updated At:</span>{" "}
              {metadata.updated_at
                ? new Date(metadata.updated_at).toLocaleString()
                : "—"}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t my-4" />

        {/* Metadata dump if present */}
        {Object.keys(metadata).length > 0 && (
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md overflow-x-auto">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 rounded-md font-medium text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
