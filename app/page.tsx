'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="p-6 space-y-8 bg-gray-50 min-h-screen">
      <header className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-800">
          Philippines Shelter Severity Toolset <span className="text-gray-500">(sandbox)</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">Rapid dashboard for data and instance management</p>
      </header>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Core Datasets</h2>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>Population (ADM1–ADM4)</li>
          <li>Evacuation Centers</li>
          <li>Building Typology</li>
        </ul>
        <div className="mt-3">
          <Link
            href="/datasets"
            className="inline-block text-blue-600 text-sm underline hover:text-blue-800"
          >
            Manage Datasets →
          </Link>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Baseline Instance</h2>
        <p className="text-sm text-gray-600 mb-2">
          Composed of selected core datasets used to compute SSC index.
        </p>
        <Link
          href="/instances"
          className="text-blue-600 text-sm underline hover:text-blue-800"
        >
          View Instances →
        </Link>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Map Viewer</h2>
        <p className="text-sm text-gray-600">
          Will support ADM-level toggles and scored dataset overlays
        </p>
      </section>
    </main>
  );
}
