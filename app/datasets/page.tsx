// app/datasets/page.tsx

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import UploadDatasetModal from '@/components/UploadDatasetModal';

const coreDatasets = [
  { name: 'Population (ADM1–ADM4)' },
  { name: 'Administrative Boundaries (ADM0–ADM4)' },
  { name: 'GIS Layers (Buildings, Roads, Elevation)' },
];

const uploadedDatasets = [
  { name: 'Building Typology by Barangay' },
  { name: 'Evacuation Centers (Partial)' },
];

export default function DatasetsPage() {
  const [showUploadModal, setShowUploadModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Bar */}
      <div className="bg-sky-900 text-white px-6 py-4">
        <h1 className="text-xl font-semibold">
          Philippines Shelter Severity Toolset{' '}
          <span className="text-yellow-400">(sandbox)</span>
        </h1>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-2">
          <Link href="/" className="text-sky-700 hover:underline">
            Dashboard
          </Link>{' '}
          <span className="mx-1">»</span> Datasets
        </div>

        {/* Page Title and Upload Button */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Datasets</h2>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => setShowUploadModal(true)}
          >
            Upload New Dataset
          </button>
        </div>

        {/* Core Datasets */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Core Datasets</h3>
          <div className="space-y-3">
            {coreDatasets.map((dataset, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg p-4 shadow-sm flex justify-between items-center"
              >
                <span className="text-gray-800 font-medium">{dataset.name}</span>
                <div className="space-x-2">
                  <button className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">View</button>
                  <button className="text-sm px-2 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">Edit</button>
                  <button className="text-sm px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Other Uploaded Datasets */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Other Uploaded Datasets</h3>
          <div className="space-y-3">
            {uploadedDatasets.map((dataset, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg p-4 shadow-sm flex justify-between items-center"
              >
                <span className="text-gray-800 font-medium">{dataset.name}</span>
                <div className="space-x-2">
                  <button className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">View</button>
                  <button className="text-sm px-2 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">Edit</button>
                  <button className="text-sm px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showUploadModal && (
        <UploadDatasetModal onClose={() => setShowUploadModal(false)} />
      )}
    </div>
  );
}
