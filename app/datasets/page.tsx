// app/datasets/page.tsx

'use client';

import React, { useState } from 'react';
import UploadDatasetModal from '@/components/UploadDatasetModal';

export default function DatasetsPage() {
  const [showUploadModal, setShowUploadModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-8">
      {/* Header */}
      <header className="bg-primary-800 text-white p-4 rounded shadow">
        <h1 className="text-2xl font-bold">
          Philippines Shelter Severity Toolset <span className="text-yellow-400">(sandbox)</span>
        </h1>
        <nav className="text-sm mt-1">
          <a href="/" className="underline text-white">Dashboard</a> <span className="mx-1">»</span> Datasets
        </nav>
      </header>

      {/* Main content */}
      <main className="mt-8 space-y-10">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Datasets</h2>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Upload New Dataset
          </button>
        </div>

        {/* Core datasets */}
        <section>
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Core Datasets</h3>
          <div className="space-y-2">
            <div className="bg-white rounded p-4 shadow">Population (ADM1–ADM4)</div>
            <div className="bg-white rounded p-4 shadow">Administrative Boundaries (ADM0–ADM4)</div>
            <div className="bg-white rounded p-4 shadow">GIS Layers (Buildings, Roads, Elevation)</div>
          </div>
        </section>

        {/* Other uploaded datasets */}
        <section>
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Other Uploaded Datasets</h3>
          <div className="space-y-2">
            <div className="bg-white rounded p-4 shadow">Building Typology by Barangay</div>
            <div className="bg-white rounded p-4 shadow">Evacuation Centers (Partial)</div>
          </div>
        </section>
      </main>

      {/* Upload modal */}
      <UploadDatasetModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  );
}
