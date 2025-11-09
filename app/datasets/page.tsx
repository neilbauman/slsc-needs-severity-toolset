'use client';

import Link from 'next/link';
import UploadDatasetModal from '@/components/UploadDatasetModal';

export default function DatasetsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="border-b pb-4 mb-4">
        <nav className="text-sm text-gray-500 mb-2">
          <Link href="/" className="hover:underline">Dashboard</Link> / <span>Datasets</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-800">Datasets</h1>
      </header>

      {/* Upload button */}
      <div className="flex justify-end">
        <UploadDatasetModal />
      </div>

      {/* Core datasets */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Core Datasets</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li>Administrative Boundaries (ADM0–ADM4)</li>
          <li>Population Data</li>
          <li>GIS Layers</li>
        </ul>
      </section>

      {/* Uploaded datasets */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Uploaded Datasets</h2>
        <p className="text-sm text-gray-500 mb-2">These are datasets added to enrich the baseline analysis.</p>

        {/* Placeholder */}
        <div className="text-sm text-gray-600 italic">No datasets uploaded yet.</div>
      </section>
    </div>
  );
}
