'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadDatasetModal({ isOpen, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    setFile(uploadedFile || null);

    if (uploadedFile) {
      Papa.parse(uploadedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          setParsedData(result.data);
          console.log('Parsed data:', result.data);
        },
      });
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-xl shadow-lg">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload Dataset</h2>

        <input type="file" accept=".csv" onChange={handleFileChange} className="mb-4" />

        {parsedData.length > 0 && (
          <div className="max-h-64 overflow-auto border border-gray-200 rounded p-2 text-xs text-gray-700">
            <pre>{JSON.stringify(parsedData.slice(0, 5), null, 2)}</pre>
            <p className="text-gray-400 mt-2">Showing first 5 records...</p>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-2">
          <button onClick={handleClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm">
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
