"use client";

import React, { useEffect, useState } from "react";
import Papa from "papaparse";

interface ViewDatasetModalProps {
  dataset: any;
  isOpen: boolean;
  onClose: () => void;
}

const ViewDatasetModal: React.FC<ViewDatasetModalProps> = ({ dataset, isOpen, onClose }) => {
  const [previewData, setPreviewData] = useState<string[][]>([]);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!dataset || !dataset.file_url) return;
      const res = await fetch(dataset.file_url);
      const text = await res.text();
      Papa.parse(text, {
        header: false,
        preview: 10,
        complete: (results: any) => {
          setPreviewData(results.data);
        },
      });
    };

    fetchPreview();
  }, [dataset]);

  if (!isOpen || !dataset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-3xl mx-4 p-6 rounded shadow-lg overflow-y-auto max-h-[80vh]">
        <h2 className="text-xl font-bold mb-4">View Dataset</h2>

        <div className="mb-4 space-y-1 text-sm">
          <p><strong>Name:</strong> {dataset.name}</p>
          <p><strong>Description:</strong> {dataset.description || "N/A"}</p>
          <p><strong>Type:</strong> {dataset.type || "N/A"}</p>
          <p><strong>Admin Level:</strong> {dataset.admin_level || "N/A"}</p>
          <p><strong>Source:</strong> {dataset.source || "N/A"}</p>
          <p><strong>Created At:</strong> {new Date(dataset.created_at).toLocaleString()}</p>
        </div>

        <div className="border rounded overflow-x-auto max-h-64">
          <table className="text-xs table-auto w-full">
            <thead className="bg-gray-100">
              {previewData.length > 0 && (
                <tr>
                  {previewData[0].map((header, i) => (
                    <th key={i} className="px-2 py-1 border-b border-gray-300 text-left whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {previewData.slice(1).map((row, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1 border-b border-gray-200 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-right mt-4">
          <button
            className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewDatasetModal;
