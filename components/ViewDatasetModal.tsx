"use client";

import React from "react";

interface Props {
  dataset: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ViewDatasetModal({ dataset, isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
      <div className="bg-white rounded p-6 w-full max-w-xl">
        <h2 className="text-xl font-semibold mb-4">View Dataset</h2>
        <div className="space-y-2">
          <div>
            <span className="font-medium">Name:</span> {dataset.name}
          </div>
          <div>
            <span className="font-medium">Description:</span> {dataset.description}
          </div>
          <div>
            <span className="font-medium">Type:</span> {dataset.data_type}
          </div>
          <div>
            <span className="font-medium">Admin Level:</span> {dataset.admin_level}
          </div>
          <div>
            <span className="font-medium">Source:</span> {dataset.source || "—"}
          </div>
          <div>
            <span className="font-medium">Created At:</span>{" "}
            {new Date(dataset.created_at).toLocaleString()}
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button className="bg-gray-300 text-gray-800 px-4 py-2 rounded" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
