'use client';

import Link from 'next/link';

export default function DatasetsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-800">Philippines Shelter Severity Toolset (sandbox)</h1>
        <nav className="text-sm text-gray-500 mt-1">
          <Link href="/" className="hover:underline">Dashboard</Link>
          <span className="mx-1">/</span>
          <span>Datasets</span>
        </nav>
      </div>

      {/* Upload dataset button */}
      <div className="flex justify-end">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          onClick={() => alert('Upload modal not wired yet')}
        >
          + Upload Dataset
        </button>
      </div>

      {/* Core datasets panel */}
      <section className="bg-white border border-gray-200 rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Core Datasets</h2>
        <ul className="list-disc list-inside text-gray-600 text-sm space-y-1">
          <li>Administrative Boundaries (ADM0–ADM4)</li>
          <li>Population Data</li>
          <li>GIS Layers</li>
        </ul>
      </section>

      {/* Uploaded datasets panel */}
      <section className="bg-white border border-gray-200 rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Uploaded Datasets</h2>
        <p className="text-sm text-gray-500 mb-4">
          These datasets have been uploaded for use in baseline analysis.
        </p>
        <div className="text-sm italic text-gray-400">No uploaded datasets yet.</div>
      </section>
    </div>
  );
}
