"use client";

import React, { useState } from "react";

export default function EditDatasetModal({
  dataset,
  onClose,
}: {
  dataset: any;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: dataset.name || "",
    description: dataset.description || "",
    category: dataset.category || "",
    source: dataset.source || "",
    year: dataset.year || "",
    format: dataset.format || "",
  });

  const handleChange = (e: any) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = () => {
    console.log("Saving dataset:", form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 relative">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Edit Dataset
        </h2>

        <div className="space-y-3">
          {Object.keys(form).map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                {key.replace("_", " ")}
              </label>
              <input
                name={key}
                className="border rounded w-full px-3 py-2 text-sm"
                value={(form as any)[key]}
                onChange={handleChange}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
