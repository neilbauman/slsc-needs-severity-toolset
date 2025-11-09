'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';

export default function UploadDatasetModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [datasetName, setDatasetName] = useState('');

  const handleParse = () => {
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        setParsedData(data);
        if (data.length > 0) {
          setColumns(Object.keys(data[0]));
        }
      },
    });
  };

  const handleClose = () => {
    setFile(null);
    setColumns([]);
    setParsedData([]);
    setDatasetName('');
    onClose();
  };

  const handleSubmit = () => {
    // This is where you'd handle sending parsedData and metadata to your backend
    console.log('Submitting dataset:', {
      name: datasetName,
      columns,
      data: parsedData.slice(0, 5), // show preview
    });
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Upload Dataset</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-red-500 text-xl">
            &times;
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Dataset Name</label>
          <input
            type="text"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="e.g. Building Typology"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={handleParse}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
            disabled={!file}
          >
            Parse File
          </button>
          <button
            onClick={handleSubmit}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
            disabled={!parsedData.length}
          >
            Submit Dataset
          </button>
        </div>

        {columns.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-semibold mb-1">Detected Columns:</p>
            <div className="flex flex-wrap gap-2">
              {columns.map((col, i) => (
                <span
                  key={i}
                  className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
