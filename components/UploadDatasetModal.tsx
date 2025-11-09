"use client";
import React, { useState } from "react";
import Papa from "papaparse";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function UploadDatasetModal({ isOpen, onClose, onSave }: Props) {
  const [file, setFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleUpload = () => {
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("Parsed CSV:", results.data);
        // You can call your Supabase upload logic here
        onSave(); // Notify parent to refresh datasets
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow w-full max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Upload Dataset</h2>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-4"
        />
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
