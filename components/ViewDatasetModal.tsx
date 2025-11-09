"use client";

import React from "react";

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  if (!dataset) return null;

  // Normalize metadata to prevent crashes or invalid dates
  const metadata = dataset.metadata || {};
  const getDate = (val: string | null | undefined) => {
    if (!val) return "—";
    const d = new Date(val);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6">
        <h2 className="text-2xl font-bold mb-1">{dataset.name}</h2>
        {dataset.description && (
          <p className="text-gray-500 mb-4">{dataset.description}</p>
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
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
              {getDate(dataset.created_at)}
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
              {getDate(metadata.collected_at || dataset.collected_at)}
            </p>
            <p>
              <span className="font-semibold">Updated At:</span>{" "}
              {getDate(metadata.updated_at)}
            </p>
          </div>
        </div>

        {/* Divider */}
        {metadata && Object.keys(metadata).length > 0 && (
          <>
            <hr className="my-4" />
            <div className="bg-gray-50 p-3 rounded-md text-xs text-gray-700 font-mono overflow-x-auto">
              <pre>{JSON.stringify(metadata, null, 2)}</pre>
            </div>
          </>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
