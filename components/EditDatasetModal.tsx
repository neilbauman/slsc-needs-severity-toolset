"use client";

import React, { useState, useEffect } from "react";

interface Props {
  dataset: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function EditDatasetModal({ dataset, isOpen, onClose, onSave }: Props) {
  const [name, setName] = useState(dataset.name || "");
  const [description, setDescription] = useState(dataset.description || "");

  useEffect(() => {
    setName(dataset.name || "");
    setDescription(dataset.description || "");
  }, [dataset]);

  const handleSave = () => {
    // 🔧 TODO: Implement save logic here
    console.log("Saving changes for:", name, description);
    onSave();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Edit Dataset</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              className="mt-1 block w-full rounded border border-gray-300 p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="mt-1 block w-full rounded border border-gray-300 p-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-2">
          <button className="bg-gray-300 text-gray-800 px-4 py-2 rounded" onClick={onClose}>
            Cancel
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
