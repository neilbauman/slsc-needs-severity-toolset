'use client';

import React, { useState } from 'react';
import UploadDatasetModal from '../../components/UploadDatasetModal';

export default function DatasetsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  // Placeholder static data — replace with dynamic fetch
  const coreDatasets = [
    { id: 'population', name: 'Population (ADM1–ADM4)' },
    { id: 'admins', name: 'Administrative Boundaries (ADM0–ADM4)' },
    { id: 'gis', name: 'GIS Layers (Buildings, Roads, Elevation)' },
  ];

  const otherDatasets = [
    { id: 'building_typology', name: 'Building Typology by Barangay' },
    { id: 'evac_centers', name: 'Evacuation Centers (Partial)' },
  ];

  return (
    <main className="p-6 space-y-8 max-w-5xl mx-auto">
      {/* HEADER */}
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">
          Datasets
        </h1>
        <nav className="text-sm text-gray-500">
          <span className="text-blue-600 hover:underline cursor-pointer">Dashboard</span> &raquo; Datasets
        </nav>
      </header>

      {/* UPLOAD BUTTON */}
      <div className="flex justify-end">
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          Upload New Dataset
        </button>
      </div>

      {/* CORE DATASETS */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Core Datasets</h2>
        <ul className="space-y-2">
          {coreDatasets.map((ds) => (
            <li
              key={ds.id}
              className="bg-gray-100 border border-gray-300 rounded p-4 shadow-sm"
            >
              <div className="text-sm font-medium text-gray-800">{ds.name}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* OTHER DATASETS */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Other Uploaded Datasets</h2>
        <ul className="space-y-2">
          {otherDatasets.map((ds) => (
            <li
              key={ds.id}
              className="bg-white border border-gray-200 rounded p-4 shadow-sm"
            >
              <div className="text-sm text-gray-800 font-medium">{ds.name}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* MODAL */}
      <UploadDatasetModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </main>
  );
}
